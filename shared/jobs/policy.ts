/**
 * Job policy shared by the browser client, the Edge Function, and the Node worker.
 * Pure functions only. Mirrors the state machine enforced by migration 011.
 */

export type JobType =
  | "model_task"
  | "campaign_csv_normalize"
  | "media_probe"
  | "source_refresh"
  | "embedding_refresh"
  | "conversation_import_validate"
  | "conversation_deduplicate"
  | "conversation_interpretation_proposal"
  | "conversation_attribution"
  | "conversation_aggregate"
  | "simulation_validate"
  | "simulation_execute"
  | "simulation_review_ready"
  | "simulation_observed_link";

export type JobStatus =
  | "awaiting_approval"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "dead"
  | "cancelled";

export const JOB_TYPES: readonly JobType[] = [
  "model_task",
  "campaign_csv_normalize",
  "media_probe",
  "source_refresh",
  "embedding_refresh",
  "conversation_import_validate",
  "conversation_deduplicate",
  "conversation_interpretation_proposal",
  "conversation_attribution",
  "conversation_aggregate",
  "simulation_validate",
  "simulation_execute",
  "simulation_review_ready",
  "simulation_observed_link",
] as const;

/**
 * Every legal status, as runtime values. Generated Supabase types cannot
 * express the CHECK constraint behind `jobs.status`, so the client narrows the
 * `string` it receives against this list instead of asserting a type.
 */
export const JOB_STATUSES: readonly JobStatus[] = [
  "awaiting_approval",
  "queued",
  "running",
  "succeeded",
  "failed",
  "dead",
  "cancelled",
] as const;

export const TERMINAL_STATUSES: ReadonlySet<JobStatus> = new Set(["succeeded", "dead", "cancelled"]);

/** Legal transitions. Anything not listed is rejected by the RPCs. */
export const TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  awaiting_approval: ["queued", "cancelled"],
  queued: ["running", "cancelled"],
  running: ["succeeded", "queued", "dead"],
  succeeded: [],
  failed: ["queued", "dead"],
  dead: [],
  cancelled: [],
};

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Job types whose side effects require a human gate before they may run. */
export const APPROVAL_REQUIRED: ReadonlySet<JobType> = new Set(["source_refresh"]);

export function requiresApproval(jobType: JobType): boolean {
  return APPROVAL_REQUIRED.has(jobType);
}

export function initialStatus(jobType: JobType): JobStatus {
  return requiresApproval(jobType) ? "awaiting_approval" : "queued";
}

/**
 * Exponential backoff with full jitter, capped. attempt is 1-based (the attempt that just failed).
 * random is injected for deterministic tests.
 */
export function retryDelaySeconds(attempt: number, random: () => number = Math.random): number {
  const base = 30;
  const cap = 15 * 60;
  const exp = Math.min(cap, base * 2 ** Math.max(0, attempt - 1));
  return Math.max(1, Math.floor(random() * exp));
}

export type FailureKind = "transient" | "permanent";

export interface FailureDecision {
  nextStatus: "queued" | "dead";
  retryDelaySeconds: number;
}

/** What fail_job will do, computed client-side so workers and UI agree. */
export function decideOnFailure(input: {
  attempts: number;
  maxAttempts: number;
  kind: FailureKind;
  random?: () => number;
}): FailureDecision {
  if (input.kind === "permanent" || input.attempts >= input.maxAttempts) {
    return { nextStatus: "dead", retryDelaySeconds: 0 };
  }
  return { nextStatus: "queued", retryDelaySeconds: retryDelaySeconds(input.attempts, input.random) };
}

/**
 * Deterministic idempotency key from the job's identifying inputs. Same
 * workspace + type + inputs = same key = UNIQUE(workspace_id, idempotency_key)
 * refuses the duplicate enqueue.
 */
export function idempotencyKey(jobType: JobType, parts: Record<string, string | number | boolean | null>): string {
  const ordered = Object.keys(parts)
    .sort()
    .map((k) => `${k}=${String(parts[k])}`)
    .join("&");
  return `${jobType}:${ordered}`;
}

/** Lock age after which a running job is presumed orphaned. */
export const STALE_LOCK_SECONDS = 15 * 60;
