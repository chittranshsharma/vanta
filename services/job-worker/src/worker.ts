/**
 * Vanta job worker (Upgrade C, step 2: Node worker for reliable multi-step work).
 *
 * Runs outside the browser with the service-role key, which never leaves
 * this process. Claims jobs through the claim_next_job RPC (SKIP LOCKED),
 * dispatches to a typed handler, and reports success or failure through
 * complete_job / fail_job. Retry and dead-letter policy is shared with the
 * browser client (shared/jobs/policy.ts) so every surface agrees.
 *
 * Not deployed. Run locally with:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm start
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { STALE_LOCK_SECONDS, decideOnFailure, type JobType } from "../../../shared/jobs/policy.js";
import { runLoop, type JobHandler, type WorkerDeps, type WorkerJob } from "./loop.js";
import { campaignCsvNormalizeHandler } from "./handlers/campaignCsvNormalize.js";
import { makeMediaProbeHandler } from "./handlers/mediaProbe.js";
import { makeEmbeddingRefreshHandler } from "./handlers/embeddingRefresh.js";
import { makeSourceRefreshHandler } from "./handlers/sourceRefresh.js";

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("[job-worker] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required. Exiting.");
  process.exit(2);
}

const workerId = `${process.env.HOSTNAME ?? "local"}-${randomUUID().slice(0, 8)}`;
const supabase: SupabaseClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

/** Handlers are registered per job type. Unregistered types are never claimed. */
const handlers: Partial<Record<JobType, JobHandler>> = {
  campaign_csv_normalize: campaignCsvNormalizeHandler,
  media_probe: makeMediaProbeHandler(supabase),
  embedding_refresh: makeEmbeddingRefreshHandler(supabase),
  source_refresh: makeSourceRefreshHandler(supabase),
};

const deps: WorkerDeps = {
  workerId,
  jobTypes: Object.keys(handlers) as JobType[],
  async releaseStale() {
    const { data, error } = await supabase.rpc("release_stale_jobs", { p_older_than_seconds: STALE_LOCK_SECONDS });
    if (error) throw new Error(error.message);
    return typeof data === "number" ? data : 0;
  },
  async claim(jobTypes) {
    const { data, error } = await supabase.rpc("claim_next_job", { p_worker_id: workerId, p_job_types: jobTypes });
    if (error) throw new Error(error.message);
    return (data as WorkerJob | null) ?? null;
  },
  async complete(job, result) {
    const { error } = await supabase.rpc("complete_job", { p_job_id: job.id, p_worker_id: workerId, p_result: result });
    if (error) throw new Error(error.message);
  },
  async fail(job, failure) {
    const decision = decideOnFailure({ attempts: job.attempts, maxAttempts: job.max_attempts, kind: failure.kind });
    const { error } = await supabase.rpc("fail_job", {
      p_job_id: job.id,
      p_worker_id: workerId,
      p_error: { kind: failure.kind, message: failure.message, code: failure.code ?? null },
      p_retriable: failure.kind === "transient",
      p_retry_delay_seconds: decision.retryDelaySeconds,
    });
    if (error) throw new Error(error.message);
  },
  handlers,
  log: (level, msg, fields) => {
    // Structured, single-line JSON logs (Upgrade G). Never include payload contents.
    console[level === "error" ? "error" : "log"](JSON.stringify({ ts: new Date().toISOString(), level, worker: workerId, msg, ...fields }));
  },
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
  now: () => Date.now(),
};

let stopping = false;
process.on("SIGINT", () => { stopping = true; });
process.on("SIGTERM", () => { stopping = true; });

runLoop(deps, { pollIntervalMs: 2000, shouldStop: () => stopping }).then(() => {
  deps.log("info", "worker stopped");
  process.exit(0);
});
