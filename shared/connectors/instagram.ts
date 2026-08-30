/**
 * Vanta Official Platform Connector: Instagram / Meta Graph API Contracts (Phase 4).
 *
 * Pure domain module with zero network calls and zero DB mutations.
 * Enforces Vanta's Evidence Constitution:
 * - Observed metrics require official provider responses with source identity, capture time, and metric metadata.
 * - Author identifiers in comments are pseudonymized (anon_<sha256>).
 * - Cross-workspace foreign references fail closed.
 * - Webhooks and OAuth state require HMAC-SHA256 verification.
 */

import { createHmac, timingSafeEqual, createHash } from "node:crypto";

// ============================================================================
// 1. OAUTH & CSRF STATE MACHINE
// ============================================================================

export interface InstagramOAuthStatePayload {
  workspaceId: string;
  userId: string;
  nonce: string;
  issuedAt: number; // Unix timestamp ms
  expiresAt: number; // Unix timestamp ms
}

export interface InstagramOAuthStateResult {
  stateString: string;
  payload: InstagramOAuthStatePayload;
}

export type OAuthStateVerification =
  | { valid: true; payload: InstagramOAuthStatePayload }
  | { valid: false; error: "invalid_format" | "tampered_signature" | "expired_state" | "invalid_payload" };

/**
 * Creates an HMAC-signed OAuth state string encoding workspace, user, nonce, and expiration.
 */
export function createInstagramOAuthState(input: {
  workspaceId: string;
  userId: string;
  secret: string;
  expiresInSeconds?: number;
  nonce?: string;
  now?: number;
}): InstagramOAuthStateResult {
  const now = input.now ?? Date.now();
  const expiresInMs = (input.expiresInSeconds ?? 600) * 1000; // default 10m
  const nonce = input.nonce ?? createHash("sha256").update(`${input.workspaceId}:${input.userId}:${now}:${Math.random()}`).digest("hex").slice(0, 16);

  const payload: InstagramOAuthStatePayload = {
    workspaceId: input.workspaceId,
    userId: input.userId,
    nonce,
    issuedAt: now,
    expiresAt: now + expiresInMs,
  };

  const json = JSON.stringify(payload);
  const b64Payload = Buffer.from(json, "utf8").toString("base64url");
  const signature = createHmac("sha256", input.secret).update(b64Payload).digest("base64url");

  return {
    stateString: `${b64Payload}.${signature}`,
    payload,
  };
}

/**
 * Verifies an incoming OAuth state string against the server secret and expiration time.
 */
export function verifyInstagramOAuthState(input: {
  stateString: string;
  secret: string;
  now?: number;
}): OAuthStateVerification {
  const parts = input.stateString.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { valid: false, error: "invalid_format" };
  }

  const [b64Payload, presentedSig] = parts;
  const expectedSig = createHmac("sha256", input.secret).update(b64Payload).digest("base64url");

  const expectedBuf = Buffer.from(expectedSig, "utf8");
  const presentedBuf = Buffer.from(presentedSig, "utf8");

  if (expectedBuf.length !== presentedBuf.length || !timingSafeEqual(expectedBuf, presentedBuf)) {
    return { valid: false, error: "tampered_signature" };
  }

  let payload: unknown;
  try {
    const raw = Buffer.from(b64Payload, "base64url").toString("utf8");
    payload = JSON.parse(raw);
  } catch {
    return { valid: false, error: "invalid_payload" };
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { valid: false, error: "invalid_payload" };
  }

  const p = payload as Record<string, unknown>;
  if (
    typeof p.workspaceId !== "string" ||
    typeof p.userId !== "string" ||
    typeof p.nonce !== "string" ||
    typeof p.issuedAt !== "number" ||
    typeof p.expiresAt !== "number"
  ) {
    return { valid: false, error: "invalid_payload" };
  }

  const now = input.now ?? Date.now();
  if (now > p.expiresAt) {
    return { valid: false, error: "expired_state" };
  }

  return {
    valid: true,
    payload: {
      workspaceId: p.workspaceId,
      userId: p.userId,
      nonce: p.nonce,
      issuedAt: p.issuedAt,
      expiresAt: p.expiresAt,
    },
  };
}

