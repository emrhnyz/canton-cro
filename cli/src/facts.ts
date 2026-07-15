import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { runDir } from "./state.js";

/**
 * Observable environment facts for preflight.
 * Stub era: filled by ops / tests via runs/<id>/facts.json (not Canton probes yet).
 */
export const PreflightFactsSchema = z.object({
  /** Step 0: two participants + synchronizer up */
  participantsReachable: z.boolean(),
  /** Step 0: health.ping between participants OK */
  healthPingOk: z.boolean(),
  /** Step 0: party hosted on source */
  partyHostedOnSource: z.boolean(),
  /** Step 1 pre: DARs used by party present on source */
  sourceHasPackages: z.boolean(),
  /** Step 1/3 pre: target still connected to synchronizer (before isolation) */
  targetConnectedToSync: z.boolean(),
  /** Step 3/6: operator will set requiresPartyToBeOnboarded = true */
  willSetOnboardingFlag: z.boolean(),
  /** Step 9: backup plan ready before import (pg_dump or documented equivalent) */
  backupPlanReady: z.boolean(),
  /** storage hint; memory => backup warning */
  storageKind: z.enum(["memory", "postgres", "unknown"]).default("unknown"),
  /**
   * Step 0 offline path preference: party already has contracts.
   * Baseline marks contract assert as "bilinmiyor" — warn only if explicitly false.
   */
  partyHasContracts: z.boolean().optional(),
});

export type PreflightFacts = z.infer<typeof PreflightFactsSchema>;

export function factsPath(runId: string, cwd = process.cwd()): string {
  return join(runDir(runId, cwd), "facts.json");
}

/** Stub defaults so local skeleton apply works until Canton facts are filled. */
export function defaultStubFacts(): PreflightFacts {
  return {
    participantsReachable: true,
    healthPingOk: true,
    partyHostedOnSource: true,
    sourceHasPackages: true,
    targetConnectedToSync: true,
    willSetOnboardingFlag: true,
    backupPlanReady: true,
    storageKind: "memory",
    partyHasContracts: true,
  };
}

export function writeFacts(runId: string, facts: PreflightFacts, cwd = process.cwd()): void {
  const path = factsPath(runId, cwd);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(facts, null, 2) + "\n", "utf8");
}

export function loadFacts(runId: string, cwd = process.cwd()): PreflightFacts {
  const path = factsPath(runId, cwd);
  if (!existsSync(path)) {
    throw new Error(
      `Facts not found: ${path}. Re-run cro init, or create facts.json for preflight.`,
    );
  }
  return PreflightFactsSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}
