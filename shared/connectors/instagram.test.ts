import { describe, it, expect } from "vitest";
import {
  createInstagramOAuthState,
  verifyInstagramOAuthState,
  verifyInstagramWebhookSignature,
  categorizeInstagramError,
  normalizeInstagramPost,
  normalizeInstagramInsights,
  normalizeInstagramComment,
  validatePostAttribution,
  type RawInstagramMedia,
  type RawInstagramInsightItem,
  type RawInstagramComment,
} from "./instagram";
import { createHmac } from "node:crypto";

describe("Instagram Connector: OAuth & CSRF State Machine", () => {
  const SECRET = "test_oauth_state_secret_32_bytes_len_!";
  const WS_ID = "11111111-1111-4111-8111-111111111111";
  const USER_ID = "22222222-2222-4222-8222-222222222222";

  it("generates and successfully verifies valid OAuth state", () => {
    const now = 1700000000000;
    const { stateString, payload } = createInstagramOAuthState({
      workspaceId: WS_ID,
      userId: USER_ID,
      secret: SECRET,
      expiresInSeconds: 300,
      now,
    });

    expect(stateString).toContain(".");
    expect(payload.workspaceId).toBe(WS_ID);
    expect(payload.userId).toBe(USER_ID);

    const verified = verifyInstagramOAuthState({
      stateString,
      secret: SECRET,
      now: now + 60000, // 1 minute later
    });

    expect(verified.valid).toBe(true);
    if (verified.valid) {
      expect(verified.payload.workspaceId).toBe(WS_ID);
      expect(verified.payload.userId).toBe(USER_ID);
      expect(verified.payload.nonce).toBe(payload.nonce);
    }
  });

  it("rejects expired state strings (fail-closed)", () => {
    const now = 1700000000000;
    const { stateString } = createInstagramOAuthState({
      workspaceId: WS_ID,
      userId: USER_ID,
      secret: SECRET,
      expiresInSeconds: 300,
      now,
    });

    const verified = verifyInstagramOAuthState({
      stateString,
      secret: SECRET,
      now: now + 301000, // 301 seconds later (expired)
    });

    expect(verified.valid).toBe(false);
    if (!verified.valid) {
      expect(verified.error).toBe("expired_state");
    }
  });

  it("rejects tampered signatures and modified payloads", () => {
    const { stateString } = createInstagramOAuthState({
      workspaceId: WS_ID,
      userId: USER_ID,
      secret: SECRET,
    });

    const [b64Payload] = stateString.split(".");
    const tampered = `${b64Payload}.invalid_signature_hex`;

    const verified = verifyInstagramOAuthState({
      stateString: tampered,
      secret: SECRET,
    });

    expect(verified.valid).toBe(false);
    if (!verified.valid) {
      expect(verified.error).toBe("tampered_signature");
    }
  });

  it("rejects malformed state strings", () => {
    const verified = verifyInstagramOAuthState({
      stateString: "not_a_valid_state_string",
      secret: SECRET,
    });
    expect(verified.valid).toBe(false);
    if (!verified.valid) {
      expect(verified.error).toBe("invalid_format");
    }
  });
});

describe("Instagram Connector: Webhook Signature Verification", () => {
  const APP_SECRET = "meta_app_secret_hex_string_12345";
  const RAW_PAYLOAD = JSON.stringify({
    object: "instagram",
    entry: [{ id: "17841400", time: 1700000000 }],
  });

  it("accepts valid X-Hub-Signature-256 header", () => {
    const expectedHex = createHmac("sha256", APP_SECRET).update(RAW_PAYLOAD).digest("hex");
    const header = `sha256=${expectedHex}`;

    const res = verifyInstagramWebhookSignature({
      rawBody: RAW_PAYLOAD,
      headerSignature: header,
      appSecret: APP_SECRET,
    });

    expect(res.valid).toBe(true);
  });

  it("rejects missing, malformed, or mismatched signatures", () => {
    expect(
      verifyInstagramWebhookSignature({
        rawBody: RAW_PAYLOAD,
        headerSignature: null,
        appSecret: APP_SECRET,
      })
    ).toEqual({ valid: false, error: "missing_signature" });

    expect(
      verifyInstagramWebhookSignature({
        rawBody: RAW_PAYLOAD,
        headerSignature: "invalid_format",
        appSecret: APP_SECRET,
      })
    ).toEqual({ valid: false, error: "invalid_format" });

    expect(
      verifyInstagramWebhookSignature({
        rawBody: RAW_PAYLOAD,
        headerSignature: "sha256=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        appSecret: APP_SECRET,
      })
    ).toEqual({ valid: false, error: "signature_mismatch" });
  });
});