// ============================================================================
// 2. WEBHOOK SIGNATURE VERIFICATION
// ============================================================================

export type WebhookSignatureVerification =
  | { valid: true }
  | { valid: false; error: "missing_signature" | "invalid_format" | "signature_mismatch" };

/**
 * Validates Meta's X-Hub-Signature-256 header against the raw body payload.
 */
export function verifyInstagramWebhookSignature(input: {
  rawBody: string | Buffer;
  headerSignature: string | null | undefined;
  appSecret: string;
}): WebhookSignatureVerification {
  if (!input.headerSignature) {
    return { valid: false, error: "missing_signature" };
  }

  const parts = input.headerSignature.split("=");
  if (parts.length !== 2 || parts[0] !== "sha256" || !parts[1]) {
    return { valid: false, error: "invalid_format" };
  }

  const presentedHex = parts[1].toLowerCase();
  const expectedHex = createHmac("sha256", input.appSecret)
    .update(typeof input.rawBody === "string" ? Buffer.from(input.rawBody, "utf8") : input.rawBody)
    .digest("hex")
    .toLowerCase();

  const presentedBuf = Buffer.from(presentedHex, "hex");
  const expectedBuf = Buffer.from(expectedHex, "hex");

  if (presentedBuf.length !== expectedBuf.length || !timingSafeEqual(presentedBuf, expectedBuf)) {
    return { valid: false, error: "signature_mismatch" };
  }

  return { valid: true };
}

// ============================================================================
// 3. ERROR & TOKEN REVOCATION CATEGORIZATION
// ============================================================================

export interface InstagramApiErrorShape {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    is_transient?: boolean;
    error_user_title?: string;
    error_user_msg?: string;
  };
}

export type CategorizedInstagramError =
  | { kind: "revoked_token"; subcode?: number; message: string; retriable: false }
  | { kind: "permission_denied"; code: number; message: string; retriable: false }
  | { kind: "rate_limited"; retryAfterSeconds: number; message: string; retriable: true }
  | { kind: "transient"; message: string; retriable: true }
  | { kind: "malformed_request"; message: string; retriable: false }
  | { kind: "unknown"; message: string; retriable: false };

/**
 * Categorizes an error response from Meta Graph API.
 */
export function categorizeInstagramError(
  errorResp: unknown,
  headers?: Record<string, string | undefined>
): CategorizedInstagramError {
  // Check rate limit header
  const bucUsage = headers?.["x-business-use-case-usage"] || headers?.["X-Business-Use-Case-Usage"];
  if (bucUsage) {
    try {
      const parsed = JSON.parse(bucUsage);
      if (typeof parsed === "object" && parsed !== null) {
        // Any account exceeding 100% capacity
        for (const entries of Object.values(parsed)) {
          if (Array.isArray(entries)) {
            for (const item of entries) {
              if (item.call_count >= 100 || item.total_time >= 100 || item.total_cputime >= 100) {
                const waitSec = typeof item.estimated_time_to_regain_access === "number" ? item.estimated_time_to_regain_access * 60 : 300;
                return { kind: "rate_limited", retryAfterSeconds: waitSec, message: "Business Use Case rate limit exceeded", retriable: true };
              }
            }
          }
        }
      }
    } catch {
      // Ignore header parse error and fallback to error body
    }
  }

  if (!errorResp || typeof errorResp !== "object") {
    return { kind: "unknown", message: "Non-object error response", retriable: false };
  }

  const err = (errorResp as InstagramApiErrorShape).error;
  if (!err) {
    return { kind: "unknown", message: "Unknown error structure", retriable: false };
  }

  const code = err.code ?? 0;
  const subcode = err.error_subcode;
  const message = err.message ?? "Unknown Meta Graph API error";

  // Revoked / Expired Token subcodes
  // 190: Invalid OAuth 2.0 Access Token
  // 458: App not installed / uninstalled
  // 460: Password changed
  // 463: Token expired
  // 467: Invalid access token
  if (code === 190 || subcode === 458 || subcode === 460 || subcode === 463 || subcode === 467) {
    return { kind: "revoked_token", subcode, message, retriable: false };
  }

  // Permission / Capability Denied
  // 10: Permission denied or missing capability
  // 200-299: Permission errors
  // 80004: User not authorized to access business account
  if (code === 10 || code === 80004 || (code >= 200 && code <= 299)) {
    return { kind: "permission_denied", code, message, retriable: false };
  }

  // Rate Limiting error codes
  // 4: Application request limit reached
  // 17: User request limit reached
  // 32: Page request limit reached
  // 613: Custom-level calls limit reached
  if (code === 4 || code === 17 || code === 32 || code === 613) {
    return { kind: "rate_limited", retryAfterSeconds: 300, message, retriable: true };
  }

  // Transient Platform Errors
  // 1: An unknown error occurred
  // 2: Service temporarily unavailable
  if (code === 1 || code === 2 || err.is_transient === true) {
    return { kind: "transient", message, retriable: true };
  }

  // Bad Request / Malformed
  if (code === 100) {
    return { kind: "malformed_request", message, retriable: false };
  }

  return { kind: "unknown", message: `Meta error ${code}: ${message}`, retriable: false };
}

