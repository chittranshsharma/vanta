/**
 * Worker loop, separated from I/O so it can be unit-tested with fakes.
 */

import type { JobStatus, JobType } from "../../../shared/jobs/policy.js";

export interface WorkerJob {
  id: string;
  workspace_id: string;
  job_type: JobType;
  status: JobStatus;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  correlation_id: string;
}

export type HandlerFailure = { kind: "transient" | "permanent"; message: string; code?: string };

export type HandlerResult =
  | { ok: true; result: Record<string, unknown> }
  | { ok: false; failure: HandlerFailure };

export type JobHandler = (job: WorkerJob, signal: { deadlineMs: number }) => Promise<HandlerResult>;

export interface WorkerDeps {
  workerId: string;
  jobTypes: JobType[];
  releaseStale: () => Promise<number>;
  claim: (jobTypes: JobType[]) => Promise<WorkerJob | null>;
  complete: (job: WorkerJob, result: Record<string, unknown>) => Promise<void>;
  fail: (job: WorkerJob, failure: HandlerFailure) => Promise<void>;
  handlers: Partial<Record<JobType, JobHandler>>;
  log: (level: "info" | "warn" | "error", msg: string, fields?: Record<string, unknown>) => void;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
}

export interface LoopOptions {
  pollIntervalMs: number;
  shouldStop: () => boolean;
  /** Per-job wall clock budget. Handlers receive the deadline and must respect it. */
  jobTimeoutMs?: number;
  /** For tests: stop after this many claim attempts. */
  maxIterations?: number;
}

/** Processes one claimed job. Exported for tests. Never throws. */
export async function processJob(deps: WorkerDeps, job: WorkerJob, jobTimeoutMs: number): Promise<"succeeded" | "failed" | "unhandled"> {
  const handler = deps.handlers[job.job_type];
  const fields = { job_id: job.id, job_type: job.job_type, workspace_id: job.workspace_id, attempt: job.attempts, correlation_id: job.correlation_id };
  if (!handler) {
    // Should not happen: claim() filters by registered types. Treat as permanent so it cannot loop.
    deps.log("error", "no handler registered", fields);
    await deps.fail(job, { kind: "permanent", message: `no handler for ${job.job_type}` });
    return "unhandled";
  }

  const deadlineMs = deps.now() + jobTimeoutMs;
  let outcome: HandlerResult;
  try {
    outcome = await Promise.race([
      handler(job, { deadlineMs }),
      deps.sleep(jobTimeoutMs).then<HandlerResult>(() => ({ ok: false, failure: { kind: "transient", message: "job timed out", code: "timeout" } })),
    ]);
  } catch (err) {
    outcome = { ok: false, failure: { kind: "transient", message: err instanceof Error ? err.message : "handler threw", code: "exception" } };
  }

  if (outcome.ok) {
    await deps.complete(job, outcome.result);
    deps.log("info", "job succeeded", fields);
    return "succeeded";
  }
  await deps.fail(job, outcome.failure);
  deps.log("warn", "job failed", { ...fields, kind: outcome.failure.kind, code: outcome.failure.code ?? null });
  return "failed";
}

export async function runLoop(deps: WorkerDeps, opts: LoopOptions): Promise<void> {
  const timeout = opts.jobTimeoutMs ?? 5 * 60 * 1000;
  try {
    const released = await deps.releaseStale();
    if (released > 0) deps.log("warn", "released stale locks", { count: released });
  } catch (err) {
    deps.log("error", "release_stale_jobs failed", { message: err instanceof Error ? err.message : String(err) });
  }

  let iterations = 0;
  while (!opts.shouldStop()) {
    if (opts.maxIterations !== undefined && iterations >= opts.maxIterations) break;
    iterations += 1;

    let job: WorkerJob | null;
    try {
      job = await deps.claim(deps.jobTypes);
    } catch (err) {
      deps.log("error", "claim failed", { message: err instanceof Error ? err.message : String(err) });
      await deps.sleep(opts.pollIntervalMs);
      continue;
    }

    if (!job) {
      await deps.sleep(opts.pollIntervalMs);
      continue;
    }

    try {
      await processJob(deps, job, timeout);
    } catch (err) {
      // complete/fail RPC itself failed; the stale-lock sweeper will recover the job.
      deps.log("error", "job finalization failed", { job_id: job.id, message: err instanceof Error ? err.message : String(err) });
    }
  }
}
