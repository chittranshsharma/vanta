/**
 * Deterministic fallback matrix for the Specialist Council.
 *
 * Fallback means truthful degradation to explicit unknown, blocked, or deterministic
 * calculations—never guessing, fabricating metrics, or promoting unverified claims.
 *
 * Invariant: Canonical evidence taxonomy contains exactly 5 classes:
 * ('observed', 'sourced', 'inference', 'simulation', 'unknown').
 * 'blocked', 'needs_human', etc. are operational status values, not evidence classes.
 */

import type { AgentRole, EvidenceClass } from "./graph.js";

export type FallbackStatus =
  | "unknown"
  | "blocked"
  | "insufficient_evidence"
  | "interpretation_unavailable"
  | "needs_human"
  | "deterministic_fallback";

export type FallbackReason =
  | "provider_unavailable"
  | "quota_exhausted"
  | "schema_failure"
  | "source_unavailable"
  | "evidence_insufficient"
  | "timeout"
  | "permanent_failure";

export interface RoleFallbackResult<T = unknown> {
  role: AgentRole;
  status: FallbackStatus;
  reason: FallbackReason;
  evidenceClass: EvidenceClass;
  uncertaintyNote: string;
  deterministicOutput?: T;
  requiresHumanReview: boolean;
}

export interface FallbackContext {
  workspaceId: string;
  missingInputs?: readonly string[];
  sceneCount?: number;
  wordCount?: number;
  durationSeconds?: number;
  importedObservationCount?: number;
  candidateClaimTexts?: readonly string[];
}

/**
 * Resolves the deterministic fallback state for a given specialist role and failure reason.
 * Invariant: Never fabricates metrics, baseline virality, engagement, or approved claims.
 * Invariant: evidenceClass is strictly one of the 5 canonical classes.
 */
export function resolveRoleFallback(
  role: AgentRole,
  reason: FallbackReason,
  ctx?: FallbackContext
): RoleFallbackResult {
  switch (role) {
    case "discovery":
      return {
        role,
        status: "insufficient_evidence",
        reason,
        evidenceClass: "unknown",
        uncertaintyNote: "Discovery failed to resolve all required brand or source inputs.",
        deterministicOutput: {
          missingInputs: ctx?.missingInputs ?? ["unresolved_decision_inputs"],
        },
        requiresHumanReview: false,
      };

    case "creative_analyst": {
      // Deterministic WPM calculation when timing and words are supplied
      const words = ctx?.wordCount ?? 0;
      const duration = ctx?.durationSeconds ?? 0;
      const wpm = duration > 0 ? Math.round((words / duration) * 60) : null;
      return {
        role,
        status: "deterministic_fallback",
        reason,
        evidenceClass: "inference",
        uncertaintyNote: "Qualitative scene narrative interpretation unavailable; deterministic timing properties emitted.",
        deterministicOutput: {
          scenesCount: ctx?.sceneCount ?? 0,
          calculatedWpm: wpm,
          isQualitativeInterpretationAvailable: false,
        },
        requiresHumanReview: true,
      };
    }

    case "evidence_arbiter":
      return {
        role,
        status: "blocked",
        reason,
        evidenceClass: "unknown",
        uncertaintyNote: "Evidence arbiter verification failed or was unavailable. All candidate outputs fail closed.",
        deterministicOutput: {
          verdict: "rejected",
          rejectionReasons: [`arbiter_failure_${reason}`],
        },
        requiresHumanReview: false,
      };

    case "evaluator":
      return {
        role,
        status: "unknown",
        reason,
        evidenceClass: "unknown",
        uncertaintyNote: "Evaluation against dynamic rubric is unavailable.",
        deterministicOutput: {
          score: null,
          rubricPassed: false,
        },
        requiresHumanReview: false,
      };

    case "human_reviewer":
      return {
        role,
        status: "needs_human",
        reason,
        evidenceClass: "observed",
        uncertaintyNote: "Mandatory human review gate. Autonomous progression prohibited.",
        requiresHumanReview: true,
      };

    case "audience_researcher":
      return {
        role,
        status: "interpretation_unavailable",
        reason,
        evidenceClass: "inference",
        uncertaintyNote: "Audience sentiment and interpretation modeling unavailable. Only raw imported count is reported.",
        deterministicOutput: {
          observedRowCount: ctx?.importedObservationCount ?? 0,
          interpretation: null,
        },
        requiresHumanReview: true,
      };

    case "claim_auditor":
      return {
        role,
        status: "insufficient_evidence",
        reason,
        evidenceClass: "unknown",
        uncertaintyNote: "Claim grounding audit unavailable or proof missing. Claims remain unverified.",
        deterministicOutput: {
          auditedClaims: (ctx?.candidateClaimTexts ?? []).map((text) => ({
            claimText: text,
            groundingStatus: "unsupported",
            proofReference: null,
          })),
        },
        requiresHumanReview: true,
      };

    case "compliance_reviewer":
      return {
        role,
        status: "blocked",
        reason,
        evidenceClass: "unknown",
        uncertaintyNote: "Compliance review unavailable. Prohibited from assuming or certifying compliance.",
        deterministicOutput: {
          isCompliant: false,
          blockedReason: `compliance_check_unavailable_${reason}`,
        },
        requiresHumanReview: true,
      };

    case "experiment_designer":
      return {
        role,
        status: "deterministic_fallback",
        reason,
        evidenceClass: "inference",
        uncertaintyNote: "Automated hypothesis synthesis unavailable. Standard null-hypothesis template emitted.",
        deterministicOutput: {
          hypothesis: "Null hypothesis: No significant difference between control and variant on declared metrics.",
          requiredObservationsMinimum: 100,
          predictedWinner: null,
        },
        requiresHumanReview: true,
      };

    case "localization_reviewer":
      return {
        role,
        status: "blocked",
        reason,
        evidenceClass: "unknown",
        uncertaintyNote: "Localization fidelity verification unavailable. Prohibited from guessing translation correctness.",
        deterministicOutput: {
          isCertified: false,
          blockedReason: `localization_check_unavailable_${reason}`,
        },
        requiresHumanReview: true,
      };

    case "performance_analyst":
      return {
        role,
        status: "unknown",
        reason,
        evidenceClass: "unknown",
        uncertaintyNote: "Performance baseline or outcome aggregation unavailable. Zero predictions or synthetic metrics emitted.",
        deterministicOutput: {
          baselineStatus: "unknown",
          aggregates: null,
        },
        requiresHumanReview: true,
      };
  }
}
