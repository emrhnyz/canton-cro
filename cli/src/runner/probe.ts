import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RunConfig } from "../state.js";
import { runDir } from "../state.js";
import { loadFacts, writeFacts, type PreflightFacts } from "../facts.js";
import {
  execConsoleScript,
  parseCroVars,
  resolveCantonSettings,
} from "./canton.js";

/**
 * Live preflight probes (A7).
 *
 * When runner = canton, preflight facts come from ONE remote console run
 * instead of the operator-written facts.json. Probeable facts are observed;
 * operator-intent facts (backupPlanReady, willSetOnboardingFlag, storageKind)
 * stay declared in facts.json and are merged in. The merged result is written
 * back to facts.json with a probe stamp, so every preflight verdict is
 * auditable after the fact.
 *
 * Fail-safe: if the console cannot connect (daemon down, wrong ports), all
 * probed facts default to false -> preflight FAILS -> apply stays blocked.
 * A dead environment must never look green.
 */

/** Facts that the live probe can actually observe. */
export interface ProbedFacts {
  participantsReachable: boolean;
  healthPingOk: boolean;
  partyHostedOnSource: boolean;
  partyAlreadyOnTarget: boolean;
  sourceHasPackages: boolean;
  targetConnectedToSync: boolean;
  partyHasContracts: boolean;
}

/** Conservative defaults when the probe itself fails: everything false. */
export function failSafeProbedFacts(): ProbedFacts {
  return {
    participantsReachable: false,
    healthPingOk: false,
    partyHostedOnSource: false,
    partyAlreadyOnTarget: false,
    sourceHasPackages: false,
    targetConnectedToSync: false,
    partyHasContracts: false,
  };
}

/**
 * One console run gathers everything. Each probe is Try-wrapped so a single
 * failing command degrades that fact to its conservative default instead of
 * aborting the whole probe.
 */
export function buildProbeScript(p: {
  source: string;
  target: string;
  syncAlias: string;
  partyId: string;
}): string {
  return `
import com.digitalasset.canton.topology.PartyId

val croSource = ${p.source}
val croTarget = ${p.target}
val croPartyStr = "${p.partyId}"

def flag(name: String, v: Boolean): Unit = println(s"CRO_VAR $name=$v")
// try/catch instead of scala.util.Try: the 3.5.8 console REPL cannot load
// scala/util TASTy files ("Add -Ytasty-reader" errors on import scala.util._).
def safely(body: => Boolean): Boolean = try body catch { case _: Throwable => false }

// Baseline Adim 0: both nodes answer on their admin APIs.
flag("participantsReachable", safely { croSource.health.status; croTarget.health.status; true })

// Baseline Adim 0: cross-participant ping.
flag("healthPingOk", safely { croSource.health.ping(croTarget); true })

// Baseline Adim 0: party hosted on source (hosted = this node hosts it).
flag("partyHostedOnSource", safely { croSource.parties.hosted(filterParty = croPartyStr).nonEmpty })

// Replication-state hint: party already hosted on target -> likely a re-run.
flag("partyAlreadyOnTarget", safely { croTarget.parties.hosted(filterParty = croPartyStr).nonEmpty })

// Baseline Adim 1 pre: source has DAR packages uploaded.
flag("sourceHasPackages", safely { croSource.dars.list().nonEmpty })

// Baseline Adim 1/3 pre: target still connected (single-sync localnet: any connection).
flag("targetConnectedToSync", safely { croTarget.synchronizers.list_connected().nonEmpty })

// Baseline Adim 0: offline path expects a non-empty ACS for the party.
flag("partyHasContracts", safely {
  croSource.ledger_api.state.acs.of_party(PartyId.tryFromProtoPrimitive(croPartyStr)).nonEmpty
})

println("CRO_PROBE_OK")
`;
}

export function parseProbedFacts(stdout: string): ProbedFacts {
  const vars = parseCroVars(stdout);
  const b = (k: keyof ProbedFacts): boolean => vars[k] === "true";
  return {
    participantsReachable: b("participantsReachable"),
    healthPingOk: b("healthPingOk"),
    partyHostedOnSource: b("partyHostedOnSource"),
    partyAlreadyOnTarget: b("partyAlreadyOnTarget"),
    sourceHasPackages: b("sourceHasPackages"),
    targetConnectedToSync: b("targetConnectedToSync"),
    partyHasContracts: b("partyHasContracts"),
  };
}

/** Run the live probe. Throws only on launch-level bugs; console failure -> fail-safe. */
export function probeLiveFacts(
  runId: string,
  config: RunConfig,
  cwd = process.cwd(),
): { probed: ProbedFacts; note: string } {
  let settings;
  try {
    settings = resolveCantonSettings(config);
  } catch (err) {
    return {
      probed: failSafeProbedFacts(),
      note: `probe skipped: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const dir = runDir(runId, cwd);
  const scriptsDir = join(dir, "scripts");
  const logsDir = join(dir, "logs");
  mkdirSync(scriptsDir, { recursive: true });
  mkdirSync(logsDir, { recursive: true });

  const scriptPath = join(scriptsDir, "preflight-probe.sc");
  writeFileSync(
    scriptPath,
    buildProbeScript({
      source: config.source,
      target: config.target,
      syncAlias: config.syncAlias,
      partyId: config.partyId,
    }),
    "utf8",
  );

  const res = execConsoleScript(settings, scriptPath);
  const logPath = join(logsDir, "preflight-probe.log");
  writeFileSync(
    logPath,
    `# canton probe — exit=${res.status}\n--- stdout ---\n${res.stdout ?? ""}\n--- stderr ---\n${res.stderr ?? ""}`,
    "utf8",
  );

  const stdout = res.stdout ?? "";
  if (res.error || res.status !== 0 || !stdout.includes("CRO_PROBE_OK")) {
    return {
      probed: failSafeProbedFacts(),
      note:
        `live probe failed (exit=${res.status ?? "spawn-error"}) — treating environment as DOWN ` +
        `(all probed facts false); log: ${logPath}`,
    };
  }
  return { probed: parseProbedFacts(stdout), note: `live probe ok (log: ${logPath})` };
}

/**
 * Preflight fact source, used by both `cro preflight` and the apply gate.
 * stub runner: declared facts.json (unchanged behavior).
 * canton runner: live probe merged over declared facts, persisted with a stamp.
 */
export function gatherFacts(
  runId: string,
  config: RunConfig,
  cwd = process.cwd(),
): PreflightFacts {
  const declared = loadFacts(runId, cwd);
  if (config.runner !== "canton") {
    return declared;
  }
  const { probed, note } = probeLiveFacts(runId, config, cwd);
  const merged: PreflightFacts = {
    ...declared,
    ...probed,
    probe: { at: new Date().toISOString(), source: "live-canton-probe", note },
  };
  writeFacts(runId, merged, cwd);
  return merged;
}
