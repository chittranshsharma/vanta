import { isSupabaseConfigured, supabase } from "./supabase";
import { jsonObject, jsonObjectArray, narrow, type JsonObject } from "./rows";
import type { Tables } from "../types/database.types";
import {
  JOB_STATUSES,
  JOB_TYPES,
  idempotencyKey,
  initialStatus,
  requiresApproval,
  type JobStatus,
  type JobType,
} from "../../shared/jobs/policy";

/**
 * Browser-side job client (Upgrade C). Members may enqueue, list, cancel,
 * and (admins) approve. Claiming and completing jobs is worker-only and
 * has no browser path by design.
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
const SCHEMA_AHEAD = "The database schema is ahead of this build; reload or update the app.";

/**
 * Reads one stored row into the domain shape, or returns the reason it could
 * not be read. `job_type` and `status` are CHECK-constrained in the database
 * but arrive as `string`, so they are narrowed against the shared policy lists
 * rather than asserted: a value this build does not know is reported, not shown
 * as some nearby status it happens to understand.
 */
export function toJobRow(row: Tables<"jobs">): JobRow | string {
  const job_type = narrow(JOB_TYPES, row.job_type);
  if (!job_type) return `job ${row.id} has job_type "${row.job_type}"`;
  const status = narrow(JOB_STATUSES, row.status);
  if (!status) return `job ${row.id} has status "${row.status}"`;
  const payload = jsonObject(row.payload);
  if (!payload) return `job ${row.id} has a payload that is not a JSON object`;
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    created_by: row.created_by,
    job_type,
    status,
    idempotency_key: row.idempotency_key,
    payload,
    result: jsonObject(row.result),
    last_error: jsonObject(row.last_error),
    attempts: row.attempts,
    max_attempts: row.max_attempts,
    run_after: row.run_after,
    requires_approval: row.requires_approval,
    approved_by: row.approved_by,
    approved_at: row.approved_at,
    step_log: jsonObjectArray(row.step_log),
    correlation_id: row.correlation_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
    finished_at: row.finished_at,
  };
}

function readOne(row: Tables<"jobs"> | null): JobsResult<JobRow> {
  if (!row) return { data: null, error: "The database returned no job row." };
  const mapped = toJobRow(row);
  if (typeof mapped === "string") return { data: null, error: `Cannot read ${mapped}. ${SCHEMA_AHEAD}` };
  return { data: mapped, error: null };
}

export async function enqueueJob(input: {
  workspaceId: string;
  userId: string;
  jobType: JobType;
  /** Identifying inputs; drives the idempotency key. */
  keyParts: Record<string, string | number | boolean | null>;
  payload: JsonObject;
  maxAttempts?: number;
}): Promise<JobsResult<JobRow> & { duplicate?: boolean }> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  // G-3: per-workspace daily enqueue quota, consumed atomically before the insert. Fails closed on any RPC error.
  const quota = await supabase.rpc("consume_quota", { p_workspace_id: input.workspaceId, p_kind: "job_enqueue" });
  if (quota.error) return { data: null, error: `Quota check failed: ${quota.error.message}` };
  const q = quota.data?.[0] ?? null;
  if (!q || q.allowed !== true) {
    return { data: null, error: `Daily job quota reached (${q?.used ?? "?"} of ${q?.daily_limit ?? "?"}). Try again tomorrow or ask an operator to raise it.` };
  }
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      workspace_id: input.workspaceId,
      created_by: input.userId,
      job_type: input.jobType,
      status: initialStatus(input.jobType),
      requires_approval: requiresApproval(input.jobType),
      idempotency_key: idempotencyKey(input.jobType, input.keyParts),
      payload: input.payload,
      max_attempts: input.maxAttempts ?? 3,
    })
    .select("*")
    .single();
  if (error) {
    // 23505 = unique_violation: same workspace + key already enqueued.
    if (error.code === "23505") {
      return { data: null, error: "An identical job is already queued or finished.", duplicate: true };
    }
    return { data: null, error: error.message };
  }
  return readOne(data);
}

export async function listJobs(workspaceId: string, limit = 50): Promise<JobsResult<JobRow[]>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) return { data: null, error: error.message };
  const rows: JobRow[] = [];
  for (const row of data ?? []) {
    const mapped = toJobRow(row);
    if (typeof mapped === "string") return { data: null, error: `Cannot read ${mapped}. ${SCHEMA_AHEAD}` };
    rows.push(mapped);
  }
  return { data: rows, error: null };
}

export async function cancelJob(jobId: string, workspaceId: string): Promise<JobsResult<JobRow>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  const { data, error } = await supabase.rpc("cancel_job", { p_job_id: jobId, p_workspace_id: workspaceId });
  if (error) return { data: null, error: error.message };
  return readOne(data);
}

export async function approveJob(jobId: string, workspaceId: string): Promise<JobsResult<JobRow>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  const { data, error } = await supabase.rpc("approve_job", { p_job_id: jobId, p_workspace_id: workspaceId });
  if (error) return { data: null, error: error.message };
  return readOne(data);
}
