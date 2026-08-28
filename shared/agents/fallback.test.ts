import { describe, expect, it } from "vitest";
import { AGENT_ROLES, type EvidenceClass } from "./graph";
import { resolveRoleFallback } from "./fallback";

const CANONICAL_5_EVIDENCE_CLASSES: ReadonlySet<EvidenceClass> = new Set([
  "observed",
  "sourced",
  "inference",
  "simulation",
  "unknown",
]);

describe("resolveRoleFallback", () => {
  it("resolves a deterministic fallback for all 11 roles with an evidenceClass strictly within the canonical 5-class taxonomy", () => {
    for (const role of AGENT_ROLES) {
      const res = resolveRoleFallback(role, "provider_unavailable", {
        workspaceId: "ws-test-123",
        sceneCount: 3,
        wordCount: 150,
        durationSeconds: 30,
        importedObservationCount: 42,
        candidateClaimTexts: ["Claim A", "Claim B"],
      });

      expect(res.role).toBe(role);
      expect(res.reason).toBe("provider_unavailable");
      expect(res.uncertaintyNote.length).toBeGreaterThan(0);

      // Invariant 1: evidenceClass is strictly one of the 5 canonical classes
      expect(CANONICAL_5_EVIDENCE_CLASSES.has(res.evidenceClass)).toBe(true);

      // Invariant 2: operational status is separated from evidenceClass
      expect(res.evidenceClass).not.toBe("blocked");
      expect(res.evidenceClass).not.toBe("needs_human");
      expect(res.evidenceClass).not.toBe("insufficient_evidence");
      expect(res.evidenceClass).not.toBe("deterministic_fallback");

      // Invariant 3: Non-human roles never produce 'observed' evidence
      if (role !== "human_reviewer") {
        expect(res.evidenceClass).not.toBe("observed");
      }
    }
  });

  it("discovery returns explicit missing inputs rather than pretending success", () => {
    const res = resolveRoleFallback("discovery", "source_unavailable", {
      workspaceId: "ws-1",
      missingInputs: ["brand_claims", "target_audiences"],
    });
    expect(res.status).toBe("insufficient_evidence");
    expect(res.evidenceClass).toBe("unknown");
    expect(res.deterministicOutput).toEqual({
      missingInputs: ["brand_claims", "target_audiences"],
    });
  });

  it("creative_analyst computes exact WPM deterministically without qualitative hallucination", () => {
    const res = resolveRoleFallback("creative_analyst", "schema_failure", {
      workspaceId: "ws-1",
      sceneCount: 4,
      wordCount: 120,
      durationSeconds: 30, // (120/30)*60 = 240 WPM
    });
    expect(res.status).toBe("deterministic_fallback");
    expect(res.evidenceClass).toBe("inference");
    expect(res.deterministicOutput).toEqual({
      scenesCount: 4,
      calculatedWpm: 240,
      isQualitativeInterpretationAvailable: false,
    });
  });

  it("evidence_arbiter fails closed and blocks progression with evidenceClass 'unknown'", () => {
    const res = resolveRoleFallback("evidence_arbiter", "timeout");
    expect(res.status).toBe("blocked");
    expect(res.evidenceClass).toBe("unknown");
    expect(res.deterministicOutput).toEqual({
      verdict: "rejected",
      rejectionReasons: ["arbiter_failure_timeout"],
    });
  });

  it("compliance_reviewer blocks approval and sets evidenceClass 'unknown', never assuming compliance", () => {
    const res = resolveRoleFallback("compliance_reviewer", "provider_unavailable");
    expect(res.status).toBe("blocked");
    expect(res.evidenceClass).toBe("unknown");
    expect(res.deterministicOutput).toEqual({
      isCompliant: false,
      blockedReason: "compliance_check_unavailable_provider_unavailable",
    });
  });

  it("claim_auditor returns unsupported and unknown proof points when proof is missing", () => {
    const res = resolveRoleFallback("claim_auditor", "evidence_insufficient", {
      workspaceId: "ws-1",
      candidateClaimTexts: ["2x faster delivery"],
    });
    expect(res.status).toBe("insufficient_evidence");
    expect(res.evidenceClass).toBe("unknown");
    expect(res.deterministicOutput).toEqual({
      auditedClaims: [
        {
          claimText: "2x faster delivery",
          groundingStatus: "unsupported",
          proofReference: null,
        },
      ],
    });
  });

  it("performance_analyst returns unknown baseline and never invents synthetic virality", () => {
    const res = resolveRoleFallback("performance_analyst", "source_unavailable");
    expect(res.status).toBe("unknown");
    expect(res.evidenceClass).toBe("unknown");
    expect(res.deterministicOutput).toEqual({
      baselineStatus: "unknown",
      aggregates: null,
    });
  });

  it("audience_researcher reports exact imported row counts while marking interpretation unavailable", () => {
    const res = resolveRoleFallback("audience_researcher", "quota_exhausted", {
      workspaceId: "ws-1",
      importedObservationCount: 88,
    });
    expect(res.status).toBe("interpretation_unavailable");
    expect(res.evidenceClass).toBe("inference");
    expect(res.deterministicOutput).toEqual({
      observedRowCount: 88,
      interpretation: null,
    });
  });

  it("localization_reviewer blocks and sets evidenceClass 'unknown', never guessing translation accuracy", () => {
    const res = resolveRoleFallback("localization_reviewer", "provider_unavailable");
    expect(res.status).toBe("blocked");
    expect(res.evidenceClass).toBe("unknown");
    expect(res.deterministicOutput).toEqual({
      isCertified: false,
      blockedReason: "localization_check_unavailable_provider_unavailable",
    });
  });
});
