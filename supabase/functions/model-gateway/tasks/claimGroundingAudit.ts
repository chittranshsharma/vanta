/**
 * Ticket 5.1 contract: Claim-Grounding Audit output validation.
 *
 * Pure, server-owned, fail-closed. This file defines the output schema the
 * model must satisfy and the validator that enforces it against the allowed
 * ID sets loaded from the caller's RLS context.
 *
 * NOT yet registered in ALLOWLISTED_TASKS. The gateway still exposes only
 * gateway_health_check. Wiring requires Ticket 5.0 deployment approval and
 * migrations 007-009 live. See docs/ticket-5.1-claim-grounding-audit.md.
 */

export const CLAIM_GROUNDING_SCHEMA_VERSION = "1.0.0";
export const RATIONALE_MAX_CHARS = 400;

export type GroundingVerdict =
  | "backed_by_proof"
  | "approved_no_proof"
  | "conditional"
  | "prohibited"
  | "unmatched";

export const GROUNDING_VERDICTS: readonly GroundingVerdict[] = [
  "backed_by_proof",
  "approved_no_proof",
  "conditional",
  "prohibited",
  "unmatched",
] as const;

export type Confidence = "low" | "medium" | "high";
const CONFIDENCES: readonly Confidence[] = ["low", "medium", "high"] as const;

/** Evidence class assigned to a verdict. Only the canonical five exist. */
export type VerdictEvidenceClass = "inference" | "unknown";

export interface ClaimVerdict {
  creative_claim_id: string;
  verdict: GroundingVerdict;
  matched_brand_claim_id: string | null;
  cited_proof_point_ids: string[];
  rationale: string;
  confidence: Confidence;
}

export interface ClaimGroundingOutput {
  verdicts: ClaimVerdict[];
}

export interface ValidatedVerdict extends ClaimVerdict {
  evidence_class: VerdictEvidenceClass;
}

export type BrandClaimType = "approved" | "conditional" | "prohibited";

/**
 * Allowed-ID context, built server-side from rows the caller is permitted to read.
 * Everything the model may reference must be present here.
 */
export interface GroundingContext {
  creativeClaimIds: readonly string[];
  /** brand_claim id -> claim_type */
  brandClaims: ReadonlyMap<string, BrandClaimType>;
  /** proof_point id -> brand_claim id it supports */
  proofPoints: ReadonlyMap<string, string>;
}

export type ClaimGroundingValidation =
  | { isValid: true; data: ValidatedVerdict[] }
  | { isValid: false; errors: string[] };

