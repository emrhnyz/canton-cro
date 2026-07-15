import type { RunConfig } from "./state.js";
import type { PreflightFacts } from "./facts.js";

export type CheckSeverity = "error" | "warn" | "info";

export interface PreflightCheck {
  id: string;
  /** Baseline step reference */
  baselineRef: string;
  severity: CheckSeverity;
  description: string;
  evaluate: (ctx: { config: RunConfig; facts: PreflightFacts }) => {
    pass: boolean;
    detail: string;
  };
}

/**
 * Preflight rules derived from docs/manual-baseline.md pre/post conditions
 * that can be asserted before apply (via facts in stub era).
 */
export const PREFLIGHT_CHECKS: readonly PreflightCheck[] = [
  {
    id: "config_source_neq_target",
    baselineRef: "Adım 0 / senaryo",
    severity: "error",
    description: "Source and target participant aliases must differ",
    evaluate: ({ config }) => {
      const pass = config.source !== config.target;
      return {
        pass,
        detail: pass
          ? `${config.source} ≠ ${config.target}`
          : `source and target are both '${config.source}'`,
      };
    },
  },
  {
    id: "config_party_id",
    baselineRef: "Adım 0",
    severity: "error",
    description: "partyId must be set (party hosted on source)",
    evaluate: ({ config }) => {
      const pass = config.partyId.trim().length > 0 && !config.partyId.includes(" ");
      return {
        pass,
        detail: pass ? `partyId=${config.partyId}` : "partyId empty or invalid",
      };
    },
  },
  {
    id: "participants_reachable",
    baselineRef: "Adım 0 pre: iki participant + synchronizer ayakta",
    severity: "error",
    description: "Participants and synchronizer must be reachable",
    evaluate: ({ facts }) => ({
      pass: facts.participantsReachable,
      detail: facts.participantsReachable
        ? "participantsReachable=true"
        : "participantsReachable=false",
    }),
  },
  {
    id: "health_ping_ok",
    baselineRef: "Adım 0 pre: health.ping",
    severity: "error",
    description: "Cross-participant health.ping must succeed",
    evaluate: ({ facts }) => ({
      pass: facts.healthPingOk,
      detail: facts.healthPingOk ? "healthPingOk=true" : "healthPingOk=false",
    }),
  },
  {
    id: "party_hosted_on_source",
    baselineRef: "Adım 0 pre: party source üzerinde host",
    severity: "error",
    description: "Party must be hosted on the source participant",
    evaluate: ({ facts }) => ({
      pass: facts.partyHostedOnSource,
      detail: facts.partyHostedOnSource
        ? "partyHostedOnSource=true"
        : "partyHostedOnSource=false",
    }),
  },
  {
    id: "source_has_packages",
    baselineRef: "Adım 1 pre: source’ta party DAR(ları) yüklü",
    severity: "error",
    description: "Source participant must have packages for the party",
    evaluate: ({ facts }) => ({
      pass: facts.sourceHasPackages,
      detail: facts.sourceHasPackages
        ? "sourceHasPackages=true"
        : "sourceHasPackages=false",
    }),
  },
  {
    id: "target_connected_before_isolation",
    baselineRef: "Adım 1/3 pre: target synchronizer’a bağlı (isolation öncesi)",
    severity: "error",
    description: "Target must still be connected to synchronizer before isolation steps",
    evaluate: ({ facts }) => ({
      pass: facts.targetConnectedToSync,
      detail: facts.targetConnectedToSync
        ? "targetConnectedToSync=true"
        : "targetConnectedToSync=false",
    }),
  },
  {
    id: "onboarding_flag_required",
    baselineRef: "Adım 3/6 warning: requiresPartyToBeOnboarded = true",
    severity: "error",
    description: "Operator must confirm onboarding flag will be set",
    evaluate: ({ facts }) => ({
      pass: facts.willSetOnboardingFlag,
      detail: facts.willSetOnboardingFlag
        ? "willSetOnboardingFlag=true"
        : "willSetOnboardingFlag=false — docs require onboarding flag",
    }),
  },
  {
    id: "backup_before_import",
    baselineRef: "Adım 9: Target backup zorunlu (ACS import öncesi)",
    severity: "error",
    description: "Backup plan must be ready before ACS import",
    evaluate: ({ facts }) => ({
      pass: facts.backupPlanReady,
      detail: facts.backupPlanReady
        ? "backupPlanReady=true"
        : "backupPlanReady=false — docs: must back up target before import",
    }),
  },
  {
    id: "memory_storage_backup_note",
    baselineRef: "Adım 9 LocalNet notu: memory → pg_dump yok",
    severity: "warn",
    description: "Memory storage has no pg_dump path; backup procedure is operator-defined",
    evaluate: ({ facts }) => {
      if (facts.storageKind !== "memory") {
        return { pass: true, detail: `storageKind=${facts.storageKind}` };
      }
      return {
        pass: true,
        detail:
          "storageKind=memory — baseline: meaningful backup bilinmiyor/doğrulanacak; ensure backupPlanReady reflects your procedure",
      };
    },
  },
  {
    id: "party_has_contracts_offline_path",
    baselineRef: "Adım 0: offline yol için contracts (assert bilinmiyor → warn)",
    severity: "warn",
    description: "Offline path expects party already used in Daml txs when known",
    evaluate: ({ facts }) => {
      if (facts.partyHasContracts === undefined) {
        return {
          pass: true,
          detail: "partyHasContracts unset — baseline marks contract assert as bilinmiyor",
        };
      }
      if (facts.partyHasContracts) {
        return { pass: true, detail: "partyHasContracts=true" };
      }
      return {
        pass: true,
        detail:
          "partyHasContracts=false — docs suggest simple replication if party never participated; offline may be wrong path",
      };
    },
  },
  {
    id: "party_not_already_on_target",
    baselineRef: "Adım 3/10: target party'yi replication İLE almalı (öncesinde değil)",
    severity: "warn",
    description: "Party should not already be hosted on target before replication",
    evaluate: ({ facts }) => {
      if (facts.partyAlreadyOnTarget === true) {
        return {
          pass: true,
          detail:
            "partyAlreadyOnTarget=true — replication may already be complete or in progress; " +
            "resume the original run instead of starting a fresh one",
        };
      }
      return {
        pass: true,
        detail:
          facts.partyAlreadyOnTarget === false
            ? "partyAlreadyOnTarget=false"
            : "partyAlreadyOnTarget unset (stub facts — live probe fills this)",
      };
    },
  },
  {
    id: "acs_mismatch_expected_info",
    baselineRef: "Beklenen gürültü: onboarding ACS commitment mismatch",
    severity: "info",
    description: "ACS commitment mismatches during onboarding are expected",
    evaluate: () => ({
      pass: true,
      detail: "Do not treat expected ACS_COMMITMENT_MISMATCH during onboarding as import failure",
    }),
  },
];

