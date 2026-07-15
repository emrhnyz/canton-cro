import type { StepId } from "./steps.js";

export const FAULT_INJECTIONS = ["none", "broken-acs-import", "partial-acs-import"] as const;
export type FaultInjection = (typeof FAULT_INJECTIONS)[number];

export interface AcsFaultDiagnosis {
  fault: Exclude<FaultInjection, "none">;
  step: StepId;
  code: string;
  summary: string;
  observed: string[];
  safeStop: true;
  doNot: string[];
  nextActions: string[];
  baselineRef: string;
}

export class AcsImportFaultError extends Error {
  readonly diagnosis: AcsFaultDiagnosis;

  constructor(diagnosis: AcsFaultDiagnosis) {
    super(`${diagnosis.code}: ${diagnosis.summary}`);
    this.name = "AcsImportFaultError";
    this.diagnosis = diagnosis;
  }
}

export function diagnoseBrokenAcsImport(partyId: string): AcsFaultDiagnosis {
  return {
    fault: "broken-acs-import",
    step: "import_acs",
    code: "ACS_COMMITMENT_MISMATCH_OR_CORRUPT_SNAPSHOT",
    summary: `Simulated broken/corrupt ACS import for party ${partyId}`,
    observed: [
      "ACS snapshot failed validation or is truncated/corrupt",
      "Target ACS no longer matches source commitments (symptom class: ACS_COMMITMENT_MISMATCH)",
      "Import aborted before a consistent party ACS was established",
    ],
    safeStop: true,
    doNot: [
      "Do not reconnect the target to synchronizers with a half-imported ACS",
      "Do not clear the onboarding flag",
      "Do not continue apply; remaining steps stay pending",
    ],
    nextActions: [
      "Restore target participant from the backup taken before import (baseline step backup_target)",
      "Re-export ACS from source if the snapshot file is suspect",
      "Fix faultInjection to none (or remove --fault), then: cro resume --run <id>",
    ],
    baselineRef:
      "docs/manual-baseline.md steps 9-10; Canton DR: ACS_COMMITMENT_MISMATCH after failed import",
  };
}

export function diagnosePartialAcsImport(partyId: string): AcsFaultDiagnosis {
  return {
    fault: "partial-acs-import",
    step: "import_acs",
    code: "ACS_IMPORT_INCOMPLETE",
    summary: `Simulated partial ACS import (incomplete contract set) for party ${partyId}`,
    observed: [
      "Import interrupted mid-stream: only a subset of active contracts landed on target",
      "Party may appear hosted while ACS is incomplete",
      "Subsequent ledger activity risks commitment / confirmation failures",
    ],
    safeStop: true,
    doNot: [
      "Do not reconnect until ACS is restored to a clean backup",
      "Do not treat intermittent ACS commitment noise during happy-path onboarding the same as this failure (baseline: expected only during successful onboarding)",
    ],
    nextActions: [
      "Restore target from pre-import backup",
      "Retry full import with a complete export file",
      "Clear faultInjection, then: cro resume --run <id>",
    ],
    baselineRef: "docs/manual-baseline.md steps 9-10 (interrupted import -> backup reset)",
  };
}

export function formatDiagnosis(d: AcsFaultDiagnosis): string {
  const lines = [
    "=== CRO DIAGNOSIS (safe stop) ===",
    `fault:     ${d.fault}`,
    `step:      ${d.step}`,
    `code:      ${d.code}`,
    `summary:   ${d.summary}`,
    `safeStop:  ${d.safeStop}`,
    "",
    "observed:",
    ...d.observed.map((o) => `  - ${o}`),
    "",
    "do NOT:",
    ...d.doNot.map((o) => `  - ${o}`),
    "",
    "next:",
    ...d.nextActions.map((o) => `  - ${o}`),
    "",
    `baseline: ${d.baselineRef}`,
    "=== END DIAGNOSIS ===",
  ];
  return lines.join("\n");
}
