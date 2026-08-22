/**
 * Outcome import (pure). Turns a pasted or uploaded CSV into candidate
 * observed outcome rows for one experiment.
 *
 * Discipline, matching services/analysis-worker/app/normalize.py:
 *   - every decision is recorded; nothing is guessed silently
 *   - ambiguous slash dates are flagged, not resolved
 *   - a row that cannot be fully resolved is rejected with a reason,
 *     never coerced into a number
 *   - the source and its citability at import time travel with each row,
 *     so an unverified source can never look like a verified measurement
 */

export const MAX_IMPORT_BYTES = 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;

export type SourceCitability = "verified" | "citable_stale" | "citable_unverified";

export interface ColumnMap {
  /** Header naming the variant. Values are matched against variant labels, then ids. */
  variant: string;
  /** Header holding the metric value. */
  value: string;
  /** Header holding the observation timestamp or date. */
  observedAt: string;
}

export interface ParsedCsv {
  headers: string[];
  rows: Array<Record<string, string>>;
  /** Rows dropped during parsing (wrong field count), with their 1-based line number. */
  malformedLines: Array<{ line: number; reason: string }>;
  truncated: boolean;
}

/** Minimal RFC4180 reader: quoted fields, doubled quotes, CRLF or LF. */
export function parseCsv(text: string, maxRows = MAX_IMPORT_ROWS): ParsedCsv {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;
  const pushField = () => {
    record.push(field);
    field = "";
  };
  const pushRecord = () => {
    pushField();
    records.push(record);
    record = [];
  };
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"' && field === "") {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (ch === "\r" && text[i + 1] === "\n") {
      pushRecord();
      i += 2;
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      pushRecord();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field !== "" || record.length > 0) pushRecord();

  const nonEmpty = records.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [], malformedLines: [], truncated: false };

  const headers = nonEmpty[0].map((h) => h.trim());
  const malformedLines: Array<{ line: number; reason: string }> = [];
  const rows: Array<Record<string, string>> = [];
  let truncated = false;
  for (let r = 1; r < nonEmpty.length; r += 1) {
    if (rows.length >= maxRows) {
      truncated = true;
      break;
    }
    const cells = nonEmpty[r];
    if (cells.length !== headers.length) {
      malformedLines.push({ line: r + 1, reason: `Expected ${headers.length} fields, found ${cells.length}.` });
      continue;
    }
    const row: Record<string, string> = {};
    headers.forEach((h, c) => {
      row[h] = (cells[c] ?? "").trim();
    });
    rows.push(row);
  }
  return { headers, rows, malformedLines, truncated };
}

/** ISO date or timestamp out, plus whether a slash date was ambiguous (both parts <= 12). */
export function parseObservedAt(raw: string): { iso: string | null; ambiguous: boolean } {
  const v = raw.trim();
  if (!v) return { iso: null, ambiguous: false };
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})([T ].*)?$/.exec(v);
  if (isoMatch) {
    const t = Date.parse(isoMatch[4] ? v.replace(" ", "T") : `${v}T00:00:00Z`);
    return Number.isNaN(t) ? { iso: null, ambiguous: false } : { iso: new Date(t).toISOString(), ambiguous: false };
  }
  const slash = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/.exec(v);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const y = Number(slash[3]);
    const ambiguous = a <= 12 && b <= 12 && a !== b;
    // Day-first is not assumed: when unambiguous, the part above 12 is the day.
    const month = a > 12 ? b : a;
    const day = a > 12 ? a : b;
    if (month < 1 || month > 12 || day < 1 || day > 31) return { iso: null, ambiguous };
    const t = Date.parse(`${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T00:00:00Z`);
    return Number.isNaN(t) ? { iso: null, ambiguous } : { iso: new Date(t).toISOString(), ambiguous };
  }
  return { iso: null, ambiguous: false };
}

