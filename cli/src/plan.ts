import { STEPS, type StepDef } from "./steps.js";
import type { RunState } from "./state.js";
import { kv, rule, section, stepLine } from "./ui.js";

export interface PlanItem {
  index: number;
  id: string;
  title: string;
  optional: boolean;
  action: "run" | "skip_done" | "skip_optional" | "skip_failed_blocked";
  currentStatus: string;
}

/**
 * Build the planned action list without mutating state.
 * Mirrors what apply would do next (idempotent skips included).
 */
export function buildPlan(state: RunState): PlanItem[] {
  const items: PlanItem[] = [];
  for (let i = 0; i < STEPS.length; i++) {
    const def = STEPS[i]!;
    const st = state.steps[i]!;
    let action: PlanItem["action"] = "run";

    if (st.status === "done" || st.status === "skipped") {
      action = "skip_done";
    } else if (def.optional && !state.config.runOptionalSteps) {
      action = "skip_optional";
    } else if (st.status === "failed") {
      action = "skip_failed_blocked";
    } else {
      action = "run";
    }

    items.push({
      index: i,
      id: def.id,
      title: def.title,
      optional: def.optional,
      action,
      currentStatus: st.status,
    });
  }
  return items;
}

export function formatPlan(state: RunState, items: PlanItem[]): string {
  const lines = [
    section("plan (read-only)"),
    kv("run", state.runId),
    kv("path", `${state.config.source} -> ${state.config.target} @ ${state.config.syncAlias}`),
    kv("party", state.config.partyId),
    kv("status", state.status),
    kv("runner", state.config.runner ?? "stub"),
    "",
  ];

  if (state.status === "failed") {
    lines.push(
      "  NOTE: run is failed - cro apply is blocked until cro resume",
      "        (plan still shows remaining work).",
      "",
    );
  }

  lines.push(rule());
  for (const it of items) {
    const tag =
      it.action === "run"
        ? "RUN"
        : it.action === "skip_done"
          ? "SKIP"
          : it.action === "skip_optional"
            ? "SKIP"
            : "BLOCK";
    const why =
      it.action === "skip_done"
        ? `done; status=${it.currentStatus}`
        : it.action === "skip_optional"
          ? "optional disabled"
          : it.action === "skip_failed_blocked"
            ? "failed - use resume"
            : `pending; status=${it.currentStatus}`;
    const title = it.optional ? `${it.title} (opt)` : it.title;
    lines.push(stepLine(it.index + 1, tag, it.id, title, why));
  }

  const toRun = items.filter((i) => i.action === "run").length;
  lines.push(rule());
  lines.push(`  Summary: ${toRun} step(s) would run on apply/resume`);
  return lines.join("\n");
}

export function plannedStepDefs(state: RunState): StepDef[] {
  return buildPlan(state)
    .filter((i) => i.action === "run")
    .map((i) => STEPS[i.index]!);
}
