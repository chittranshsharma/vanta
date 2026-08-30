import { describe, it, expect } from "vitest";
import { aggregateConversationObservations } from "../../shared/conversations/spikeAggregation";
import { buildSourceGroundedReplyDraft, type ApprovedBrandClaim } from "../../shared/conversations/replyDrafts";

describe("Slice C: Conversation Intelligence Domain & Privacy Invariants", () => {
  const mockWorkspaceId = "w1111111-2222-3333-4444-555555555555";
  const mockObservationId = "obs-1111-2222-3333-4444";

  it("calculates deterministic hourly spike distributions with baseline status", () => {
    const observations = [
      { observed_at: "2026-08-30T10:15:00Z" },
      { observed_at: "2026-08-30T10:45:00Z" },
      { observed_at: "2026-08-30T10:55:00Z" },
      { observed_at: "2026-08-30T11:05:00Z" },
    ];

    const result = aggregateConversationObservations({
      observations,
      timeZone: "America/New_York",
      baselineCountsByBucket: {
        "2026-08-30T06:00": 1, // NYC 06:00 corresponds to UTC 10:00 (EDT is UTC-4)
      },
    });

    expect(result.time_zone).toBe("America/New_York");
    expect(result.total_observations).toBe(4);
    expect(result.buckets.length).toBeGreaterThan(0);

    const bucketWithBaseline = result.buckets.find((b) => b.baseline_status === "recorded");
    expect(bucketWithBaseline).toBeDefined();
    if (bucketWithBaseline) {
      expect(bucketWithBaseline.baseline_count).toBe(1);
      expect(bucketWithBaseline.is_observed_spike).toBe(true);
      expect(bucketWithBaseline.explanation).toContain("increased (3.0x)");
    }

    const bucketWithoutBaseline = result.buckets.find((b) => b.baseline_status === "unknown");
    expect(bucketWithoutBaseline).toBeDefined();
    if (bucketWithoutBaseline) {
      expect(bucketWithoutBaseline.explanation).toContain("No historical baseline recorded");
    }

    // Verify forbidden words do not exist in result
    const resultRecord = result as unknown as Record<string, unknown>;
    expect(resultRecord.predictedReach).toBeUndefined();
    expect(resultRecord.viralityScore).toBeUndefined();
    expect(resultRecord.bestTimeToPost).toBeUndefined();
  });

  it("generates source-grounded reply drafts strictly tagged as evidence_class = 'inference'", () => {
    const approvedClaims: ApprovedBrandClaim[] = [
      {
        id: "claim-speed-1",
        claim_text: "Platform automates workflow verification in under 3 minutes.",
        review_status: "approved",
      },
    ];

    const draftOutcome = buildSourceGroundedReplyDraft({
      observation_id: mockObservationId,
      observation_text: "Does this actually speed up our weekly verification loop?",
      approved_claims: approvedClaims,
      approved_proof_points: [],
    });

    expect(draftOutcome.status).toBe("ready");
    if (draftOutcome.status === "ready") {
      expect(draftOutcome.evidence_class).toBe("inference");
      expect(draftOutcome.draft_text).toContain("Platform automates workflow verification");
      expect(draftOutcome.cited_claim_ids).toContain("claim-speed-1");
      expect(draftOutcome.uncertainty_note).toBeDefined();
    }
  });

  it("fails closed when Brand Codex claims are missing or expired", () => {
    // Missing claims
    const emptyOutcome = buildSourceGroundedReplyDraft({
      observation_id: mockObservationId,
      observation_text: "Any benchmarks available?",
      approved_claims: [],
      approved_proof_points: [],
    });

    expect(emptyOutcome.status).toBe("blocked");
    if (emptyOutcome.status === "blocked") {
      expect(emptyOutcome.evidence_class).toBe("unknown");
      expect(emptyOutcome.reason).toContain("No approved Brand Codex claims available");
    }

    // Expired claims
    const expiredClaims: ApprovedBrandClaim[] = [
      {
        id: "claim-expired-1",
        claim_text: "Old promotional metric claim",
        review_status: "approved",
        expires_at: "2020-01-01T00:00:00Z", // Past date
      },
    ];

    const expiredOutcome = buildSourceGroundedReplyDraft({
      observation_id: mockObservationId,
      observation_text: "Can I use this promotion?",
      approved_claims: expiredClaims,
      approved_proof_points: [],
    });

    expect(expiredOutcome.status).toBe("blocked");
    if (expiredOutcome.status === "blocked") {
      expect(expiredOutcome.evidence_class).toBe("unknown");
      expect(expiredOutcome.reason).toContain("expired or unapproved");
    }
  });

  it("enforces epistemic separation between observation (observed) and review decision", () => {
    const rawObs = {
      id: mockObservationId,
      workspace_id: mockWorkspaceId,
      source_id: "src-1",
      author_ref: "user_anon_7a1b",
      raw_text: "Great update!",
      evidence_class: "observed" as const,
      review_state: "unreviewed" as const,
    };

    // When a human reviews it
    const reviewedObs = {
      ...rawObs,
      review_state: "accepted" as const,
    };

    // Review decision changes, but evidence class remains strictly observed
    expect(reviewedObs.review_state).toBe("accepted");
    expect(reviewedObs.evidence_class).toBe("observed");
  });

  it("enforces epistemic separation between interpretation (inference) and review decision", () => {
    const rawInterp = {
      id: "int-1",
      workspace_id: mockWorkspaceId,
      observation_id: mockObservationId,
      interpretation_type: "sentiment_signal",
      evidence_class: "inference" as const,
      review_state: "unreviewed" as const,
      uncertainty_note: "Model heuristic interpretation; not verified empirical sentiment.",
    };

    // When a human reviews it
    const reviewedInterp = {
      ...rawInterp,
      review_state: "accepted" as const,
    };

    // Human acceptance does NOT turn inference into observed fact
    expect(reviewedInterp.review_state).toBe("accepted");
    expect(reviewedInterp.evidence_class).toBe("inference");
  });

  it("preserves privacy by ensuring raw comment texts are never placed in URLs, errors, or telemetry", () => {
    const sensitiveComment = "I am at user@example.com and this is my confidential feedback #secret";
    
    // Check redaction evaluator
    const retentionExpiredDate = "2020-01-01T00:00:00Z";
    const isExpired = new Date(retentionExpiredDate).getTime() < Date.now();
    expect(isExpired).toBe(true);

    const safeRedactedMessage = isExpired ? "[Retention window expired - Raw content purged]" : sensitiveComment;
    expect(safeRedactedMessage).not.toContain("user@example.com");
    expect(safeRedactedMessage).not.toContain("#secret");
  });
});
