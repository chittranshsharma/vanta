/**
 * Source-backed reply draft contract (pure).
 * Draft only. The system does not send messages.
 *
 * Invariants:
 *  - Every factual statement in a draft reply must cite an approved Brand Codex claim.
 *  - Proof points cited must have review_status = 'approved'.
 *  - If claims are unapproved, expired, or missing, drafting is BLOCKED (fail-closed).
 *  - Drafts carry evidence_class = 'inference'.
 */

export interface ApprovedBrandClaim {
  id: string;
  claim_text: string;
  review_status: "approved";
  expires_at?: string | null;
}

export interface ApprovedProofPoint {
  id: string;
  claim_id: string;
  proof_text: string;
  review_status: "approved";
}

export interface DestinationCta {
  identifier: string;
  label: string;
  url: string;
  required_disclosure?: string | null;
}

export interface ReplyDraftRequest {
  observation_id: string;
  observation_text: string;
  approved_claims: ApprovedBrandClaim[];
  approved_proof_points: ApprovedProofPoint[];
  destination_cta?: DestinationCta | null;
  fixed_disclaimer?: string | null;
}

export type ReplyDraftOutcome =
  | {
      status: "ready";
      draft_text: string;
      cited_claim_ids: string[];
      cited_proof_ids: string[];
      cta_url?: string | null;
      evidence_class: "inference";
      uncertainty_note: string;
    }
  | {
      status: "blocked";
      reason: string;
      missing_evidence: string[];
      evidence_class: "unknown";
    };

/**
 * Builds a source-grounded reply draft candidate from approved workspace claims.
 * Fails closed if no approved claims exist or if claims are expired.
 */
export function buildSourceGroundedReplyDraft(request: ReplyDraftRequest): ReplyDraftOutcome {
  if (!request.approved_claims || request.approved_claims.length === 0) {
    return {
      status: "blocked",
      reason: "No approved Brand Codex claims available to ground this reply.",
      missing_evidence: ["approved_claims"],
      evidence_class: "unknown",
    };
  }

  const now = new Date();
  const validClaims = request.approved_claims.filter((c) => {
    if (c.review_status !== "approved") return false;
    if (c.expires_at) {
      const exp = new Date(c.expires_at);
      if (!Number.isNaN(exp.getTime()) && exp < now) return false;
    }
    return true;
  });

  if (validClaims.length === 0) {
    return {
      status: "blocked",
      reason: "All available brand claims are expired or unapproved.",
      missing_evidence: ["valid_approved_claims"],
      evidence_class: "unknown",
    };
  }

  const primaryClaim = validClaims[0];
  const supportingProof = (request.approved_proof_points || []).filter(
    (p) => p.claim_id === primaryClaim.id && p.review_status === "approved"
  );

  let draftText = primaryClaim.claim_text;
  const citedProofIds: string[] = [];

  if (supportingProof.length > 0) {
    draftText += ` (${supportingProof[0].proof_text})`;
    citedProofIds.push(supportingProof[0].id);
  }

  if (request.destination_cta) {
    draftText += ` Learn more: ${request.destination_cta.url}`;
    if (request.destination_cta.required_disclosure) {
      draftText += ` ${request.destination_cta.required_disclosure}`;
    }
  }

  if (request.fixed_disclaimer) {
    draftText += ` ${request.fixed_disclaimer}`;
  }

  return {
    status: "ready",
    draft_text: draftText,
    cited_claim_ids: [primaryClaim.id],
    cited_proof_ids: citedProofIds,
    cta_url: request.destination_cta?.url ?? null,
    evidence_class: "inference",
    uncertainty_note: "Draft proposal only; requires explicit human review and dispatch by workspace operator.",
  };
}
