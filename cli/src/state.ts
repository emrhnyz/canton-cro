import { mkdirSync, readFileSync, writeFileSync, appendFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { STEPS, type StepId, type StepStatus } from "./steps.js";
import { FAULT_INJECTIONS } from "./fault.js";

export const RunConfigSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  syncAlias: z.string().min(1),
  partyId: z.string().min(1),
  /** When false, optional steps are marked skipped on init/apply. Default true. */
  runOptionalSteps: z.boolean().default(true),
  /** Fault injection at import_acs (drill). Default none. */
  faultInjection: z.enum(FAULT_INJECTIONS).default("none"),
  /** Step executor: stub (simulated, default) or canton (real remote console). */
  runner: z.enum(["stub", "canton"]).optional(),
  /** Canton adapter settings (used when runner = canton). */
  canton: z
    .object({
      /** Path to canton executable (bin/canton or bin\\canton.bat). */
      bin: z.string().min(1),
      /** Remote console config, e.g. localnet/remote-topology.conf. */
      remoteConf: z.string().min(1),
      /** DAR to upload/vet on target (vet_packages). */
      darPath: z.string().optional(),
    })
    .optional(),
});

export type RunConfig = z.infer<typeof RunConfigSchema>;

export interface StepState {
  id: StepId;
  status: StepStatus;
  optional: boolean;
  error?: string;
  updatedAt?: string;
}

export interface RunState {
  runId: string;
  status: "idle" | "running" | "failed" | "completed";
  config: RunConfig;
  steps: StepState[];
  /** Index of next step to execute (or failed step for resume). */
  cursor: number;
  createdAt: string;
  updatedAt: string;
}

export function runsRoot(cwd = process.cwd()): string {
  return join(cwd, "runs");
}

export function runDir(runId: string, cwd = process.cwd()): string {
  return join(runsRoot(cwd), runId);
}

export function statePath(runId: string, cwd = process.cwd()): string {
  return join(runDir(runId, cwd), "state.json");
}

export function configPath(runId: string, cwd = process.cwd()): string {
  return join(runDir(runId, cwd), "config.json");
}

export function eventsPath(runId: string, cwd = process.cwd()): string {
  return join(runDir(runId, cwd), "events.jsonl");
}

export function appendEvent(runId: string, event: Record<string, unknown>, cwd = process.cwd()): void {
  const path = eventsPath(runId, cwd);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n", "utf8");
}

export function loadConfig(runId: string, cwd = process.cwd(), overridePath?: string): RunConfig {
  const path = overridePath ?? configPath(runId, cwd);
  if (!existsSync(path)) {
    throw new Error(`Config not found: ${path}`);
  }
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return RunConfigSchema.parse(raw);
}

export function loadState(runId: string, cwd = process.cwd()): RunState {
  const path = statePath(runId, cwd);
  if (!existsSync(path)) {
    throw new Error(`State not found: ${path}. Run: cro init --run ${runId}`);
  }
  return JSON.parse(readFileSync(path, "utf8")) as RunState;
}

export function saveState(state: RunState, cwd = process.cwd()): void {
  const path = statePath(state.runId, cwd);
  mkdirSync(dirname(path), { recursive: true });
  state.updatedAt = new Date().toISOString();
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n", "utf8");
}

export function createInitialState(runId: string, config: RunConfig): RunState {
  const now = new Date().toISOString();
  return {
    runId,
    status: "idle",
    config,
    steps: STEPS.map((s) => ({
      id: s.id,
      status: "pending" as StepStatus,
      optional: s.optional,
    })),
    cursor: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function writeConfig(runId: string, config: RunConfig, cwd = process.cwd()): void {
  const path = configPath(runId, cwd);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n", "utf8");
}

export function preflightResultPath(runId: string, cwd = process.cwd()): string {
  return join(runDir(runId, cwd), "preflight-last.json");
}

export function writePreflightResult(
  runId: string,
  report: { ok: boolean; at: string; errorIds: string[] },
  cwd = process.cwd(),
): void {
  const path = preflightResultPath(runId, cwd);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(report, null, 2) + "\n", "utf8");
}

export function diagnosisPath(runId: string, cwd = process.cwd()): string {
  return join(runDir(runId, cwd), "diagnosis.json");
}

export function writeDiagnosis(
  runId: string,
  diagnosis: Record<string, unknown>,
  cwd = process.cwd(),
): void {
  const path = diagnosisPath(runId, cwd);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(diagnosis, null, 2) + "\n", "utf8");
}
