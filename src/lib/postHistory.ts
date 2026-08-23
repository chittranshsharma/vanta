import { isSupabaseConfigured, supabase } from "./supabase";
import { narrow } from "./rows";
import type { Tables } from "../types/database.types";
import type { HistoryCandidate, StoredObservation } from "../../shared/publishing/history";
import { SOURCE_CITABILITIES, type SourceCitability } from "../../shared/experiments/outcomeImport";

/**
 * Observed posting history client. Backed by migration 017: reads and writes
 * return a typed error whenever the table is unreachable, and the planner
 * reports unknown rather than an empty history.
 */

export interface PostObservationRow extends StoredObservation {
  id: string;
  metric_key: string;
  external_post_id: string | null;
  date_ambiguous: boolean;
  source_id: string;
  /** The import this row arrived in. `null` for rows stored without a batch id. */
  import_batch_id: string | null;
  /** When the row was stored, which is not when the post was published. */
  created_at: string;
}

type Result<T> = { data: T; error: null } | { data: null; error: string };
const NOT_CONFIGURED = "Supabase is not configured.";
const SCHEMA_AHEAD = "The database schema is ahead of this build; reload or update the app.";

/**
 * Reads a stored observation, or returns why it could not be read.
 * `source_citability` decides whether a row may back a window suggestion at
 * all, so an unrecognized value is reported rather than treated as citable.
 */
export function toPostObservationRow(row: Tables<"post_observations">): PostObservationRow | string {
  const source_citability = narrow(SOURCE_CITABILITIES, row.source_citability);
  if (!source_citability) return `observation ${row.id} has source_citability "${row.source_citability}"`;
  return {
    id: row.id,
    metric_key: row.metric_key,
    published_at: row.published_at,
    value: row.value,
    source_citability,
    external_post_id: row.external_post_id,
    date_ambiguous: row.date_ambiguous,
    source_id: row.source_id,
    import_batch_id: row.import_batch_id,
    created_at: row.created_at,
  };
}

export async function listPostObservations(workspaceId: string, metricKey?: string): Promise<Result<PostObservationRow[]>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  let q = supabase.from("post_observations").select("*").eq("workspace_id", workspaceId);
  if (metricKey) q = q.eq("metric_key", metricKey);
  const { data, error } = await q.order("published_at", { ascending: false }).limit(10_000);
  if (error) return { data: null, error: error.message };
  const rows: PostObservationRow[] = [];
  for (const row of data ?? []) {
    const mapped = toPostObservationRow(row);
    if (typeof mapped === "string") return { data: null, error: `Cannot read ${mapped}. ${SCHEMA_AHEAD}` };
    rows.push(mapped);
  }
  return { data: rows, error: null };
}

export async function importPostObservations(input: {
  workspaceId: string;
  userId: string;
  sourceId: string;
  sourceCitability: SourceCitability;
  metricKey: string;
  rows: HistoryCandidate[];
  batchId: string;
}): Promise<Result<number>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  if (input.rows.length === 0) return { data: null, error: "No accepted rows to import." };
  const payload = input.rows.map((r) => ({
    workspace_id: input.workspaceId,
    source_id: input.sourceId,
    created_by: input.userId,
    external_post_id: r.external_post_id,
    published_at: r.published_at,
    metric_key: input.metricKey,
    value: r.value,
    source_citability: input.sourceCitability,
    date_ambiguous: r.date_ambiguous,
    import_batch_id: input.batchId,
  }));
  const { data, error } = await supabase.from("post_observations").insert(payload).select("id");
  if (error) {
    // 23505 = the partial unique index on (workspace, metric, external_post_id).
    if (error.code === "23505") {
      return { data: null, error: "Some of these posts are already imported for this metric. Remove them from the file or delete the earlier batch." };
    }
    return { data: null, error: error.message };
  }
  return { data: (data ?? []).length, error: null };
}

export interface BatchDeleteOutcome {
  /** Rows the database confirmed it removed. */
  deleted: number;
  /**
   * Set when the delete succeeded but its audit row could not be written. The
   * delete is not undone: the caller must say the removal happened and was not
   * recorded, rather than reporting a clean success.
   */
  auditWriteFailed: string | null;
}

/**
 * Deletes every stored observation belonging to one import batch.
 *
 * Authority is the database's, not this function's: migration 017 grants
 * DELETE on `post_observations` only through
 * `public.is_workspace_admin_or_owner(workspace_id)`. That has a consequence
 * that must be handled rather than assumed away — when an RLS policy's USING
 * clause is false, Postgres removes zero rows and returns no error. An empty
 * result is therefore ambiguous between "already gone" and "you are not
 * permitted", and is reported as such instead of as a success.
 *
 * Nothing in the schema references `post_observations`, so removing these rows
 * cascades to no other evidence. The rows themselves are the evidence, so the
 * removal is recorded in the append-only audit log with the batch id and the
 * count, and the count is read from the database rather than predicted.
 */
export async function deleteImportBatch(input: {
  workspaceId: string;
  userId: string;
  batchId: string;
}): Promise<Result<BatchDeleteOutcome>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  // An empty id would scope the delete to nothing meaningful; refuse rather than
  // issue a delete whose filter says less than the caller thinks it does.
  if (!input.batchId) return { data: null, error: "No import batch was named, so nothing was deleted." };

  const { data, error } = await supabase
    .from("post_observations")
    .delete()
    .eq("workspace_id", input.workspaceId)
    .eq("import_batch_id", input.batchId)
    .select("id");

  if (error) return { data: null, error: error.message };

  const deleted = (data ?? []).length;
  if (deleted === 0) {
    return {
      data: null,
      error:
        "No rows were removed. Either this batch is already gone, or deleting import batches is restricted to workspace owners and admins.",
    };
  }

  const audit = await supabase.from("audit_events").insert({
    workspace_id: input.workspaceId,
    user_id: input.userId,
    action: "post_observation_batch.deleted",
    resource_type: "post_observation_batch",
    resource_id: input.batchId,
    metadata: { observations_deleted: deleted },
  });

  return { data: { deleted, auditWriteFailed: audit.error?.message ?? null }, error: null };
}