export interface CheckResult {
  id: string;
  baselineRef: string;
  severity: CheckSeverity;
  description: string;
  pass: boolean;
  detail: string;
}

export interface PreflightReport {
  ok: boolean;
  errors: CheckResult[];
  warnings: CheckResult[];
  infos: CheckResult[];
  results: CheckResult[];
}

export function evaluatePreflight(
  config: RunConfig,
  facts: PreflightFacts,
  checks: readonly PreflightCheck[] = PREFLIGHT_CHECKS,
): PreflightReport {
  const results: CheckResult[] = checks.map((c) => {
    const { pass, detail } = c.evaluate({ config, facts });
    return {
      id: c.id,
      baselineRef: c.baselineRef,
      severity: c.severity,
      description: c.description,
      pass,
      detail,
    };
  });

  const errors = results.filter((r) => r.severity === "error" && !r.pass);
  const warnings = results.filter((r) => r.severity === "warn");
  const infos = results.filter((r) => r.severity === "info");

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    infos,
    results,
  };
}

export function formatPreflightReport(report: PreflightReport): string {
  const lines = [
    `preflight: ${report.ok ? "PASS" : "FAIL"}`,
    "",
  ];
  for (const r of report.results) {
    const mark =
      r.severity === "error"
        ? r.pass
          ? "OK "
          : "ERR"
        : r.severity === "warn"
          ? "WRN"
          : "INF";
    lines.push(`[${mark}] ${r.id}`);
    lines.push(`      ${r.description}`);
    lines.push(`      baseline: ${r.baselineRef}`);
    lines.push(`      ${r.detail}`);
  }
  if (!report.ok) {
    lines.push("");
    lines.push(`blocked: ${report.errors.length} error(s) — fix facts/config before cro apply`);
  }
  return lines.join("\n");
}
