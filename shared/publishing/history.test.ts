import { describe, expect, it } from "vitest";
import { buildHistoryImportPlan, describeWindow, toWindowObservations, type HistoryColumnMap } from "./history";

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
    const { observations, excludedUnverified } = toWindowObservations([
      { published_at: "2026-08-03T14:00:00Z", value: 10, source_citability: "verified" },
      { published_at: "2026-08-03T15:00:00Z", value: 20, source_citability: "citable_stale" },
      { published_at: "2026-08-03T16:00:00Z", value: 30, source_citability: "citable_unverified" }
    ]);
    expect(observations).toEqual([
      { hour_utc: 14, weekday: 1, value: 10 },
      { hour_utc: 15, weekday: 1, value: 20 }
    ]);
    expect(excludedUnverified).toBe(1);
  });
});

describe("describeWindow", () => {
  it("names the day, the hour in UTC, and the observation count", () => {
    expect(describeWindow({ weekday: 2, hour_utc: 9, observations: 7 })).toBe("Tuesday 09:00 UTC, from 7 of your own posts");
  });
});