/** Strict numeric parse. Thousands separators and a trailing percent are understood; anything else is a rejection. */
export function parseMetricValue(raw: string): { value: number | null; note: string | null } {
  const v = raw.trim();
  if (!v) return { value: null, note: "empty" };
  const percent = v.endsWith("%");
  const cleaned = (percent ? v.slice(0, -1) : v).replace(/[,\s]/g, "").replace(/^\$|^€|^£/, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return { value: null, note: "not a plain number" };
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return { value: null, note: "not finite" };
  return percent ? { value: n / 100, note: "percent converted to ratio" } : { value: n, note: null };
}

export interface VariantRef {
  id: string;
  label: string;
}

export interface CandidateRow {
  line: number;
  variant_twin_id: string;
  value: number;
  observed_at: string;
  date_ambiguous: boolean;
  notes: string[];
}

export interface RejectedRow {
  line: number;
  reason: string;
  raw: Record<string, string>;
}

export interface ImportPlan {
  accepted: CandidateRow[];
  rejected: RejectedRow[];
  malformedLines: Array<{ line: number; reason: string }>;
  truncated: boolean;
  /** Counts per variant so the reviewer sees coverage before writing anything. */
  perVariant: Array<{ variant_twin_id: string; label: string; rows: number }>;
  ambiguousDates: number;
}

export interface ImportInput {
  csvText: string;
  columnMap: ColumnMap;
  variants: VariantRef[];
  /** Metric key of the experiment; recorded on every accepted row. */
  metricKey: string;
}

/** Builds the import plan. Pure: writes nothing, decides nothing the reviewer cannot see. */
export function buildImportPlan(input: ImportInput): ImportPlan {
  const parsed = parseCsv(input.csvText);
  const accepted: CandidateRow[] = [];
  const rejected: RejectedRow[] = [];
  const byLabel = new Map(input.variants.map((v) => [v.label.trim().toLowerCase(), v.id]));
  const ids = new Set(input.variants.map((v) => v.id));

  const missingHeaders = [input.columnMap.variant, input.columnMap.value, input.columnMap.observedAt].filter(
    (h) => h !== "" && !parsed.headers.includes(h)
  );
  if (parsed.headers.length > 0 && missingHeaders.length > 0) {
    return {
      accepted: [],
      rejected: parsed.rows.map((raw, idx) => ({ line: idx + 2, reason: `Column mapping refers to headers not in the file: ${missingHeaders.join(", ")}.`, raw })),
      malformedLines: parsed.malformedLines,
      truncated: parsed.truncated,
      perVariant: input.variants.map((v) => ({ variant_twin_id: v.id, label: v.label, rows: 0 })),
      ambiguousDates: 0
    };
  }

  parsed.rows.forEach((raw, idx) => {
    const line = idx + 2;
    const variantRaw = (raw[input.columnMap.variant] ?? "").trim();
    const variantId = ids.has(variantRaw) ? variantRaw : byLabel.get(variantRaw.toLowerCase()) ?? null;
    if (!variantId) {
      rejected.push({ line, reason: variantRaw ? `Variant "${variantRaw}" is not one of this experiment's variants.` : "Variant cell is empty.", raw });
      return;
    }
    const { value, note } = parseMetricValue(raw[input.columnMap.value] ?? "");
    if (value === null) {
      rejected.push({ line, reason: `Value could not be read (${note}). Numbers are never guessed.`, raw });
      return;
    }
    const { iso, ambiguous } = parseObservedAt(raw[input.columnMap.observedAt] ?? "");
    if (!iso) {
      rejected.push({ line, reason: "Observation date could not be parsed. Use ISO (YYYY-MM-DD) to avoid ambiguity.", raw });
      return;
    }
    const notes: string[] = [];
    if (note) notes.push(note);
    if (ambiguous) notes.push("day and month are ambiguous in this file; interpreted as month-first");
    accepted.push({ line, variant_twin_id: variantId, value, observed_at: iso, date_ambiguous: ambiguous, notes });
  });

  return {
    accepted,
    rejected,
    malformedLines: parsed.malformedLines,
    truncated: parsed.truncated,
    perVariant: input.variants.map((v) => ({ variant_twin_id: v.id, label: v.label, rows: accepted.filter((a) => a.variant_twin_id === v.id).length })),
    ambiguousDates: accepted.filter((a) => a.date_ambiguous).length
  };
}

/** Guess a column mapping from headers. Returns empty strings where no confident match exists. */
export function suggestColumnMap(headers: string[]): ColumnMap {
  const find = (candidates: string[]) =>
    headers.find((h) => candidates.includes(h.trim().toLowerCase())) ?? "";
  return {
    variant: find(["variant", "twin", "creative", "variant_id", "variant id", "ad", "asset"]),
    value: find(["value", "metric_value", "metric value", "result", "amount"]),
    observedAt: find(["observed_at", "observed at", "date", "day", "timestamp", "reporting date"])
  };
}
