/** Step IDs aligned with docs/manual-baseline.md offline party replication order. */

export type StepId =
  | "vet_packages"
  | "data_retention"
  | "target_authorize"
  | "disconnect_all"
  | "disable_auto_reconnect"
  | "source_authorize"
  | "export_acs"
  | "reenable_pruning"
  | "backup_target"
  | "import_acs"
  | "reconnect"
  | "reenable_auto_reconnect"
  | "clear_onboarding_flag";

export type StepStatus = "pending" | "running" | "done" | "skipped" | "failed";

export interface StepDef {
  id: StepId;
  title: string;
  /** Docs optional steps: re-enable pruning / auto-reconnect */
  optional: boolean;
}

export const STEPS: readonly StepDef[] = [
  { id: "vet_packages", title: "Target: package vetting", optional: false },
  { id: "data_retention", title: "Source: data retention (clear pruning schedule)", optional: false },
  { id: "target_authorize", title: "Target: hosting authorization (onboarding)", optional: false },
  { id: "disconnect_all", title: "Target: disconnect all synchronizers", optional: false },
  { id: "disable_auto_reconnect", title: "Target: disable auto-reconnect", optional: false },
  { id: "source_authorize", title: "Source: party authorization + offset", optional: false },
  { id: "export_acs", title: "Source: ACS export", optional: false },
  { id: "reenable_pruning", title: "Source: re-enable automatic pruning", optional: true },
  { id: "backup_target", title: "Target: backup before ACS import", optional: false },
  { id: "import_acs", title: "Target: ACS import", optional: false },
  { id: "reconnect", title: "Target: reconnect to synchronizer", optional: false },
  { id: "reenable_auto_reconnect", title: "Target: re-enable auto-reconnect", optional: true },
  { id: "clear_onboarding_flag", title: "Target: clear onboarding flag", optional: false },
] as const;
