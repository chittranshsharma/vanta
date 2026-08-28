/**
 * Observed Conversation Spike Aggregation (pure).
 *
 * Invariants:
 *  - Calculates deterministic counts from stored observation records.
 *  - Uses the operator's configured workspace timezone for wall-clock bucketing.
 *  - Never fabricates baseline data; if baseline is absent, reports unknown.
 *  - Never claims virality, algorithmic boost, or predicted reach.
 */

import { isValidTimeZone } from "../publishing/history";

export interface StoredObservationTimestamp {
  observed_at: string;
}

export interface SpikeAggregationBucket {
  bucket_start: string; // ISO string in UTC
  local_label: string; // Formatted in timezone
  observation_count: number;
  baseline_count: number | null;
  baseline_status: "recorded" | "unknown";
  is_observed_spike: boolean;
  explanation: string;
}

export interface SpikeAggregationResult {
  time_zone: string;
  total_observations: number;
  buckets: SpikeAggregationBucket[];
  freshness_timestamp: string;
}

export function aggregateConversationObservations(input: {
  observations: StoredObservationTimestamp[];
  timeZone?: string;
  baselineCountsByBucket?: Record<string, number>;
  spikeThresholdMultiplier?: number;
}): SpikeAggregationResult {
  const tz = input.timeZone && isValidTimeZone(input.timeZone) ? input.timeZone : "UTC";
  const threshold = input.spikeThresholdMultiplier ?? 2.0;

  // Group by YYYY-MM-DD-HH in the selected timezone
  const countsByHour = new Map<string, { utcStart: string; localLabel: string; count: number }>();

  for (const obs of input.observations) {
    const d = new Date(obs.observed_at);
    if (Number.isNaN(d.getTime())) continue;

    // Format hour in target timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    });

    const parts = new Map(formatter.formatToParts(d).map((p) => [p.type, p.value]));
    const year = parts.get("year");
    const month = parts.get("month");
    const day = parts.get("day");
    const hour = parts.get("hour") === "24" ? "00" : parts.get("hour");

    const bucketKey = `${year}-${month}-${day}T${hour}:00`;
    const localLabel = `${year}-${month}-${day} ${hour}:00 ${tz}`;

    const existing = countsByHour.get(bucketKey);
    if (existing) {
      existing.count += 1;
    } else {
      countsByHour.set(bucketKey, {
        utcStart: d.toISOString(),
        localLabel,
        count: 1,
      });
    }
  }

  const buckets: SpikeAggregationBucket[] = [];
  const baselineMap = input.baselineCountsByBucket || {};

  for (const [key, val] of countsByHour.entries()) {
    const baseline = baselineMap[key] ?? null;
    const hasBaseline = baseline !== null && typeof baseline === "number";

    let isSpike = false;
    let explanation = "Observed volume within normal range.";

    if (!hasBaseline) {
      explanation = "No historical baseline recorded for this time window.";
    } else if (baseline === 0 && val.count >= 5) {
      isSpike = true;
      explanation = `Observed volume (${val.count}) increased from 0 baseline observations.`;
    } else if (baseline > 0 && val.count >= baseline * threshold) {
      isSpike = true;
      const ratio = (val.count / baseline).toFixed(1);
      explanation = `Observed volume increased (${ratio}x) compared with stored baseline (${baseline} posts).`;
    }

    buckets.push({
      bucket_start: val.utcStart,
      local_label: val.localLabel,
      observation_count: val.count,
      baseline_count: baseline,
      baseline_status: hasBaseline ? "recorded" : "unknown",
      is_observed_spike: isSpike,
      explanation,
    });
  }

  // Sort chronologically
  buckets.sort((a, b) => new Date(a.bucket_start).getTime() - new Date(b.bucket_start).getTime());

  return {
    time_zone: tz,
    total_observations: input.observations.length,
    buckets,
    freshness_timestamp: new Date().toISOString(),
  };
}
