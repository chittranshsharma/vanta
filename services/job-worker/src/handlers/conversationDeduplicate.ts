/**
 * Handler: conversation_deduplicate
 *
 * Scans conversation observations within a workspace to detect duplicate idempotency keys.
 * Reports exact duplicate counts in operational result without silently mutating or deleting rows.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobHandler } from "../loop.js";

export function makeConversationDeduplicateHandler(supabase: SupabaseClient): JobHandler {
  return async (job) => {
    const payload = (job.payload ?? {}) as { batch_id?: string; limit?: number };
    const limit = Math.min(payload.limit ?? 1000, 5000);

    let q = supabase
      .from("conversation_observations")
      .select("id, idempotency_key, observed_at, provider")
      .eq("workspace_id", job.workspace_id);

    if (payload.batch_id) {
      q = q.eq("import_batch_id", payload.batch_id);
    }

    const { data: observations, error } = await q.order("observed_at", { ascending: true }).limit(limit);

    if (error) {
      return {
        ok: false,
        failure: { kind: "transient", message: `Database error: ${error.message}`, code: "db_error" },
      };
    }

    const obsList = observations ?? [];
    const seenKeys = new Set<string>();
    let duplicateCount = 0;
    const duplicateIds: string[] = [];

    for (const obs of obsList) {
      if (seenKeys.has(obs.idempotency_key)) {
        duplicateCount += 1;
        duplicateIds.push(obs.id);
      } else {
        seenKeys.add(obs.idempotency_key);
      }
    }

    return {
      ok: true,
      result: {
        scanned_count: obsList.length,
        unique_count: seenKeys.size,
        duplicate_count: duplicateCount,
        duplicate_observation_ids: duplicateIds,
      },
    };
  };
}
