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
