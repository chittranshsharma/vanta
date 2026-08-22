export type EvidenceClass = "observed" | "sourced_claim" | "inference" | "simulation" | "unknown";

export type CitabilityResult =
  | { status: "verified"; sourceId: string }
  | { status: "citable_unverified"; sourceId: string; warning: string }
  | { status: "citable_stale"; sourceId: string; warning: string }
  | { status: "blocked"; reason: string };

export type NumericClaim = {
  metricKey: string;
  value?: number;
  unit?: string;
  definition?: string;
  sourceEvidenceId?: string;
  timeWindow?: string;
  completeness?: "complete" | "partial" | "unknown";
};

export type EvidenceState = "verified" | "partial" | "insufficient";

/**
 * Pure and synchronous guard for displaying numeric claims.
 * If citability is passed, it requires status === 'verified' to support numeric claims.
 * Unverified, stale, or blocked sources cannot support verified numeric claims.
 */
export function canDisplayNumericClaim(
  claim: NumericClaim,
  citability?: CitabilityResult
): boolean {
  const basicValid = Boolean(
    Number.isFinite(claim.value) &&
      claim.unit &&
      claim.definition &&
      claim.sourceEvidenceId &&
      claim.timeWindow &&
      claim.completeness === "complete"
  );
  if (!basicValid) return false;

  if (citability && citability.status !== "verified") {
    return false;
  }

  return true;
}

export function deriveEvidenceState(input: {
  sourceCount: number;
  hasConflict: boolean;
  isFresh: boolean;
}): EvidenceState {
  if (input.sourceCount === 0 || input.hasConflict) return "insufficient";
  if (!input.isFresh) return "partial";
  return "verified";
}
