import { describe, expect, it } from "vitest";
import {
  buildSourceGroundedReplyDraft,
  type ApprovedBrandClaim,
  type ApprovedProofPoint,
  type DestinationCta,
  type ReplyDraftRequest,
} from "./replyDrafts";

describe("buildSourceGroundedReplyDraft", () => {
  it("blocks drafting when no approved claims exist", () => {
    const req: ReplyDraftRequest = {
      observation_id: "obs-1",
      observation_text: "Does this charge fast?",
      approved_claims: [],
      approved_proof_points: [],
    };
    const outcome = buildSourceGroundedReplyDraft(req);
    expect(outcome.status).toBe("blocked");
    if (outcome.status === "blocked") {
      expect(outcome.reason).toMatch(/No approved Brand Codex claims/);
      expect(outcome.evidence_class).toBe("unknown");
    }
  });

  it("blocks drafting when claim is expired", () => {
    const req: ReplyDraftRequest = {
      observation_id: "obs-1",
      observation_text: "Is this still 20% off?",
      approved_claims: [
        {
          id: "claim-1",
          claim_text: "20% off discount",
          review_status: "approved",
          expires_at: "2020-01-01T00:00:00Z",
        },
      ],
      approved_proof_points: [],
    };
    const outcome = buildSourceGroundedReplyDraft(req);
    expect(outcome.status).toBe("blocked");
    if (outcome.status === "blocked") {
      expect(outcome.reason).toMatch(/expired or unapproved/);
    }
  });

  it("builds grounded draft citing approved claim, proof point, and CTA URL", () => {
    const claims: ApprovedBrandClaim[] = [
      {
        id: "claim-battery",
        claim_text: "Charges to 80% in 15 minutes",
        review_status: "approved",
      },
    ];
    const proof: ApprovedProofPoint[] = [
      {
        id: "proof-lab",
        claim_id: "claim-battery",
        proof_text: "Lab test certificate #402",
        review_status: "approved",
      },
    ];
    const cta: DestinationCta = {
      identifier: "cta-specs",
      label: "Specs Sheet",
      url: "https://example.com/specs",
      required_disclosure: "Results may vary by adapter.",
    };

    const outcome = buildSourceGroundedReplyDraft({
      observation_id: "obs-1",
      observation_text: "How fast does it charge?",
      approved_claims: claims,
      approved_proof_points: proof,
      destination_cta: cta,
      fixed_disclaimer: "Terms apply.",
    });

    expect(outcome.status).toBe("ready");
    if (outcome.status === "ready") {
      expect(outcome.draft_text).toContain("Charges to 80% in 15 minutes");
      expect(outcome.draft_text).toContain("Lab test certificate #402");
      expect(outcome.draft_text).toContain("https://example.com/specs");
      expect(outcome.draft_text).toContain("Results may vary by adapter.");
      expect(outcome.draft_text).toContain("Terms apply.");
      expect(outcome.cited_claim_ids).toEqual(["claim-battery"]);
      expect(outcome.cited_proof_ids).toEqual(["proof-lab"]);
      expect(outcome.evidence_class).toBe("inference");
    }
  });
});
