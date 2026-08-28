import { describe, expect, it } from "vitest";
import {
  applyHumanReview,
  createFindingFromFallback,
  getRolesForTaskType,
  validateCouncilPreflight,
  validateEntityBelongsToWorkspace,
  type CouncilExecutionContext,
  type Finding,
} from "./council";
import { resolveRoleFallback } from "./fallback";

describe("validateCouncilPreflight", () => {
  it("allows execution when workspace, actor, graph, and quota are valid", () => {
    const ctx: CouncilExecutionContext = {
      workspaceId: "d8ab3127-2afe-4add-a684-0e3d4ab00b51",
      actorUserId: "usr-1",
      taskType: "creative_audit",
      quotaAvailable: true,
    };

    const res = validateCouncilPreflight(ctx);
    expect(res.allowed).toBe(true);
    expect(res.reasons).toEqual([]);
    expect(res.plannedRoles).toEqual([
      "discovery",
      "creative_analyst",
      "claim_auditor",
      "evidence_arbiter",
      "evaluator",
      "human_reviewer",
    ]);
    expect(res.modelCallsRequired).toBeGreaterThan(0);
  });

  it("fails closed before model call when quota is exhausted", () => {
    const ctx: CouncilExecutionContext = {
      workspaceId: "d8ab3127-2afe-4add-a684-0e3d4ab00b51",
      actorUserId: "usr-1",
      taskType: "creative_audit",
      quotaAvailable: false,
    };

    const res = validateCouncilPreflight(ctx);
    expect(res.allowed).toBe(false);
    expect(res.reasons).toContain(
      "Workspace model quota exhausted or reset pending. Execution halted before model call."
    );
  });

  it("fails closed when workspace or actor ID is missing", () => {
    const ctx: CouncilExecutionContext = {
      workspaceId: "",
      actorUserId: "",
      taskType: "audience_brief",
      quotaAvailable: true,
    };

    const res = validateCouncilPreflight(ctx);
    expect(res.allowed).toBe(false);
    expect(res.reasons).toContain("Missing workspace identifier.");
    expect(res.reasons).toContain("Missing actor user identifier.");
  });

  it("fails closed when budget limits are exceeded", () => {
    const ctx: CouncilExecutionContext = {
      workspaceId: "ws-1",
      actorUserId: "usr-1",
      taskType: "full_council",
      budget: { maxNodes: 3 },
      quotaAvailable: true,
    };

    const res = validateCouncilPreflight(ctx);
    expect(res.allowed).toBe(false);
    expect(res.reasons.some((r) => r.includes("exceeds maximum budget"))).toBe(true);
  });
});

describe("getRolesForTaskType", () => {
  it("maps tasks to specific minimal roles", () => {
    expect(getRolesForTaskType("compliance_check")).toEqual(["compliance_reviewer", "claim_auditor"]);
    expect(getRolesForTaskType("performance_review")).toEqual(["performance_analyst", "audience_researcher"]);
    expect(getRolesForTaskType("audience_brief")).toEqual(["audience_researcher"]);
  });
});

describe("validateEntityBelongsToWorkspace", () => {
  it("allows same workspace references and rejects cross-tenant IDs", () => {
    const wsA = "d8ab3127-2afe-4add-a684-0e3d4ab00b51";
    const wsB = "b1718084-61e0-4762-82d8-24cbefc059fc";

    expect(validateEntityBelongsToWorkspace(wsA, wsA)).toBe(true);
    expect(validateEntityBelongsToWorkspace(wsA, wsB)).toBe(false);
    expect(validateEntityBelongsToWorkspace("", wsA)).toBe(false);
    expect(validateEntityBelongsToWorkspace(wsA, "")).toBe(false);
  });
});

describe("applyHumanReview", () => {
  it("updates governance decision without promoting inference to observed truth", () => {
    const finding: Finding<{ score: number }> = {
      id: "fnd-1",
      role: "creative_analyst",
      evidence_class: "inference",
      review_decision: "unreviewed",
      uncertainty_note: "AI-derived scene pacing proposal",
      cited_entity_ids: ["twin-123"],
      payload: { score: 85 },
      model_provenance: {
        provider: "groq",
        model: "qwen/qwen3.8-27b",
        timestamp: "2026-08-28T12:00:00Z",
      },
    };

    const { updatedFinding, auditEvent } = applyHumanReview(
      finding,
      "accepted",
      "usr-reviewer",
      "ws-1",
      "Approved creative adjustments"
    );

    // Review decision is now accepted
    expect(updatedFinding.review_decision).toBe("accepted");

    // CRITICAL INVARIANT: Epistemic evidence_class remains 'inference'!
    expect(updatedFinding.evidence_class).toBe("inference");

    // Audit event is sanitized without raw prompts or customer PII
    expect(auditEvent.action).toBe("council.finding_reviewed");
    expect(auditEvent.actor_user_id).toBe("usr-reviewer");
    expect(auditEvent.metadata).toEqual({
      role: "creative_analyst",
      decision: "accepted",
      prior_decision: "unreviewed",
      original_evidence_class: "inference",
      has_reason: true,
    });
  });

  it("human approval on a simulation finding preserves evidence_class as simulation", () => {
    const simFinding: Finding<{ simulatedRetention: number }> = {
      id: "fnd-sim-1",
      role: "experiment_designer",
      evidence_class: "simulation",
      review_decision: "unreviewed",
      uncertainty_note: "Simulated audience retention under hypothetical hook modification",
      cited_entity_ids: ["twin-456"],
      payload: { simulatedRetention: 0.62 },
    };

    const { updatedFinding } = applyHumanReview(
      simFinding,
      "accepted",
      "usr-reviewer",
      "ws-1",
      "Approved simulation for experiment design"
    );

    expect(updatedFinding.review_decision).toBe("accepted");
    // Invariant: Remains 'simulation', never promoted to 'observed'
    expect(updatedFinding.evidence_class).toBe("simulation");
  });
});

describe("createFindingFromFallback", () => {
  it("creates a properly typed Finding from a fallback result", () => {
    const fallback = resolveRoleFallback("audience_researcher", "quota_exhausted", {
      workspaceId: "ws-1",
      importedObservationCount: 25,
    });

    const finding = createFindingFromFallback(fallback, "fnd-fb-1");

    expect(finding.id).toBe("fnd-fb-1");
    expect(finding.role).toBe("audience_researcher");
    expect(finding.evidence_class).toBe("inference");
    expect(finding.review_decision).toBe("needs_human");
    expect(finding.payload).toEqual({
      observedRowCount: 25,
      interpretation: null,
    });
  });
});
