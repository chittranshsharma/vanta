/**
 * Observed posting history (pure). The only input the test-window planner
 * is allowed to use: posts the workspace owns, with a publication time and
 * a metric value, each traceable to a registered source.
 *
 * Reuses the outcome-import readers so a date is parsed the same way in
 * both places, and an ambiguous date is flagged rather than resolved.
 */

import { parseCsv, parseMetricValue, parseObservedAt, type SourceCitability } from "../experiments/outcomeImport";

export const MAX_HISTORY_ROWS = 10_000;

export interface HistoryColumnMap {
  publishedAt: string;
  value: string;
  /** Optional external post identifier, used to deduplicate re-imports. */
  postId: string;
}

export interface HistoryCandidate {
  line: number;
  published_at: string;
  value: number;
  external_post_id: string | null;
  date_ambiguous: boolean;
}

export interface HistoryImportPlan {
  accepted: HistoryCandidate[];
  rejected: Array<{ line: number; reason: string }>;
  duplicatesInFile: number;
  ambiguousDates: number;
  truncated: boolean;
}

export function buildHistoryImportPlan(csvText: string, map: HistoryColumnMap, metricKey: string): HistoryImportPlan {
  const parsed = parseCsv(csvText, MAX_HISTORY_ROWS);
  const accepted: HistoryCandidate[] = [];
  const rejected: Array<{ line: number; reason: string }> = [];
  const seen = new Set<string>();
  let duplicatesInFile = 0;

  const missing = [map.publishedAt, map.value].filter((h) => h !== "" && !parsed.headers.includes(h));
  if (parsed.headers.length > 0 && missing.length > 0) {
    return {
      accepted: [],
      rejected: parsed.rows.map((_, i) => ({ line: i + 2, reason: `Mapping refers to headers not in the file: ${missing.join(", ")}.` })),
      duplicatesInFile: 0,
      ambiguousDates: 0,
      truncated: parsed.truncated
    };
  }

  parsed.rows.forEach((raw, idx) => {
    const line = idx + 2;
    const { iso, ambiguous } = parseObservedAt(raw[map.publishedAt] ?? "");
    if (!iso) {
      rejected.push({ line, reason: "Publication time could not be parsed. A window cannot be derived without an exact time." });
      return;
    }
    if (!/[T ]\d{2}:\d{2}/.test((raw[map.publishedAt] ?? "").trim())) {
      rejected.push({ line, reason: "Publication time has no clock time; a date alone cannot place a post in an hour bucket." });
      return;
    }
    const { value, note } = parseMetricValue(raw[map.value] ?? "");
    if (value === null) {
      rejected.push({ line, reason: `Metric value for ${metricKey} could not be read (${note}).` });
      return;
    }
    const postId = map.postId && raw[map.postId] ? raw[map.postId].trim() : null;
    const dedupeKey = postId ?? `${iso}|${value}`;
    if (seen.has(dedupeKey)) {
      duplicatesInFile += 1;
      rejected.push({ line, reason: "Duplicate of an earlier row in this file." });
      return;
    }
    seen.add(dedupeKey);
    accepted.push({ line, published_at: iso, value, external_post_id: postId, date_ambiguous: ambiguous });
  });

  return { accepted, rejected, duplicatesInFile, ambiguousDates: accepted.filter((a) => a.date_ambiguous).length, truncated: parsed.truncated };
}

export interface StoredObservation {
  published_at: string;
  value: number;
  source_citability: SourceCitability;
}

export interface WindowObservation {
  hour_utc: number;
  weekday: number;
  value: number;
}

/**
 * Turns stored history into the shape the window suggester consumes.
 * Rows from a source that is no longer citable are excluded and counted,
 * so the UI can say why the usable count is lower than the stored count.
 */
export function toWindowObservations(rows: StoredObservation[]): { observations: WindowObservation[]; excludedUnverified: number } {
  const observations: WindowObservation[] = [];
  let excludedUnverified = 0;
  for (const r of rows) {
    if (r.source_citability === "citable_unverified") {
      excludedUnverified += 1;
      continue;
    }
    const d = new Date(r.published_at);
    if (Number.isNaN(d.getTime())) continue;
    observations.push({ hour_utc: d.getUTCHours(), weekday: d.getUTCDay(), value: r.value });
  }
  return { observations, excludedUnverified };
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export function describeWindow(w: { weekday: number; hour_utc: number; observations: number }): string {
  const hour = String(w.hour_utc).padStart(2, "0");
  return `${WEEKDAY_NAMES[w.weekday] ?? "Unknown day"} ${hour}:00 UTC, from ${w.observations} of your own posts`;
}
