import type { RunConfig } from "../state.js";
import type { StepId } from "../steps.js";
import {
  AcsImportFaultError,
  diagnoseBrokenAcsImport,
  diagnosePartialAcsImport,
} from "../fault.js";

export interface StepContext {
  runId: string;
  stepId: StepId;
  config: RunConfig;
}

export interface StepResult {
  ok: true;
  message: string;
}

/**
 * Stub runner: no Canton Admin API / console calls.
 * Optionally injects broken/partial ACS import faults at import_acs.
 */
export async function runStubStep(ctx: StepContext): Promise<StepResult> {
  const { source, target, syncAlias, partyId, faultInjection } = ctx.config;

  if (ctx.stepId === "import_acs" && faultInjection && faultInjection !== "none") {
    if (faultInjection === "broken-acs-import") {
      throw new AcsImportFaultError(diagnoseBrokenAcsImport(partyId));
    }
    if (faultInjection === "partial-acs-import") {
      throw new AcsImportFaultError(diagnosePartialAcsImport(partyId));
    }
  }

  return {
    ok: true,
    message: `stub ok: ${ctx.stepId} (party=${partyId}, ${source}→${target}, sync=${syncAlias})`,
  };
}
