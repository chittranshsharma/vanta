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
  /** Wall-clock hour, 0-23, in the timezone the bucketing was done in. */
  hour: number;
  /** Day of week, 0 = Sunday, in the same timezone as `hour`. */
  weekday: number;
  value: number;
}

/**
 * The timezone the runtime is in, which for the browser is the operator's own.
 * A window is a wall-clock claim about an audience, so it has to be stated in
 * a real zone rather than in UTC, which nobody posts in.
 */
export function runtimeTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/**
 * Checks whether an IANA timezone string is valid and recognized by the runtime.
 */
export function isValidTimeZone(timeZone: string): boolean {
  if (!timeZone || typeof timeZone !== "string") return false;
  return wallClockFormatter(timeZone) !== null;
}

/**
 * Formatter for one zone, or `null` when the runtime rejects the zone name.
 * A rejected zone must be reported rather than silently swapped, because every
 * hour label downstream would otherwise name a zone the numbers are not in.
 */
function wallClockFormatter(timeZone: string): Intl.DateTimeFormat | null {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23"
    });
  } catch {
    return null;
  }
}

/**
 * Wall-clock hour and weekday of an instant in one zone.
 *
 * The parts are read numerically and the weekday is derived from the local
 * calendar date rather than from a formatted day name, so no locale's spelling
 * or ordering can change the bucket. Offsets are the platform's, so a zone that
 * observes DST buckets by what the clock on the wall actually read.
 */
function wallClock(fmt: Intl.DateTimeFormat, at: Date): { hour: number; weekday: number } | null {
  const parts = new Map(fmt.formatToParts(at).map((p) => [p.type, p.value]));
  const year = Number(parts.get("year"));
  const month = Number(parts.get("month"));
  const day = Number(parts.get("day"));
  const raw = Number(parts.get("hour"));
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(raw)) return null;
  // Older ICU builds render midnight as hour 24 even under h23.
  const hour = raw === 24 ? 0 : raw;
  return { hour, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

/**
 * Turns stored history into the shape the window suggester consumes, bucketed
 * by wall-clock time in `timeZone`.
 *
 * Rows from a source that is no longer citable are excluded and counted, so the
 * UI can say why the usable count is lower than the stored count. The zone the
 * buckets are actually in is returned, which is not always the zone asked for:
 * an unrecognized zone name falls back to UTC and says so through this value.
 */
export function toWindowObservations(
  rows: StoredObservation[],
  timeZone: string = runtimeTimeZone()
): { observations: WindowObservation[]; excludedUnverified: number; timeZone: string } {
  const requested = wallClockFormatter(timeZone);
  const fmt = requested ?? wallClockFormatter("UTC");
  const used = requested ? timeZone : "UTC";
  const observations: WindowObservation[] = [];
  let excludedUnverified = 0;
  for (const r of rows) {
    if (r.source_citability === "citable_unverified") {
      excludedUnverified += 1;
      continue;
    }
    const d = new Date(r.published_at);
    if (Number.isNaN(d.getTime())) continue;
    const local = fmt ? wallClock(fmt, d) : null;
    if (!local) continue;
    observations.push({ hour: local.hour, weekday: local.weekday, value: r.value });
  }
  return { observations, excludedUnverified, timeZone: used };
}

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

/**
 * Names a window in the zone its buckets were built in. The zone is part of the
 * claim, not decoration: the same numbers mean a different instant in any other
 * zone.
 */
export function describeWindow(w: { weekday: number; hour: number; observations: number }, timeZone: string): string {
  const hour = String(w.hour).padStart(2, "0");
  return `${WEEKDAY_NAMES[w.weekday] ?? "Unknown day"} ${hour}:00 ${timeZone}, from ${w.observations} of your own posts`;
}
