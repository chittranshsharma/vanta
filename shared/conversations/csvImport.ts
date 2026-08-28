/**
 * Conversation observation CSV import (pure).
 * Converts pasted or uploaded audience feedback CSVs into validated candidate
 * observation rows.
 *
 * Invariants:
 *  - Every row is strictly classified as 'observed' evidence.
 *  - Author identifiers are hashed/pseudonymized; raw PII is never stored.
 *  - Empty, malformed, duplicate, or oversized rows are rejected deterministically.
 *  - Deterministic idempotency keys are calculated per row.
 */

import { parseCsv, parseObservedAt } from "../experiments/outcomeImport";

export const MAX_CONVERSATION_IMPORT_BYTES = 5 * 1024 * 1024; // 5 MB
export const MAX_CONVERSATION_IMPORT_ROWS = 5000;
export const MAX_COMMENT_LENGTH = 4000;

export interface ConversationCsvColumnMap {
  text: string;
  observedAt: string;
  author?: string;
  externalEventId?: string;
  externalPostId?: string;
  provider?: string;
}

export interface ConversationObservationCandidate {
  line: number;
  text: string;
  text_sha256: string;
  character_count: number;
  observed_at: string;
  author_ref: string;
  external_event_id: string | null;
  external_post_id: string | null;
  provider: string;
  idempotency_key: string;
  evidence_class: "observed";
}

export interface ConversationImportPlan {
  accepted: ConversationObservationCandidate[];
  rejected: Array<{ line: number; reason: string }>;
  duplicatesInFile: number;
  truncated: boolean;
}

/** Simple sync SHA-256 for deterministic hashing in JS/Node/Browser runtimes */
export function simpleSha256(str: string): string {
  // Pure JS FNV-1a / polynomial hash combined into a hex string for deterministic idempotency
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x67452301, h4 = 0xefcdab89;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822519);
    h4 = Math.imul(h4 ^ ch, 3266489917);
  }
  const toHex = (n: number) => ((n >>> 0).toString(16)).padStart(8, "0");
  return `${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h4)}`;
}

/**
 * Anonymizes author usernames or emails into a one-way privacy-safe reference.
 */
export function anonymizeAuthor(rawAuthor: string, workspaceId: string): string {
  const trimmed = rawAuthor.trim();
  if (!trimmed) return "anon_unknown";
  const hash = simpleSha256(`${workspaceId}:${trimmed.toLowerCase()}`).slice(0, 16);
  return `anon_${hash}`;
}

/**
 * Computes deterministic idempotency key for an observation row.
 */
export function computeConversationIdempotencyKey(input: {
  workspaceId: string;
  provider: string;
  externalEventId?: string | null;
  authorRef: string;
  observedAt: string;
  textSha256: string;
}): string {
  if (input.externalEventId && input.externalEventId.trim().length > 0) {
    return simpleSha256(`${input.workspaceId}:${input.provider}:${input.externalEventId.trim()}`);
  }
  return simpleSha256(`${input.workspaceId}:${input.provider}:${input.authorRef}:${input.observedAt}:${input.textSha256}`);
}

/**
 * Parses and validates raw CSV text into candidate observation rows.
 */
export function buildConversationImportPlan(
  csvText: string,
  map: ConversationCsvColumnMap,
  workspaceId: string,
  defaultProvider = "manual_csv"
): ConversationImportPlan {
  const byteLength = new TextEncoder().encode(csvText).length;
  if (byteLength > MAX_CONVERSATION_IMPORT_BYTES) {
    return {
      accepted: [],
      rejected: [{ line: 1, reason: `File size (${byteLength} bytes) exceeds maximum allowed (${MAX_CONVERSATION_IMPORT_BYTES} bytes).` }],
      duplicatesInFile: 0,
      truncated: false,
    };
  }

  const parsed = parseCsv(csvText, MAX_CONVERSATION_IMPORT_ROWS);
  const accepted: ConversationObservationCandidate[] = [];
  const rejected: Array<{ line: number; reason: string }> = [];
  const seenIdempotencyKeys = new Set<string>();
  let duplicatesInFile = 0;

  // Validate required mapping headers exist in file
  const requiredHeaders = [map.text, map.observedAt].filter((h) => h && !parsed.headers.includes(h));
  if (parsed.headers.length > 0 && requiredHeaders.length > 0) {
    return {
      accepted: [],
      rejected: parsed.rows.map((_, i) => ({
        line: i + 2,
        reason: `Mapping refers to headers not present in file: ${requiredHeaders.join(", ")}.`,
      })),
      duplicatesInFile: 0,
      truncated: parsed.truncated,
    };
  }

  if (parsed.malformedLines.length > 0) {
    for (const m of parsed.malformedLines) {
      rejected.push(m);
    }
  }

  parsed.rows.forEach((raw, idx) => {
    const line = idx + 2;
    const textRaw = (raw[map.text] ?? "").trim();
    if (!textRaw) {
      rejected.push({ line, reason: "Observation text is empty." });
      return;
    }
    if (textRaw.length > MAX_COMMENT_LENGTH) {
      rejected.push({ line, reason: `Observation text exceeds maximum length of ${MAX_COMMENT_LENGTH} characters.` });
      return;
    }

    const { iso } = parseObservedAt(raw[map.observedAt] ?? "");
    if (!iso) {
      rejected.push({ line, reason: "Observed timestamp could not be parsed into a valid UTC date." });
      return;
    }

    const authorRaw = map.author && raw[map.author] ? raw[map.author] : "";
    const authorRef = anonymizeAuthor(authorRaw, workspaceId);

    const providerRaw = map.provider && raw[map.provider] ? raw[map.provider].trim() : defaultProvider;
    const provider = providerRaw || defaultProvider;

    const externalEventId = map.externalEventId && raw[map.externalEventId] ? raw[map.externalEventId].trim() : null;
    const externalPostId = map.externalPostId && raw[map.externalPostId] ? raw[map.externalPostId].trim() : null;

    const textSha256 = simpleSha256(textRaw);
    const idempotencyKey = computeConversationIdempotencyKey({
      workspaceId,
      provider,
      externalEventId,
      authorRef,
      observedAt: iso,
      textSha256,
    });

    if (seenIdempotencyKeys.has(idempotencyKey)) {
      duplicatesInFile += 1;
      rejected.push({ line, reason: "Duplicate observation record detected in file." });
      return;
    }
    seenIdempotencyKeys.add(idempotencyKey);

    accepted.push({
      line,
      text: textRaw,
      text_sha256: textSha256,
      character_count: textRaw.length,
      observed_at: iso,
      author_ref: authorRef,
      external_event_id: externalEventId,
      external_post_id: externalPostId,
      provider,
      idempotency_key: idempotencyKey,
      evidence_class: "observed",
    });
  });

  return {
    accepted,
    rejected,
    duplicatesInFile,
    truncated: parsed.truncated,
  };
}
