import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  createInitialState,
  saveState,
  writeConfig,
  loadState,
  diagnosisPath,
  type RunConfig,
} from "./state.js";
import { defaultStubFacts, writeFacts } from "./facts.js";
import { runMachine } from "./machine.js";

const base: RunConfig = {
  source: "participant1",
  target: "participant2",
  syncAlias: "da",
  partyId: "Alice::fault",
  runOptionalSteps: true,
  faultInjection: "none",
};

describe("ACS fault injection", () => {
  it("broken-acs-import: safe stop with diagnosis, no reconnect", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "cro-fault-"));
    try {
      const runId = "brk";
      const cfg: RunConfig = { ...base, faultInjection: "broken-acs-import" };
      writeConfig(runId, cfg, cwd);
      writeFacts(runId, defaultStubFacts(), cwd);
      saveState(createInitialState(runId, cfg), cwd);

      const result = await runMachine(runId, "apply", { cwd });
      assert.equal(result.exitCode, 1);
      assert.match(result.message, /SAFE STOP/);

      const state = loadState(runId, cwd);
      assert.equal(state.status, "failed");
      const importStep = state.steps.find((s) => s.id === "import_acs")!;
      const reconnect = state.steps.find((s) => s.id === "reconnect")!;
      const clear = state.steps.find((s) => s.id === "clear_onboarding_flag")!;
      assert.equal(importStep.status, "failed");
      assert.equal(reconnect.status, "pending");
      assert.equal(clear.status, "pending");

      assert.ok(existsSync(diagnosisPath(runId, cwd)));
      const d = JSON.parse(readFileSync(diagnosisPath(runId, cwd), "utf8"));
      assert.equal(d.fault, "broken-acs-import");
      assert.equal(d.safeStop, true);
      assert.match(d.code, /ACS_COMMITMENT/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("partial-acs-import: ACS_IMPORT_INCOMPLETE diagnosis", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "cro-fault-"));
    try {
      const runId = "part";
      const cfg: RunConfig = { ...base, faultInjection: "partial-acs-import" };
      writeConfig(runId, cfg, cwd);
      writeFacts(runId, defaultStubFacts(), cwd);
      saveState(createInitialState(runId, cfg), cwd);

      const result = await runMachine(runId, "apply", { cwd });
      assert.equal(result.exitCode, 1);
      const d = JSON.parse(readFileSync(diagnosisPath(runId, cwd), "utf8"));
      assert.equal(d.code, "ACS_IMPORT_INCOMPLETE");
      assert.equal(d.step, "import_acs");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
