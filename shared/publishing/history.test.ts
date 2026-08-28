import { describe, expect, it } from "vitest";
import { buildHistoryImportPlan, describeWindow, isValidTimeZone, runtimeTimeZone, toWindowObservations, type HistoryColumnMap } from "./history";

const map: HistoryColumnMap = { publishedAt: "published_at", value: "views", postId: "post_id" };

describe("buildHistoryImportPlan", () => {
  it("accepts rows with a real clock time and rejects date-only rows", () => {
    const csv = ["post_id,published_at,views", "p1,2026-08-01T14:00:00Z,1200", "p2,2026-08-02,900"].join("\n");
    const plan = buildHistoryImportPlan(csv, map, "views");
    expect(plan.accepted).toHaveLength(1);
    expect(plan.accepted[0].external_post_id).toBe("p1");
    expect(plan.rejected[0].reason).toMatch(/no clock time/);
  });

  it("drops duplicates by post id and counts them", () => {
    const csv = ["post_id,published_at,views", "p1,2026-08-01T14:00:00Z,1200", "p1,2026-08-01T14:00:00Z,1200"].join("\n");
    const plan = buildHistoryImportPlan(csv, map, "views");
    expect(plan.accepted).toHaveLength(1);
    expect(plan.duplicatesInFile).toBe(1);
  });

  it("rejects everything when the mapping is wrong for the file", () => {
    const plan = buildHistoryImportPlan("a,b\n1,2", map, "views");
    expect(plan.accepted).toHaveLength(0);
    expect(plan.rejected[0].reason).toMatch(/headers not in the file/);
  });
});

describe("toWindowObservations", () => {
  it("excludes unverified-source rows and reports the count", () => {
    const { observations, excludedUnverified } = toWindowObservations(
      [
        { published_at: "2026-08-03T14:00:00Z", value: 10, source_citability: "verified" },
        { published_at: "2026-08-03T15:00:00Z", value: 20, source_citability: "citable_stale" },
        { published_at: "2026-08-03T16:00:00Z", value: 30, source_citability: "citable_unverified" }
      ],
      "UTC"
    );
    expect(observations).toEqual([
      { hour: 14, weekday: 1, value: 10 },
      { hour: 15, weekday: 1, value: 20 }
    ]);
    expect(excludedUnverified).toBe(1);
  });

  it("buckets by wall-clock hour in the requested zone, not by UTC", () => {
    const rows = [{ published_at: "2026-08-03T22:30:00Z", value: 10, source_citability: "verified" as const }];
    expect(toWindowObservations(rows, "UTC").observations[0]).toEqual({ hour: 22, weekday: 1, value: 10 });
    // 04:00 the next calendar day in Kolkata (UTC+05:30), so both hour and weekday move.
    expect(toWindowObservations(rows, "Asia/Kolkata").observations[0]).toEqual({ hour: 4, weekday: 2, value: 10 });
    // 18:30 the same day in New York (UTC-04:00 in August).
    expect(toWindowObservations(rows, "America/New_York").observations[0]).toEqual({ hour: 18, weekday: 1, value: 10 });
  });

  it("uses the offset in force on each date, so a DST change does not shift the bucket", () => {
    // 16:00 local in New York on both dates: EDT (UTC-4) in July, EST (UTC-5) in January.
    const { observations } = toWindowObservations(
      [
        { published_at: "2026-07-15T20:00:00Z", value: 1, source_citability: "verified" },
        { published_at: "2026-01-15T21:00:00Z", value: 2, source_citability: "verified" }
      ],
      "America/New_York"
    );
    expect(observations.map((o) => o.hour)).toEqual([16, 16]);
  });

  it("places midnight in hour 0, never hour 24", () => {
    const { observations } = toWindowObservations(
      [{ published_at: "2026-08-03T00:00:00Z", value: 5, source_citability: "verified" }],
      "UTC"
    );
    expect(observations[0].hour).toBe(0);
  });

  it("reports the zone actually used, falling back to UTC when the name is not a real zone", () => {
    const rows = [{ published_at: "2026-08-03T14:00:00Z", value: 10, source_citability: "verified" as const }];
    const asked = toWindowObservations(rows, "Asia/Kolkata");
    expect(asked.timeZone).toBe("Asia/Kolkata");
    const bogus = toWindowObservations(rows, "Not/AZone");
    expect(bogus.timeZone).toBe("UTC");
    expect(bogus.observations[0]).toEqual({ hour: 14, weekday: 1, value: 10 });
  });

  it("skips rows whose stored publication time is not a date", () => {
    const { observations, excludedUnverified } = toWindowObservations(
      [{ published_at: "not a date", value: 10, source_citability: "verified" }],
      "UTC"
    );
    expect(observations).toEqual([]);
    expect(excludedUnverified).toBe(0);
  });
});

describe("runtimeTimeZone and isValidTimeZone", () => {
  it("returns a zone the observation builder accepts", () => {
    const zone = runtimeTimeZone();
    expect(zone.length).toBeGreaterThan(0);
    const { timeZone } = toWindowObservations(
      [{ published_at: "2026-08-03T14:00:00Z", value: 1, source_citability: "verified" }],
      zone
    );
    expect(timeZone).toBe(zone);
  });

  it("validates real IANA timezone identifiers and rejects invalid ones", () => {
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Asia/Kolkata")).toBe(true);
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Invalid/Timezone")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("describeWindow", () => {
  it("names the day, the hour, the zone the hour is in, and the observation count", () => {
    expect(describeWindow({ weekday: 2, hour: 9, observations: 7 }, "Asia/Kolkata")).toBe(
      "Tuesday 09:00 Asia/Kolkata, from 7 of your own posts"
    );
  });
});
