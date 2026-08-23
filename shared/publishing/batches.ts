/**
 * Posting-history import batches (pure).
 *
 * A batch is not a stored entity. There is no batch registry table: a batch
 * exists only as the id stamped on the observation rows that were inserted
 * under it. Two consequences are load-bearing and must not be papered over.
 *
 * 1. An import that stored no rows leaves no trace at all. Rejected rows,
 *    validation messages and the original file name are never persisted, so a
 *    failed or partly-rejected import cannot be listed or explained here.
 * 2. Every batch this function returns therefore stored at least one row.
 *    There is no "failed" state to render, and inventing one would be a claim
 *    about data that does not exist.
 *
 * Every number below is a count of rows actually present, never a count of
 * rows a file was thought to contain.
 */

import type { SourceCitability } from "../experiments/outcomeImport";

/** The fields of a stored observation that describe where it came from. */
export interface BatchObservation {
  import_batch_id: string | null;
  created_at: string;
  metric_key: string;
  source_id: string;
  published_at: string;
  date_ambiguous: boolean;
  source_citability: SourceCitability;
}

export interface ImportBatchSummary {
  /**
   * `null` groups rows stored without a batch id. Such rows cannot be deleted
   * as a batch, because there is no id to scope the delete to.
   */
  batchId: string | null;
  /** Rows stored under this batch and still present. */
  observations: number;
  metricKeys: string[];
  sourceIds: string[];
  /** Range of recorded insert times. Equal when the batch landed in one write. */
  importedFirst: string;
  importedLast: string;
  /** Publication range the stored rows cover. */
  publishedFirst: string;
  publishedLast: string;
  /** Rows whose publication date came from an ambiguous format. */
  ambiguousDates: number;
  /** Rows excluded from window derivation because their source is not citable. */
  unverifiedRows: number;
}

/** Key for rows with no batch id. A UUID column cannot hold this value, so it cannot collide. */
const UNBATCHED = "unbatched";

/** Time value, or NaN when the stored text is not a date we can order by. */
const ms = (iso: string) => Date.parse(iso);

/**
 * Groups stored observations into the batches they were imported under,
 * newest recorded import first.
 */
export function groupImportBatches(rows: BatchObservation[]): ImportBatchSummary[] {
  const groups = new Map<string, ImportBatchSummary>();

  for (const r of rows) {
    const key = r.import_batch_id ?? UNBATCHED;
    let g = groups.get(key);
    if (!g) {
      g = {
        batchId: r.import_batch_id,
        observations: 0,
        metricKeys: [],
        sourceIds: [],
        importedFirst: r.created_at,
        importedLast: r.created_at,
        publishedFirst: r.published_at,
        publishedLast: r.published_at,
        ambiguousDates: 0,
        unverifiedRows: 0
      };
      groups.set(key, g);
    }
    g.observations += 1;
    if (!g.metricKeys.includes(r.metric_key)) g.metricKeys.push(r.metric_key);
    if (!g.sourceIds.includes(r.source_id)) g.sourceIds.push(r.source_id);
    if (ms(r.created_at) < ms(g.importedFirst)) g.importedFirst = r.created_at;
    if (ms(r.created_at) > ms(g.importedLast)) g.importedLast = r.created_at;
    if (ms(r.published_at) < ms(g.publishedFirst)) g.publishedFirst = r.published_at;
    if (ms(r.published_at) > ms(g.publishedLast)) g.publishedLast = r.published_at;
    if (r.date_ambiguous) g.ambiguousDates += 1;
    if (r.source_citability === "citable_unverified") g.unverifiedRows += 1;
  }

  for (const g of groups.values()) {
    g.metricKeys.sort();
    g.sourceIds.sort();
  }

  return [...groups.values()].sort((a, b) => {
    const byTime = ms(b.importedLast) - ms(a.importedLast);
    if (byTime !== 0 && !Number.isNaN(byTime)) return byTime;
    return (a.batchId ?? "").localeCompare(b.batchId ?? "");
  });
}
