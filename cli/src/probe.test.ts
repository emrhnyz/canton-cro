import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildProbeScript,
  failSafeProbedFacts,
  gatherFacts,
  parseProbedFacts,
} from "./runner/probe.js";
import { defaultStubFacts, writeFacts, factsPath } from "./facts.js";
import { evaluatePreflight } from "./preflight.js";
import {
  createInitialState,
  saveState,
  writeConfig,
  loadState,
  type RunConfig,
} from "./state.js";
import { runMachine } from "./machine.js";

const stubConfig: RunConfig = {
  source: "participant1",
  target: "participant2",
  syncAlias: "da",
  partyId: "Alice::1220probe",
  runOptionalSteps: true,
  faultInjection: "none",
};

/** canton runner pointing at a binary that always fails (daemon-down stand-in). */
const deadCantonConfig: RunConfig = {
  ...stubConfig,
  runner: "canton",
  canton: { bin: "/usr/bin/false", remoteConf: "/nonexistent/remote.conf" },
};

describe("parseProbedFacts", () => {
  it("maps CRO_VAR lines to booleans (unknown keys ignored, missing -> false)", () => {
    const stdout = [
      "CRO_VAR participantsReachable=true",
      "CRO_VAR healthPingOk=true",
      "CRO_VAR partyHostedOnSource=true",
      "CRO_VAR partyAlreadyOnTarget=false",
      "CRO_VAR sourceHasPackages=true",
      "CRO_VAR targetConnectedToSync=true",
      "CRO_VAR partyHasContracts=true",
      "CRO_VAR somethingElse=42",
      "CRO_PROBE_OK",
    ].join("\n");
    const p = parseProbedFacts(stdout);
    assert.equal(p.participantsReachable, true);
    assert.equal(p.partyAlreadyOnTarget, false);
    assert.equal(p.partyHasContracts, true);
  });

  it("treats absent vars as false (conservative)", () => {
    const p = parseProbedFacts("CRO_PROBE_OK\n");
    assert.deepEqual(p, failSafeProbedFacts());
  });
});

describe("buildProbeScript", () => {
  it("embeds config values and emits every probed fact", () => {
    const s = buildProbeScript({
      source: "participant1",
      target: "participant2",
      syncAlias: "da",
      partyId: "Alice::1220probe",
    });
    for (const key of Object.keys(failSafeProbedFacts())) {
      assert.ok(s.includes(`"${key}"`), `script must probe ${key}`);
    }
    assert.ok(s.includes("Alice::1220probe"));
    assert.ok(s.includes("CRO_PROBE_OK"));
  });
});

describe("gatherFacts", () => {
  it("stub runner: returns declared facts.json unchanged, no probe stamp", () => {
    const cwd = mkdtempSync(join(tmpdir(), "cro-probe-"));
    try {
      writeFacts("r1", defaultStubFacts(), cwd);
      const facts = gatherFacts("r1", stubConfig, cwd);
      assert.equal(facts.probe, undefined);
      assert.equal(facts.participantsReachable, true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("canton runner + dead console: fail-safe facts persisted with probe stamp", () => {
    const cwd = mkdtempSync(join(tmpdir(), "cro-probe-"));
    try {
      writeFacts("r2", defaultStubFacts(), cwd);
      const facts = gatherFacts("r2", deadCantonConfig, cwd);
      assert.equal(facts.participantsReachable, false);
      assert.equal(facts.healthPingOk, false);
      assert.ok(facts.probe, "probe stamp expected");
      assert.match(facts.probe!.note ?? "", /DOWN/);
      // merged facts persisted back to facts.json (auditable)
      const onDisk = JSON.parse(readFileSync(factsPath("r2", cwd), "utf8"));
      assert.equal(onDisk.participantsReachable, false);
      assert.equal(onDisk.probe.source, "live-canton-probe");
      // operator-declared facts survive the merge
      assert.equal(onDisk.backupPlanReady, true);
      // and the report fails hard
      const report = evaluatePreflight(deadCantonConfig, facts);
      assert.equal(report.ok, false);
      assert.ok(report.errors.some((e) => e.id === "participants_reachable"));
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("apply gate with live probe", () => {
  it("canton runner + dead console: apply blocked, no steps run", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "cro-probe-"));
    try {
      const runId = "blocked";
      writeConfig(runId, deadCantonConfig, cwd);
      writeFacts(runId, defaultStubFacts(), cwd);
      saveState(createInitialState(runId, deadCantonConfig), cwd);

      const result = await runMachine(runId, "apply", { cwd });
      assert.equal(result.exitCode, 1);
      assert.match(result.message, /preflight FAILED/);
      const st = loadState(runId, cwd);
      assert.ok(
        st.steps.every((s) => s.status === "pending"),
        "no step may start when the live probe says the environment is down",
      );
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("party_not_already_on_target check", () => {
  it("warns with resume hint when party already on target", () => {
    const facts = { ...defaultStubFacts(), partyAlreadyOnTarget: true };
    const report = evaluatePreflight(stubConfig, facts);
    const warn = report.warnings.find((w) => w.id === "party_not_already_on_target");
    assert.ok(warn);
    assert.match(warn!.detail, /resume the original run/);
    // warn-only: does not block
    assert.equal(report.ok, true);
  });
});
