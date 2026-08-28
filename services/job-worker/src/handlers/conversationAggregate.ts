/**
 * Handler: conversation_aggregate
 *
 * Computes deterministic volume aggregations for conversation observations across time windows.
 * Uses the workspace's configured timezone and reports baseline availability truthfully.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { aggregateConversationObservations } from "../../../../shared/conversations/spikeAggregation.js";
import type { JobHandler } from "../loop.js";

export function makeConversationAggregateHandler(supabase: SupabaseClient): JobHandler {
  return async (job) => {
    // 1. Fetch workspace timezone
    const { data: ws, error: wsError } = await supabase
      .from("workspaces")
      .select("id, timezone")
      .eq("id", job.workspace_id)
      .maybeSingle();

    if (wsError) {
      return {
        ok: false,
        failure: { kind: "transient", message: `Database error reading workspace: ${wsError.message}`, code: "db_error" },
      };
    }

    const timeZone = ws?.timezone ?? "UTC";

    // 2. Fetch observations
    const { data: observations, error: obsError } = await supabase
      .from("conversation_observations")
      .select("observed_at")
      .eq("workspace_id", job.workspace_id)
      .order("observed_at", { ascending: false })
      .limit(5000);

    if (obsError) {
      return {
        ok: false,
        failure: { kind: "transient", message: `Database error reading observations: ${obsError.message}`, code: "db_error" },
      };
    }

    const obsList = observations ?? [];
    const aggregated = aggregateConversationObservations({
      observations: obsList,
      timeZone,
    });

    const spikeCount = aggregated.buckets.filter((b) => b.is_observed_spike).length;

    return {
      ok: true,
      result: {
        time_zone: aggregated.time_zone,
        total_observations: aggregated.total_observations,
        buckets_count: aggregated.buckets.length,
        observed_spikes_count: spikeCount,
        freshness_timestamp: aggregated.freshness_timestamp,
        buckets: aggregated.buckets.slice(0, 50),
      },
    };
  };
}