describe("Instagram Connector: Error & Revocation Categorization", () => {
  it("categorizes revoked or expired tokens correctly", () => {
    const err = { error: { code: 190, error_subcode: 463, message: "Error validating access token: Session has expired" } };
    const res = categorizeInstagramError(err);
    expect(res.kind).toBe("revoked_token");
    expect(res.retriable).toBe(false);
  });

  it("categorizes permission denials correctly", () => {
    const err = { error: { code: 80004, message: "User is not authorized to access business account" } };
    const res = categorizeInstagramError(err);
    expect(res.kind).toBe("permission_denied");
    expect(res.retriable).toBe(false);
  });

  it("categorizes rate limits from response code and headers", () => {
    const err = { error: { code: 4, message: "Application request limit reached" } };
    const res = categorizeInstagramError(err);
    expect(res.kind).toBe("rate_limited");
    expect(res.retriable).toBe(true);

    // Business Use Case Header
    const bucHeader = {
      "x-business-use-case-usage": JSON.stringify({
        "123456": [{ call_count: 105, total_time: 50, total_cputime: 20, estimated_time_to_regain_access: 10 }],
      }),
    };
    const resHeader = categorizeInstagramError({}, bucHeader);
    expect(resHeader.kind).toBe("rate_limited");
    expect(resHeader.retriable).toBe(true);
    if (resHeader.kind === "rate_limited") {
      expect(resHeader.retryAfterSeconds).toBe(600); // 10 minutes * 60s
    }
  });

  it("categorizes transient service errors", () => {
    const err = { error: { code: 2, message: "Service temporarily unavailable", is_transient: true } };
    const res = categorizeInstagramError(err);
    expect(res.kind).toBe("transient");
    expect(res.retriable).toBe(true);
  });
});

describe("Instagram Connector: Event Normalization", () => {
  const WS_ID = "ws_test_123";
  const SRC_ID = "src_test_123";

  it("normalizes raw media into typed post event with idempotency key", () => {
    const raw: RawInstagramMedia = {
      id: "17999888777",
      media_type: "VIDEO",
      caption: "Check out our new feature breakdown!",
      permalink: "https://instagram.com/p/Cxyz123",
      timestamp: "2026-08-30T12:00:00Z",
      like_count: 150,
      comments_count: 12,
    };

    const post = normalizeInstagramPost({
      rawMedia: raw,
      sourceId: SRC_ID,
      workspaceId: WS_ID,
      capturedAt: "2026-08-30T12:05:00Z",
    });

    expect(post.externalPostId).toBe("17999888777");
    expect(post.idempotencyKey).toBe("ig_post_17999888777");
    expect(post.mediaKind).toBe("video");
    expect(post.evidenceClass).toBe("observed");
    expect(post.provenance.provider).toBe("meta");
  });

  it("normalizes raw insights into typed observed metrics", () => {
    const rawInsights: RawInstagramInsightItem[] = [
      { id: "179/insights/reach", name: "reach", period: "lifetime", values: [{ value: 4500 }] },
      { id: "179/insights/saved", name: "saved", period: "lifetime", values: [{ value: 320 }] },
      { id: "179/insights/shares", name: "shares", period: "lifetime", values: [{ value: 85 }] },
      { id: "179/insights/video_views", name: "plays", period: "lifetime", values: [{ value: 6200 }] },
      { id: "179/insights/unmapped", name: "unknown_metric", period: "lifetime", values: [{ value: 999 }] },
    ];

    const metrics = normalizeInstagramInsights({
      rawInsights,
      sourceId: SRC_ID,
      workspaceId: WS_ID,
      externalPostId: "17999888777",
    });

    expect(metrics.length).toBe(4);
    expect(metrics.map((m) => m.metricKey)).toEqual(["reach", "saved", "shares", "video_plays"]);
    expect(metrics[0].observedValue).toBe(4500);
    expect(metrics[0].evidenceClass).toBe("observed");
    expect(metrics[0].idempotencyKey).toBe("ig_metric_17999888777_reach");
  });

  it("normalizes comments with pseudonymized author reference", () => {
    const rawComment: RawInstagramComment = {
      id: "99887766",
      text: "Is there support for custom fonts?",
      timestamp: "2026-08-30T12:30:00Z",
      from: { id: "user_ig_999", username: "designer_alex" },
    };

    const comment = normalizeInstagramComment({
      rawComment,
      sourceId: SRC_ID,
      workspaceId: WS_ID,
    });

    expect(comment.externalEventId).toBe("99887766");
    expect(comment.idempotencyKey).toBe("ig_comment_99887766");
    expect(comment.authorRef).toMatch(/^anon_[a-f0-9]{16}$/);
    expect(comment.authorRef).not.toContain("designer_alex");
    expect(comment.authorRef).not.toContain("user_ig_999");
    expect(comment.evidenceClass).toBe("observed");
    expect(comment.reviewState).toBe("unreviewed");
  });
});

describe("Instagram Connector: Multi-Tenant Attribution Guard", () => {
  it("allows attribution within the exact same workspace", () => {
    const res = validatePostAttribution({
      targetWorkspaceId: "ws_a",
      postWorkspaceId: "ws_a",
      variantTwinWorkspaceId: "ws_a",
      sourceWorkspaceId: "ws_a",
    });
    expect(res.allowed).toBe(true);
  });

  it("rejects cross-tenant attribution attempts (fail-closed)", () => {
    const res = validatePostAttribution({
      targetWorkspaceId: "ws_a",
      postWorkspaceId: "ws_a",
      variantTwinWorkspaceId: "ws_b", // Cross-tenant leak attempt!
      sourceWorkspaceId: "ws_a",
    });
    expect(res.allowed).toBe(false);
    if (!res.allowed) {
      expect(res.error).toBe("cross_tenant_rejected");
    }
  });
});
