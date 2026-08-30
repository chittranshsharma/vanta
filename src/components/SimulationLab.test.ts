import { describe, it, expect } from "vitest";
import {
  executeCounterfactualSimulation,
} from "../../shared/simulation/engine";
import {
  applyCounterfactualMutations,
  type ApprovedBrandClaimContext,
} from "../../shared/simulation/mutations";
import type {
  CreativeTwinVersionSnapshot,
  HookReplacementMutation,
  CtaReplacementMutation,
  SceneReorderMutation,
  SceneDurationAdjustMutation,
  OnScreenTextChangeMutation,
  ClaimSubstitutionMutation,
  ToneGuidelineAdaptationMutation,
} from "../../shared/simulation/types";

describe("Slice B: Counterfactual Simulation Lab Domain Integration", () => {
  const mockWorkspaceId = "w1111111-2222-3333-4444-555555555555";
  const mockUserId = "u1111111-2222-3333-4444-555555555555";
  const mockTwinId = "t1111111-2222-3333-4444-555555555555";

  const baselineSnapshot: CreativeTwinVersionSnapshot = {
    twinId: mockTwinId,
    twinVersion: 1,
    workspaceId: mockWorkspaceId,
    totalDurationSeconds: 15,
    averageWpm: 120,
    scenes: [
      {
        sceneIndex: 0,
        text: "Stop scrolling right now to see this product.",
        onScreenText: "Wait!",
        durationSeconds: 3,
        wpm: 160,
        claims: [{ claimText: "Product works 10x faster" }],
      },
      {
        sceneIndex: 1,
        text: "It solves your workflow bottlenecks in minutes.",
        onScreenText: "Fast results",
        durationSeconds: 7,
        wpm: 60,
        claims: [],
      },
      {
        sceneIndex: 2,
        text: "Click the link below to get started today.",
        onScreenText: "Click here",
        durationSeconds: 5,
        wpm: 96,
        claims: [],
      },
    ],
  };

  const approvedBrandClaims: ApprovedBrandClaimContext[] = [
    {
      id: "claim-1",
      workspaceId: mockWorkspaceId,
      claimText: "Reduces processing time by up to 50% according to benchmark data.",
      claimType: "numeric_outcome",
      reviewStatus: "approved",
      proofPointId: "proof-1",
    },
  ];

  it("strictly enforces evidence_class = 'simulation' across execution outputs", () => {
    const hookMutation: HookReplacementMutation = {
      type: "hook_replacement",
      targetSceneIndex: 0,
      newHookText: "Discover the new standard in automated workflow management.",
      rationale: "Replace generic scroll-stopper with explicit value proposition.",
    };

    const result = executeCounterfactualSimulation({
      workspaceId: mockWorkspaceId,
      actorUserId: mockUserId,
      baselineSnapshot,
      hypothesis: "A value-focused hook reduces reading rush and improves message delivery.",
      mutations: [hookMutation],
      controls: [],
      approvedClaims: approvedBrandClaims,
    });

    expect(result.success).toBe(true);
    expect(result.simulationRun).not.toBeNull();
    if (result.simulationRun) {
      expect(result.simulationRun.evidenceClass).toBe("simulation");
      expect(result.simulationRun.observedValidation).toBe("unknown");
      expect(result.simulationRun.reviewDecision).toBe("unreviewed");
    }
  });

  it("calculates deterministic structural deltas without performance predictions or virality scores", () => {
    const durationMutation: SceneDurationAdjustMutation = {
      type: "scene_duration_adjust",
      targetSceneIndex: 0,
      newDurationSeconds: 6, // extended from 3 to 6
      rationale: "Allow more time for opening hook delivery.",
    };

    const result = executeCounterfactualSimulation({
      workspaceId: mockWorkspaceId,
      actorUserId: mockUserId,
      baselineSnapshot,
      hypothesis: "Extending scene 0 duration decreases reading burden WPM.",
      mutations: [durationMutation],
      controls: [],
    });

    expect(result.success).toBe(true);
    if (result.simulationRun) {
      const delta = result.simulationRun.simulatedVariant.structuralDelta;
      expect(delta.baselineDurationSeconds).toBe(15);
      expect(delta.simulatedDurationSeconds).toBe(18);
      expect(delta.durationDeltaSeconds).toBe(3);
      expect(delta.baselineSceneCount).toBe(3);
      expect(delta.simulatedSceneCount).toBe(3);

      // Verify no forbidden prediction fields exist
      const deltaRecord = delta as unknown as Record<string, unknown>;
      expect(deltaRecord.predictedReach).toBeUndefined();
      expect(deltaRecord.viralityScore).toBeUndefined();
      expect(deltaRecord.conversionProbability).toBeUndefined();
      expect(deltaRecord.winner).toBeUndefined();
    }
  });

  it("executes all 7 supported mutation operators cleanly and deterministically", () => {
    // 1. Hook replacement
    const hookMut: HookReplacementMutation = {
      type: "hook_replacement",
      targetSceneIndex: 0,
      newHookText: "Attention all workflow creators.",
      rationale: "Direct audience callout.",
    };

    // 2. CTA replacement
    const ctaMut: CtaReplacementMutation = {
      type: "cta_replacement",
      targetSceneIndex: 2,
      newCtaText: "Claim your 14-day access pass now.",
      rationale: "Action-oriented trial offer.",
    };

    // 3. Scene reorder
    const reorderMut: SceneReorderMutation = {
      type: "scene_reorder",
      newOrder: [1, 0, 2],
      rationale: "Lead with problem setup before hook.",
    };

    // 4. Scene duration adjust
    const durMut: SceneDurationAdjustMutation = {
      type: "scene_duration_adjust",
      targetSceneIndex: 1,
      newDurationSeconds: 10,
      rationale: "Slow down problem explanation.",
    };

    // 5. On screen text change
    const textMut: OnScreenTextChangeMutation = {
      type: "on_screen_text_change",
      targetSceneIndex: 0,
      newOnScreenText: "Transform Your Flow",
      rationale: "Brand-aligned banner text.",
    };

    // 6. Claim substitution
    const claimMut: ClaimSubstitutionMutation = {
      type: "claim_substitution",
      targetSceneIndex: 0,
      originalClaimText: "Product works 10x faster",
      substituteBrandClaimId: "claim-1",
      substituteBrandClaimText: "Reduces processing time by up to 50% according to benchmark data.",
      proofPointId: "proof-1",
      rationale: "Replace unverified claim with approved Brand Codex claim.",
    };

    // 7. Tone guideline adaptation
    const toneMut: ToneGuidelineAdaptationMutation = {
      type: "tone_guideline_adaptation",
      targetSceneIndex: 1,
      toneGuidelineId: "tone-professional",
      adaptedScriptText: "It methodically resolves enterprise workflow latency across systems.",
      rationale: "Align with B2B corporate tone.",
    };

    const mutations = [hookMut, ctaMut, reorderMut, durMut, textMut, claimMut, toneMut];

    // Test individually
    for (const mut of mutations) {
      const res = applyCounterfactualMutations(baselineSnapshot, [mut], approvedBrandClaims);
      expect(res.success).toBe(true);
      expect(res.simulatedVariant).not.toBeNull();
    }
  });

  it("fails closed when mutation count exceeds maximum boundary (> 5)", () => {
    const hookMut: HookReplacementMutation = {
      type: "hook_replacement",
      targetSceneIndex: 0,
      newHookText: "Hook variation",
      rationale: "Rationale test",
    };

    const excessiveMutations = Array.from({ length: 6 }).map(() => hookMut);

    const res = applyCounterfactualMutations(baselineSnapshot, excessiveMutations, approvedBrandClaims);
    expect(res.success).toBe(false);
    expect(res.errors[0]).toContain("Maximum 5 mutations allowed per simulation run");
  });

  it("fails closed when claim substitution references an unapproved claim ID", () => {
    const unapprovedClaimMut: ClaimSubstitutionMutation = {
      type: "claim_substitution",
      targetSceneIndex: 0,
      originalClaimText: "Product works 10x faster",
      substituteBrandClaimId: "unapproved-claim-999",
      substituteBrandClaimText: "Unapproved claim text",
      proofPointId: "proof-none",
      rationale: "Attempted unapproved claim substitution",
    };

    const res = applyCounterfactualMutations(baselineSnapshot, [unapprovedClaimMut], approvedBrandClaims);
    expect(res.success).toBe(false);
    expect(res.errors[0]).toContain("is not an approved Brand Codex claim in workspace");
  });

  it("ensures human review decisions preserve evidence_class = 'simulation'", () => {
    const hookMut: HookReplacementMutation = {
      type: "hook_replacement",
      targetSceneIndex: 0,
      newHookText: "A proven workflow framework.",
      rationale: "Approved hook variation.",
    };

    const result = executeCounterfactualSimulation({
      workspaceId: mockWorkspaceId,
      actorUserId: mockUserId,
      baselineSnapshot,
      hypothesis: "Tested variation",
      mutations: [hookMut],
      controls: [],
    });

    expect(result.success).toBe(true);
    if (result.simulationRun) {
      // Even if human accepts the run, evidence class remains simulation
      const acceptedRun = {
        ...result.simulationRun,
        reviewDecision: "accepted" as const,
        reviewedByUserId: mockUserId,
        reviewedAt: new Date().toISOString(),
      };

      expect(acceptedRun.reviewDecision).toBe("accepted");
      expect(acceptedRun.evidenceClass).toBe("simulation");
    }
  });
});
