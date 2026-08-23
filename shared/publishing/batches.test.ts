import { describe, expect, it } from "vitest";
import { groupImportBatches, type BatchObservation } from "./batches";

const row = (over: Partial<BatchObservation> = {}): BatchObservation => ({
  import_batch_id: "batch-a",
  created_at: "2026-08-01T10:00:00Z",
  metric_key: "views",
  source_id: "src-1",
  published_at: "2026-07-01T09:00:00Z",
  date_ambiguous: false,
  source_citability: "verified",
  ...over
});

describe("groupImportBatches", () => {
  it("returns nothing for no rows rather than an invented batch", () => {
    expect(groupImportBatches([])).toEqual([]);
  });

  it("counts only rows that are actually present", () => {
    const [batch] = groupImportBatches([row(), row(), row()]);
    expect(batch.observations).toBe(3);
    expect(batch.batchId).toBe("batch-a");
  });

  it("keeps separate batches apart", () => {
    const out = groupImportBatches([row(), row({ import_batch_id: "batch-b" })]);
    expect(out).toHaveLength(2);
    expect(out.map((b) => b.observations)).toEqual([1, 1]);
  });

  it("orders the most recently imported batch first", () => {
    const out = groupImportBatches([
      row({ import_batch_id: "old", created_at: "2026-01-01T00:00:00Z" }),
      row({ import_batch_id: "new", created_at: "2026-08-01T00:00:00Z" }),
      row({ import_batch_id: "mid", created_at: "2026-04-01T00:00:00Z" })
    ]);
    expect(out.map((b) => b.batchId)).toEqual(["new", "mid", "old"]);
  });

  it("records the range a batch covers on both time axes", () => {
    const [batch] = groupImportBatches([
      row({ created_at: "2026-08-01T10:00:00Z", published_at: "2026-07-05T09:00:00Z" }),
      row({ created_at: "2026-08-01T10:00:02Z", published_at: "2026-06-02T09:00:00Z" })
    ]);
    expect(batch.importedFirst).toBe("2026-08-01T10:00:00Z");
    expect(batch.importedLast).toBe("2026-08-01T10:00:02Z");
    expect(batch.publishedFirst).toBe("2026-06-02T09:00:00Z");
    expect(batch.publishedLast).toBe("2026-07-05T09:00:00Z");
  });

  it("orders timestamps by instant, not by text, across offsets", () => {
    const [batch] = groupImportBatches([
      row({ published_at: "2026-07-01T23:00:00+00:00" }),
      row({ published_at: "2026-07-02T00:30:00+05:00" })
    ]);
    // 2026-07-02T00:30+05:00 is 2026-07-01T19:30Z, the earlier instant.
    expect(batch.publishedFirst).toBe("2026-07-02T00:30:00+05:00");
    expect(batch.publishedLast).toBe("2026-07-01T23:00:00+00:00");
  });

  it("lists every metric and source the batch touched, deduplicated and stable", () => {
    const [batch] = groupImportBatches([
      row({ metric_key: "views", source_id: "src-2" }),
      row({ metric_key: "views", source_id: "src-1" }),
      row({ metric_key: "clicks", source_id: "src-1" })
    ]);
    expect(batch.metricKeys).toEqual(["clicks", "views"]);
    expect(batch.sourceIds).toEqual(["src-1", "src-2"]);
  });

  it("counts ambiguous dates and non-citable rows separately from the total", () => {
    const [batch] = groupImportBatches([
      row(),
      row({ date_ambiguous: true }),
      row({ source_citability: "citable_unverified" }),
      row({ source_citability: "citable_stale" })
    ]);
    expect(batch.observations).toBe(4);
    expect(batch.ambiguousDates).toBe(1);
    expect(batch.unverifiedRows).toBe(1);
  });

  it("groups rows with no batch id instead of dropping or inventing one", () => {
    const out = groupImportBatches([row({ import_batch_id: null }), row({ import_batch_id: null })]);
    expect(out).toHaveLength(1);
    expect(out[0].batchId).toBeNull();
    expect(out[0].observations).toBe(2);
  });
});
