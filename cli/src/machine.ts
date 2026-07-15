import { STEPS } from "./steps.js";
import {
  appendEvent,
  loadState,
  saveState,
  writePreflightResult,
  writeDiagnosis,
  type RunState,
} from "./state.js";
import { runStubStep } from "./runner/stub.js";
import { loadFacts } from "./facts.js";
import { evaluatePreflight, formatPreflightReport } from "./preflight.js";
import { AcsImportFaultError, formatDiagnosis } from "./fault.js";

export type MachineMode = "apply" | "resume";

export interface MachineResult {
  exitCode: number;
  message: string;
  state: RunState;
}

export interface RunMachineOptions {
  cwd?: string;
  execute?: typeof runStubStep;
  /** When true (default for apply), refuse to run if preflight fails. */
  requirePreflight?: boolean;
}

function allTerminal(state: RunState): boolean {
  return state.steps.every((s) => s.status === "done" || s.status === "skipped");
}

function findFailedIndex(state: RunState): number {
  return state.steps.findIndex((s) => s.status === "failed");
}

function advanceCursor(state: RunState): void {
  let i = state.cursor;
  while (i < state.steps.length) {
    const st = state.steps[i]!;
    if (st.status === "pending" || st.status === "failed" || st.status === "running") {
      state.cursor = i;
      return;
    }
    i += 1;
  }
  state.cursor = state.steps.length;
}

/**
 * Execute pending steps from cursor.
 * - done/skipped: no-op (idempotent)
 * - apply on failed run without resume: reject
 * - resume: retry failed step then continue
 */