// ============================================================================
// 4. EVENT NORMALIZATION & PROVENANCE PIPELINE
// ============================================================================

export interface RawInstagramMedia {
  id: string;
  media_type: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  caption?: string;
  permalink?: string;
  timestamp: string; // ISO 8601
  like_count?: number;
  comments_count?: number;
}

export interface NormalizedPostEvent {
  sourceId: string;
  workspaceId: string;
  externalPostId: string;
  idempotencyKey: string;
  mediaKind: "image" | "video" | "carousel";
  caption: string;
  permalink: string | null;
  postedAt: string;
  capturedAt: string;
  evidenceClass: "observed";
  provenance: {
    provider: "meta";
    surface: "instagram_graph_api";
    apiVersion: string;
  };
}

/**
 * Normalizes a raw Instagram media record into Vanta's deterministic post event.
 */
export function normalizeInstagramPost(input: {
  rawMedia: RawInstagramMedia;
  sourceId: string;
  workspaceId: string;
  capturedAt?: string;
  apiVersion?: string;
}): NormalizedPostEvent {
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const kindMap: Record<RawInstagramMedia["media_type"], NormalizedPostEvent["mediaKind"]> = {
    IMAGE: "image",
    VIDEO: "video",
    CAROUSEL_ALBUM: "carousel",
  };

  return {
    sourceId: input.sourceId,
    workspaceId: input.workspaceId,
    externalPostId: input.rawMedia.id,
    idempotencyKey: `ig_post_${input.rawMedia.id}`,
    mediaKind: kindMap[input.rawMedia.media_type] ?? "video",
    caption: input.rawMedia.caption ?? "",
    permalink: input.rawMedia.permalink ?? null,
    postedAt: input.rawMedia.timestamp,
    capturedAt,
    evidenceClass: "observed",
    provenance: {
      provider: "meta",
      surface: "instagram_graph_api",
      apiVersion: input.apiVersion ?? "v20.0",
    },
  };
}

export interface RawInstagramInsightValue {
  value: number;
  end_time?: string;
}

export interface RawInstagramInsightItem {
  name: string;
  period: string;
  values: RawInstagramInsightValue[];
  title?: string;
  description?: string;
  id: string;
}

export interface NormalizedObservedMetric {
  sourceId: string;
  workspaceId: string;
  externalPostId: string;
  metricKey: string;
  observedValue: number;
  unit: string;
  measurementWindow: "lifetime" | "24h" | "total";
  capturedAt: string;
  evidenceClass: "observed";
  idempotencyKey: string;
}

/**
 * Normalizes Instagram Insights into Vanta's typed observed metric rows.
 */
