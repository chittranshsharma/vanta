import { describe, expect, it } from "vitest";
import { aggregateConversationObservations } from "./spikeAggregation";

describe("aggregateConversationObservations", () => {
  it("aggregates exact observation counts by hour in UTC", () => {
    const observations = [
      { observed_at: "2026-08-28T10:15:00Z" },
      { observed_at: "2026-08-28T10:45:00Z" },
      { observed_at: "2026-08-28T11:05:00Z" },
    ];
    const result = aggregateConversationObservations({
      observations,
      timeZone: "UTC",
    });

    expect(result.total_observations).toBe(3);
    expect(result.buckets).toHaveLength(2);
    expect(result.buckets[0].observation_count).toBe(2);
    expect(result.buckets[1].observation_count).toBe(1);
    expect(result.buckets[0].baseline_status).toBe("unknown");
    expect(result.buckets[0].is_observed_spike).toBe(false);
  });

  it("shifts wall-clock buckets when using non-UTC timezone", () => {
    const observations = [
      { observed_at: "2026-08-28T18:30:00Z" }, // 00:00 next day in Asia/Kolkata (+05:30)
    ];
    const result = aggregateConversationObservations({
      observations,
      timeZone: "Asia/Kolkata",
    });

    expect(result.time_zone).toBe("Asia/Kolkata");
    expect(result.buckets[0].local_label).toContain("Asia/Kolkata");
  });

  it("flags observed spike when volume exceeds baseline threshold multiplier", () => {
    const observations = [
      { observed_at: "2026-08-28T14:10:00Z" },
      { observed_at: "2026-08-28T14:20:00Z" },
      { observed_at: "2026-08-28T14:30:00Z" },
      { observed_at: "2026-08-28T14:40:00Z" },
      { observed_at: "2026-08-28T14:50:00Z" },
    ];
    const result = aggregateConversationObservations({
      observations,
      timeZone: "UTC",
      baselineCountsByBucket: {
        "2026-08-28T14:00": 2,
      },
      spikeThresholdMultiplier: 2.0,
    });

    expect(result.buckets[0].baseline_status).toBe("recorded");
    expect(result.buckets[0].is_observed_spike).toBe(true);
    expect(result.buckets[0].explanation).toContain("2.5x");
    expect(result.buckets[0].explanation).toContain("stored baseline");
  });

  it("reports unknown baseline status and does not guess spike when baseline is missing", () => {
    const observations = [{ observed_at: "2026-08-28T14:10:00Z" }];
    const result = aggregateConversationObservations({
      observations,
      timeZone: "UTC",
    });

    expect(result.buckets[0].baseline_status).toBe("unknown");
    expect(result.buckets[0].is_observed_spike).toBe(false);
    expect(result.buckets[0].explanation).toMatch(/No historical baseline recorded/);
  });
});