export async function runMachine(
  runId: string,
  mode: MachineMode,
  cwdOrOpts: string | RunMachineOptions = process.cwd(),
  /** @deprecated prefer opts.execute — kept for call-site compat */
  executeCompat?: typeof runStubStep,
): Promise<MachineResult> {
  const opts: RunMachineOptions =
    typeof cwdOrOpts === "string"
      ? { cwd: cwdOrOpts, execute: executeCompat ?? runStubStep }
      : { execute: runStubStep, requirePreflight: true, ...cwdOrOpts };
  const cwd = opts.cwd ?? process.cwd();
  const execute = opts.execute ?? runStubStep;
  const requirePreflight = opts.requirePreflight ?? mode === "apply";

  const state = loadState(runId, cwd);

  if (allTerminal(state)) {
    state.status = "completed";
    saveState(state, cwd);
    appendEvent(runId, { type: "noop", mode, reason: "already complete" }, cwd);
    return {
      exitCode: 0,
      message: `run ${runId}: already complete (idempotent no-op)`,
      state,
    };
  }

  const failedIdx = findFailedIndex(state);
  if (mode === "apply" && failedIdx >= 0) {
    return {
      exitCode: 1,
      message: `run ${runId}: status failed at step ${state.steps[failedIdx]!.id} — use: cro resume --run ${runId}`,
      state,
    };
  }

  if (mode === "apply" && requirePreflight) {
    const facts = loadFacts(runId, cwd);
    const report = evaluatePreflight(state.config, facts);
    writePreflightResult(
      runId,
      {
        ok: report.ok,
        at: new Date().toISOString(),
        errorIds: report.errors.map((e) => e.id),
      },
      cwd,
    );
    appendEvent(
      runId,
      { type: "preflight", ok: report.ok, errors: report.errors.map((e) => e.id) },
      cwd,
    );
    if (!report.ok) {
      console.error(formatPreflightReport(report));
      return {
        exitCode: 1,
        message: `run ${runId}: preflight FAILED — cro apply blocked. Fix runs/${runId}/facts.json or config, then: cro preflight --run ${runId}`,
        state,
      };
    }
  }

  if (mode === "resume") {
    if (failedIdx >= 0) {
      state.cursor = failedIdx;
      state.steps[failedIdx]!.status = "pending";
      delete state.steps[failedIdx]!.error;
      appendEvent(runId, { type: "resume", fromStep: state.steps[failedIdx]!.id }, cwd);
    } else {
      advanceCursor(state);
      appendEvent(runId, { type: "resume", fromCursor: state.cursor }, cwd);
    }
  } else {
    advanceCursor(state);
    appendEvent(runId, { type: "apply_start", cursor: state.cursor }, cwd);
  }

  state.status = "running";
  saveState(state, cwd);

  while (state.cursor < state.steps.length) {
    const step = state.steps[state.cursor]!;
    const def = STEPS.find((s) => s.id === step.id)!;

    if (step.status === "done" || step.status === "skipped") {
      appendEvent(runId, { type: "skip", step: step.id, reason: "already done" }, cwd);
      state.cursor += 1;
      continue;
    }

    if (def.optional && !state.config.runOptionalSteps) {
      step.status = "skipped";
      step.updatedAt = new Date().toISOString();
      appendEvent(runId, { type: "skip", step: step.id, reason: "optional disabled" }, cwd);
      saveState(state, cwd);
      state.cursor += 1;
      continue;
    }

    step.status = "running";
    step.updatedAt = new Date().toISOString();
    saveState(state, cwd);
    appendEvent(runId, { type: "step_start", step: step.id }, cwd);

    try {
      const result = await execute({
        runId,
        stepId: step.id,
        config: state.config,
      });
      step.status = "done";
      step.updatedAt = new Date().toISOString();
      delete step.error;
      appendEvent(runId, { type: "step_done", step: step.id, message: result.message }, cwd);
      console.log(`  ✓ ${step.id}: ${result.message}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      step.status = "failed";
      step.error = msg;
      step.updatedAt = new Date().toISOString();
      state.status = "failed";
      // Leave later steps pending (safe stop — do not skip ahead)
      for (let j = state.cursor + 1; j < state.steps.length; j++) {
        if (state.steps[j]!.status === "running") {
          state.steps[j]!.status = "pending";
        }
      }

      if (err instanceof AcsImportFaultError) {
        writeDiagnosis(runId, { ...err.diagnosis, at: new Date().toISOString() }, cwd);
        appendEvent(
          runId,
          {
            type: "fault_diagnosis",
            step: step.id,
            code: err.diagnosis.code,
            fault: err.diagnosis.fault,
            safeStop: true,
          },
          cwd,
        );
        console.error(`  ✗ ${step.id}: ${msg}`);
        console.error(formatDiagnosis(err.diagnosis));
        saveState(state, cwd);
        return {
          exitCode: 1,
          message: `run ${runId}: SAFE STOP at ${step.id} (${err.diagnosis.code}) — see runs/${runId}/diagnosis.json — restore backup then cro resume`,
          state,
        };
      }

      appendEvent(runId, { type: "step_failed", step: step.id, error: msg }, cwd);
      saveState(state, cwd);
      console.error(`  ✗ ${step.id}: ${msg}`);
      return {
        exitCode: 1,
        message: `run ${runId}: failed at ${step.id} — cro resume --run ${runId}`,
        state,
      };
    }

    saveState(state, cwd);
    state.cursor += 1;
  }

  state.status = "completed";
  saveState(state, cwd);
  appendEvent(runId, { type: "completed" }, cwd);
  return {
    exitCode: 0,
    message: `run ${runId}: completed`,
    state,
  };
}

export function formatStatus(state: RunState): string {
  const lines = [
    `run:    ${state.runId}`,
    `status: ${state.status}`,
    `cursor: ${state.cursor}`,
    `party:  ${state.config.partyId}`,
    `path:   ${state.config.source} → ${state.config.target} @ ${state.config.syncAlias}`,
    "",
    "steps:",
  ];
  for (const [i, s] of state.steps.entries()) {
    const mark = i === state.cursor && state.status !== "completed" ? ">" : " ";
    const opt = s.optional ? " (opt)" : "";
    const err = s.error ? ` — ${s.error}` : "";
    lines.push(`${mark} [${s.status.padEnd(7)}] ${s.id}${opt}${err}`);
  }
  return lines.join("\n");
}
