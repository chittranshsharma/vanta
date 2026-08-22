import { isSupabaseConfigured, supabase } from "./supabase";
import { idempotencyKey, initialStatus, requiresApproval, type JobStatus, type JobType } from "../../shared/jobs/policy";

/**
 * Browser-side job client (Upgrade C). Members may enqueue, list, cancel,
 * and (admins) approve. Claiming and completing jobs is worker-only and
 * has no browser path by design.
 *
 * The `jobs` table exists only after migration 011 is applied; until then
 * every call returns a typed error rather than an empty success.
 */

export interface JobRow {
  id: string;
  workspace_id: string;
  created_by: string | null;
  job_type: JobType;
  status: JobStatus;
  idempotency_key: string;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  last_error: Record<string, unknown> | null;
  attempts: number;
  max_attempts: number;
  run_after: string;
  requires_approval: boolean;
  approved_by: string | null;
  approved_at: string | null;
  step_log: Array<Record<string, unknown>>;
  correlation_id: string;
  created_at: string;
  updated_at: string;
  finished_at: string | null;
}

type JobsResult<T> = { data: T; error: null } | { data: null; error: string };

const NOT_CONFIGURED = "Supabase is not configured.";

// The generated types predate migration 011; cast through a loose client until types are regenerated (D-1 step "regenerate types").
function jobsTable() {
  return (supabase as unknown as { from: (t: string) => ReturnType<typeof supabase.from> }).from("jobs");
}
function rpc(name: string, args: Record<string, unknown>) {
  return (supabase as unknown as { rpc: (n: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }> }).rpc(name, args);
}

export async function enqueueJob(input: {
  workspaceId: string;
  userId: string;
  jobType: JobType;
  /** Identifying inputs; drives the idempotency key. */
  keyParts: Record<string, string | number | boolean | null>;
  payload: Record<string, unknown>;
  maxAttempts?: number;
}): Promise<JobsResult<JobRow> & { duplicate?: boolean }> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  // G-3: per-workspace daily enqueue quota, consumed atomically before the insert. Fails closed on any RPC error.
  const quota = await rpc("consume_quota", { p_workspace_id: input.workspaceId, p_kind: "job_enqueue" });
  if (quota.error) return { data: null, error: `Quota check failed: ${quota.error.message}` };
  const q = (Array.isArray(quota.data) ? quota.data[0] : quota.data) as { allowed?: boolean; used?: number; daily_limit?: number } | null;
  if (!q || q.allowed !== true) {
    return { data: null, error: `Daily job quota reached (${q?.used ?? "?"} of ${q?.daily_limit ?? "?"}). Try again tomorrow or ask an operator to raise it.` };
  }
  const key = idempotencyKey(input.jobType, input.keyParts);
  const { data, error } = await jobsTable()
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      job_type: input.jobType,
      status: initialStatus(input.jobType),
      requires_approval: requiresApproval(input.jobType),
      idempotency_key: key,
      payload: input.payload,
      max_attempts: input.maxAttempts ?? 3,
    } as never)
    .select("*")
    .single();
  if (error) {
    // 23505 = unique_violation: same workspace + key already enqueued.
    if ((error as { code?: string }).code === "23505") {
      return { data: null, error: "An identical job is already queued or finished.", duplicate: true };
    }
    return { data: null, error: error.message };
  }
  return { data: data as unknown as JobRow, error: null };
}

export async function listJobs(workspaceId: string, limit = 50): Promise<JobsResult<JobRow[]>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  const { data, error } = await jobsTable()
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as JobRow[], error: null };
}

export async function cancelJob(jobId: string, workspaceId: string): Promise<JobsResult<JobRow>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  const { data, error } = await rpc("cancel_job", { p_job_id: jobId, p_workspace_id: workspaceId });
  if (error) return { data: null, error: error.message };
  return { data: data as JobRow, error: null };
}

export async function approveJob(jobId: string, workspaceId: string): Promise<JobsResult<JobRow>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  const { data, error } = await rpc("approve_job", { p_job_id: jobId, p_workspace_id: workspaceId });
  if (error) return { data: null, error: error.message };
  return { data: data as JobRow, error: null };
}
