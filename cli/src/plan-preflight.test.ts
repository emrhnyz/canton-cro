import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { evaluatePreflight } from "./preflight.js";
import { defaultStubFacts, writeFacts, type PreflightFacts } from "./facts.js";
import { buildPlan } from "./plan.js";
import {
  createInitialState,
  saveState,
  writeConfig,
  loadState,
  type RunConfig,
} from "./state.js";
import { runMachine } from "./machine.js";

const baseConfig: RunConfig = {
  source: "participant1",
  target: "participant2",
  syncAlias: "da",
  partyId: "Alice::1220test",
  runOptionalSteps: true,
  faultInjection: "none",
};

describe("evaluatePreflight", () => {
  it("passes with stub facts", () => {
    const report = evaluatePreflight(baseConfig, defaultStubFacts());
    assert.equal(report.ok, true);
    assert.equal(report.errors.length, 0);
  });

  it("fails when health ping is false", () => {
    const facts: PreflightFacts = { ...defaultStubFacts(), healthPingOk: false };
    const report = evaluatePreflight(baseConfig, facts);
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => e.id === "health_ping_ok"));
  });

  it("fails when backup plan not ready", () => {
    const facts: PreflightFacts = { ...defaultStubFacts(), backupPlanReady: false };
    const report = evaluatePreflight(baseConfig, facts);
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => e.id === "backup_before_import"));
  });

  it("fails when source equals target", () => {
    const report = evaluatePreflight(
      { ...baseConfig, source: "p1", target: "p1" },
      defaultStubFacts(),
    );
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => e.id === "config_source_neq_target"));
  });

  it("fails when onboarding flag will not be set", () => {
    const facts: PreflightFacts = {
      ...defaultStubFacts(),
      willSetOnboardingFlag: false,
    };
    const report = evaluatePreflight(baseConfig, facts);
    assert.equal(report.ok, false);
    assert.ok(report.errors.some((e) => e.id === "onboarding_flag_required"));
  });
});

describe("buildPlan", () => {
  it("lists all steps as RUN for fresh state", () => {
    const state = createInitialState("t", baseConfig);
    const plan = buildPlan(state);
    assert.equal(plan.length, 13);
    assert.equal(plan.filter((p) => p.action === "run").length, 13);
  });

  it("marks done steps as skip_done without mutating", () => {
    const state = createInitialState("t", baseConfig);
    state.steps[0]!.status = "done";
    const snapshot = JSON.stringify(state);
    const plan = buildPlan(state);
    assert.equal(plan[0]!.action, "skip_done");
    assert.equal(JSON.stringify(state), snapshot);
  });

  it("skips optional when disabled", () => {
    const state = createInitialState("t", {
      ...baseConfig,
      runOptionalSteps: false,
    });
    const plan = buildPlan(state);
    const opt = plan.filter((p) => p.optional);
    assert.ok(opt.every((p) => p.action === "skip_optional"));
  });
});

describe("apply blocked by preflight", () => {
  it("blocks apply when facts fail and does not advance steps", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "cro-"));
    try {
      const runId = "blocked";
      writeConfig(runId, baseConfig, cwd);
      writeFacts(runId, { ...defaultStubFacts(), healthPingOk: false }, cwd);
      saveState(createInitialState(runId, baseConfig), cwd);

      const before = loadState(runId, cwd);
      assert.equal(before.steps[0]!.status, "pending");

      const result = await runMachine(runId, "apply", { cwd });
      assert.equal(result.exitCode, 1);
      assert.match(result.message, /preflight FAILED/);

      const after = loadState(runId, cwd);
      assert.equal(after.steps[0]!.status, "pending");
      assert.equal(after.status, "idle");

      const last = JSON.parse(
        readFileSync(join(cwd, "runs", runId, "preflight-last.json"), "utf8"),
      );
      assert.equal(last.ok, false);
      assert.ok(last.errorIds.includes("health_ping_ok"));
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  it("allows apply when preflight passes", async () => {
    const cwd = mkdtempSync(join(tmpdir(), "cro-"));
    try {
      const runId = "ok";
      writeConfig(runId, baseConfig, cwd);
      writeFacts(runId, defaultStubFacts(), cwd);
      saveState(createInitialState(runId, baseConfig), cwd);

      const result = await runMachine(runId, "apply", { cwd });
      assert.equal(result.exitCode, 0);
      assert.equal(result.state.status, "completed");
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

describe("plan read-only on disk", () => {
  it("does not change state.json bytes", () => {
    const cwd = mkdtempSync(join(tmpdir(), "cro-"));
    try {
      const runId = "planro";
      writeConfig(runId, baseConfig, cwd);
      saveState(createInitialState(runId, baseConfig), cwd);
      const path = join(cwd, "runs", runId, "state.json");
      const before = readFileSync(path, "utf8");
      const state = loadState(runId, cwd);
      buildPlan(state);
      const after = readFileSync(path, "utf8");
      assert.equal(after, before);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