const VERDICT_KEYS = new Set([
  "creative_claim_id",
  "verdict",
  "matched_brand_claim_id",
  "cited_proof_point_ids",
  "rationale",
  "confidence",
]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

/**
 * Validates raw model JSON against the schema and the allowed-ID context.
 * Any violation rejects the whole response. Errors are specific enough for
 * a schema-repair retry but contain no prompt or provider text.
 */
export function validateClaimGroundingOutput(
  raw: unknown,
  ctx: GroundingContext
): ClaimGroundingValidation {
  const errors: string[] = [];

  if (!isRecord(raw)) {
    return { isValid: false, errors: ["Output must be a JSON object."] };
  }
  const topKeys = Object.keys(raw);
  for (const k of topKeys) {
    if (k !== "verdicts") errors.push(`Disallowed top-level key "${k}".`);
  }
  if (!Array.isArray(raw.verdicts)) {
    errors.push('"verdicts" must be an array.');
    return { isValid: false, errors };
  }

  const expected = new Set(ctx.creativeClaimIds);
  const seen = new Set<string>();
  const validated: ValidatedVerdict[] = [];

  raw.verdicts.forEach((item, index) => {
    const at = `verdicts[${index}]`;
    if (!isRecord(item)) {
      errors.push(`${at} must be an object.`);
      return;
    }
    for (const k of Object.keys(item)) {
      if (!VERDICT_KEYS.has(k)) errors.push(`${at}: disallowed key "${k}".`);
    }
    for (const k of VERDICT_KEYS) {
      if (!(k in item)) errors.push(`${at}: missing key "${k}".`);
    }

    const claimId = item.creative_claim_id;
    if (typeof claimId !== "string" || !expected.has(claimId)) {
      errors.push(`${at}: creative_claim_id is not in the input claim set.`);
    } else if (seen.has(claimId)) {
      errors.push(`${at}: duplicate creative_claim_id "${claimId}".`);
    } else {
      seen.add(claimId);
    }

    const verdict = item.verdict;
    if (typeof verdict !== "string" || !GROUNDING_VERDICTS.includes(verdict as GroundingVerdict)) {
      errors.push(`${at}: verdict must be one of ${GROUNDING_VERDICTS.join(", ")}.`);
    }

    const matched = item.matched_brand_claim_id;
    const matchedType =
      typeof matched === "string" ? ctx.brandClaims.get(matched) : undefined;
    if (matched !== null && typeof matched !== "string") {
      errors.push(`${at}: matched_brand_claim_id must be a string or null.`);
    } else if (typeof matched === "string" && matchedType === undefined) {
      errors.push(`${at}: matched_brand_claim_id is not an allowed brand claim.`);
    }

    const cited = item.cited_proof_point_ids;
    const citedIds: string[] = [];
    if (!Array.isArray(cited)) {
      errors.push(`${at}: cited_proof_point_ids must be an array.`);
    } else {
      for (const id of cited) {
        if (typeof id !== "string" || !ctx.proofPoints.has(id)) {
          errors.push(`${at}: cited proof point is not in the allowed set.`);
        } else if (typeof matched === "string" && ctx.proofPoints.get(id) !== matched) {
          errors.push(`${at}: cited proof point does not belong to the matched brand claim.`);
        } else {
          citedIds.push(id);
        }
      }
      if (new Set(citedIds).size !== citedIds.length) {
        errors.push(`${at}: duplicate proof point citation.`);
      }
    }

    // Verdict-specific requirements
    switch (verdict) {
      case "backed_by_proof":
        if (matchedType !== "approved") errors.push(`${at}: backed_by_proof requires an approved brand claim.`);
        if (citedIds.length === 0) errors.push(`${at}: backed_by_proof requires at least one cited proof point.`);
        break;
      case "approved_no_proof":
        if (matchedType !== "approved") errors.push(`${at}: approved_no_proof requires an approved brand claim.`);
        if (Array.isArray(cited) && cited.length > 0) errors.push(`${at}: approved_no_proof must not cite proof points.`);
        break;
      case "conditional":
        if (matchedType !== "conditional") errors.push(`${at}: conditional requires a conditional brand claim.`);
        break;
      case "prohibited":
        if (matchedType !== "prohibited") errors.push(`${at}: prohibited requires a prohibited brand claim.`);
        break;
      case "unmatched":
        if (matched !== null) errors.push(`${at}: unmatched requires matched_brand_claim_id = null.`);
        if (Array.isArray(cited) && cited.length > 0) errors.push(`${at}: unmatched must not cite proof points.`);
        break;
      default:
        break;
    }

    const rationale = item.rationale;
    if (typeof rationale !== "string" || rationale.trim().length === 0) {
      errors.push(`${at}: rationale must be a non-empty string.`);
    } else if (rationale.length > RATIONALE_MAX_CHARS) {
      errors.push(`${at}: rationale exceeds ${RATIONALE_MAX_CHARS} characters.`);
    }

    const confidence = item.confidence;
    if (typeof confidence !== "string" || !CONFIDENCES.includes(confidence as Confidence)) {
      errors.push(`${at}: confidence must be low, medium, or high.`);
    }

    if (
      typeof claimId === "string" &&
      typeof verdict === "string" &&
      typeof rationale === "string" &&
      typeof confidence === "string"
    ) {
      validated.push({
        creative_claim_id: claimId,
        verdict: verdict as GroundingVerdict,
        matched_brand_claim_id: typeof matched === "string" ? matched : null,
        cited_proof_point_ids: citedIds,
        rationale,
        confidence: confidence as Confidence,
        evidence_class: verdict === "unmatched" ? "unknown" : "inference",
      });
    }
  });

  for (const id of expected) {
    if (!seen.has(id)) errors.push(`Missing verdict for creative claim "${id}".`);
  }

  if (errors.length > 0) return { isValid: false, errors };
  return { isValid: true, data: validated };
}

/**
 * JSON Schema handed to the provider as response_format. Kept next to the
 * validator so the two cannot drift silently; the validator is the authority.
 */
export function claimGroundingJsonSchema(): Record<string, unknown> {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: `vanta.claim_grounding_audit.v${CLAIM_GROUNDING_SCHEMA_VERSION}`,
    type: "object",
    additionalProperties: false,
    required: ["verdicts"],
    properties: {
      verdicts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [...VERDICT_KEYS],
          properties: {
            creative_claim_id: { type: "string" },
            verdict: { type: "string", enum: [...GROUNDING_VERDICTS] },
            matched_brand_claim_id: { type: ["string", "null"] },
            cited_proof_point_ids: { type: "array", items: { type: "string" } },
            rationale: { type: "string", maxLength: RATIONALE_MAX_CHARS },
            confidence: { type: "string", enum: [...CONFIDENCES] },
          },
        },
      },
    },
  };
}
