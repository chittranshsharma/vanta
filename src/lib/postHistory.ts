import { isSupabaseConfigured, supabase } from "./supabase";
import type { HistoryCandidate, StoredObservation } from "../../shared/publishing/history";
import type { SourceCitability } from "../../shared/experiments/outcomeImport";

/**
 * Observed posting history client. Backed by migration 017, which is
 * authored but pending live apply: until an operator applies it, reads and
 * writes return a typed error and the planner reports unknown.
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

function table(name: "post_observations") {
  return supabase.from(name);
}

export async function listPostObservations(workspaceId: string, metricKey?: string): Promise<Result<PostObservationRow[]>> {
  if (!isSupabaseConfigured) return { data: null, error: NOT_CONFIGURED };
  let q = table("post_observations").select("*").eq("workspace_id", workspaceId);
  if (metricKey) q = q.eq("metric_key", metricKey);
  const { data, error } = await q.order("published_at", { ascending: false }).limit(10_000);
  if (error) return { data: null, error: error.message };
  return { data: (data ?? []) as unknown as PostObservationRow[], error: null };
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
    import_batch_id: input.batchId
  }));
  const { data, error } = await table("post_observations").insert(payload as never).select("id");
  if (error) {
    // 23505 = the partial unique index on (workspace, metric, external_post_id).
    if ((error as { code?: string }).code === "23505") {
      return { data: null, error: "Some of these posts are already imported for this metric. Remove them from the file or delete the earlier batch." };
    }
    return { data: null, error: error.message };
  }
  return { data: (data ?? []).length, error: null };
}