export function normalizeInstagramInsights(input: {
  rawInsights: RawInstagramInsightItem[];
  sourceId: string;
  workspaceId: string;
  externalPostId: string;
  capturedAt?: string;
}): NormalizedObservedMetric[] {
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const results: NormalizedObservedMetric[] = [];

  const METRIC_MAP: Record<string, { key: string; unit: string }> = {
    reach: { key: "reach", unit: "accounts" },
    impressions: { key: "impressions", unit: "views" },
    saved: { key: "saved", unit: "saves" },
    shares: { key: "shares", unit: "shares" },
    total_interactions: { key: "total_interactions", unit: "interactions" },
    plays: { key: "video_plays", unit: "plays" },
    clips_replays_count: { key: "replays", unit: "replays" },
    ig_reels_video_view_total_time: { key: "watch_time_ms", unit: "ms" },
    ig_reels_avg_watch_time: { key: "avg_watch_time_ms", unit: "ms" },
  };

  for (const item of input.rawInsights) {
    const mapped = METRIC_MAP[item.name];
    if (!mapped) continue; // Ignore unknown or unmapped metrics safely

    const latestVal = item.values && item.values.length > 0 ? item.values[item.values.length - 1].value : undefined;
    if (typeof latestVal !== "number" || !Number.isFinite(latestVal)) continue;

    results.push({
      sourceId: input.sourceId,
      workspaceId: input.workspaceId,
      externalPostId: input.externalPostId,
      metricKey: mapped.key,
      observedValue: latestVal,
      unit: mapped.unit,
      measurementWindow: item.period === "lifetime" ? "lifetime" : "total",
      capturedAt,
      evidenceClass: "observed",
      idempotencyKey: `ig_metric_${input.externalPostId}_${mapped.key}`,
    });
  }

  return results;
}

export interface RawInstagramComment {
  id: string;
  text: string;
  timestamp: string;
  from?: {
    id: string;
    username?: string;
  };
}

export interface NormalizedConversationObservation {
  sourceId: string;
  workspaceId: string;
  externalEventId: string;
  idempotencyKey: string;
  authorRef: string;
  rawText: string;
  textSha256: string;
  characterCount: number;
  observedAt: string;
  capturedAt: string;
  evidenceClass: "observed";
  reviewState: "unreviewed";
}

/**
 * Normalizes an Instagram comment into a pseudonymized conversation observation row.
 */
export function normalizeInstagramComment(input: {
  rawComment: RawInstagramComment;
  sourceId: string;
  workspaceId: string;
  capturedAt?: string;
}): NormalizedConversationObservation {
  const capturedAt = input.capturedAt ?? new Date().toISOString();
  const rawText = input.rawComment.text ?? "";
  const textSha256 = createHash("sha256").update(rawText, "utf8").digest("hex");

  // Author Pseudonymization Invariant: Hash user id with source-level salt
  const authorRaw = input.rawComment.from?.id ?? "anonymous";
  const authorHash = createHash("sha256").update(`ig_author:${authorRaw}:${input.sourceId}`).digest("hex").slice(0, 16);
  const authorRef = `anon_${authorHash}`;

  return {
    sourceId: input.sourceId,
    workspaceId: input.workspaceId,
    externalEventId: input.rawComment.id,
    idempotencyKey: `ig_comment_${input.rawComment.id}`,
    authorRef,
    rawText,
    textSha256,
    characterCount: rawText.length,
    observedAt: input.rawComment.timestamp,
    capturedAt,
    evidenceClass: "observed",
    reviewState: "unreviewed",
  };
}

// ============================================================================
// 5. TENANT ISOLATION & ATTRIBUTION GUARD
// ============================================================================

export type AttributionValidationResult =
  | { allowed: true }
  | { allowed: false; error: "cross_tenant_rejected"; reason: string };

/**
 * Ensures that post, variant twin, and claim records belong strictly to the same workspace.
 */
export function validatePostAttribution(input: {
  targetWorkspaceId: string;
  postWorkspaceId: string;
  variantTwinWorkspaceId: string;
  sourceWorkspaceId: string;
}): AttributionValidationResult {
  if (
    input.postWorkspaceId !== input.targetWorkspaceId ||
    input.variantTwinWorkspaceId !== input.targetWorkspaceId ||
    input.sourceWorkspaceId !== input.targetWorkspaceId
  ) {
    return {
      allowed: false,
      error: "cross_tenant_rejected",
      reason: "Attempted to attribute post, twin, or source across different tenant workspaces.",
    };
  }
  return { allowed: true };
}
