import { describe, expect, it } from "vitest";
import { applyCounterfactualMutations, type ApprovedBrandClaimContext } from "./mutations";
import type { CreativeTwinVersionSnapshot } from "./types";

const mockBaseline: CreativeTwinVersionSnapshot = {
  twinId: "twin-test-1",
  twinVersion: 1,
  workspaceId: "ws-test-123",
  totalDurationSeconds: 30.0,
  averageWpm: 160,
  scenes: [
    {
      sceneIndex: 0,
      text: "Stop scrolling and listen to how you can accelerate your cloud workflows today.",
      onScreenText: "Accelerate Workflows",
      durationSeconds: 5.0,
      wpm: 156,
      claims: [{ claimText: "Accelerate workflows" }],
    },
    {
      sceneIndex: 1,
      text: "Our high performance engine cuts your database latency by up to 50 percent.",
      onScreenText: "50% Faster",
      durationSeconds: 15.0,
      wpm: 56,
      claims: [{ claimText: "50 percent latency reduction", brandClaimId: "claim-orig-1" }],
    },
    {
      sceneIndex: 2,
      text: "Click the link below to get your free developer trial now.",
      onScreenText: "Start Free Trial",
      durationSeconds: 10.0,
      wpm: 66,
      claims: [],
    },
  ],
};

const mockApprovedClaims: ApprovedBrandClaimContext[] = [
  {
    id: "claim-approved-1",
    workspaceId: "ws-test-123",
    claimText: "Sub-millisecond query execution on edge nodes",
    claimType: "approved",
    reviewStatus: "approved",
    proofPointId: "proof-1",
  },
];

describe("applyCounterfactualMutations", () => {
  it("applies a hook replacement mutation and computes new WPM without mutating baseline", () => {
    const res = applyCounterfactualMutations(
      mockBaseline,
      [
        {
          type: "hook_replacement",
          targetSceneIndex: 0,
          newHookText: "Discover fast cloud workflows.",
          rationale: "Shorten hook to reduce cognitive load",
        },
      ],
      mockApprovedClaims
    );

    expect(res.success).toBe(true);
    expect(res.simulatedVariant).toBeDefined();

    // Verify mutated scene
    const mutatedScene0 = res.simulatedVariant!.simulatedScenes[0];
    expect(mutatedScene0.text).toBe("Discover fast cloud workflows.");
    expect(mutatedScene0.wpm).toBe(48); // 4 words in 5 sec = 48 WPM

    // Invariant: baseline input remains completely untouched
    expect(mockBaseline.scenes[0].text).toBe(
      "Stop scrolling and listen to how you can accelerate your cloud workflows today."
    );
    expect(mockBaseline.scenes[0].wpm).toBe(156);

    // Verify structural delta
    expect(res.simulatedVariant!.structuralDelta.hasHookChanged).toBe(true);
    expect(res.simulatedVariant!.structuralDelta.hasCtaChanged).toBe(false);
  });

  it("applies a CTA replacement mutation", () => {
    const res = applyCounterfactualMutations(
      mockBaseline,
      [
        {
          type: "cta_replacement",
          targetSceneIndex: 2,
          newCtaText: "Claim your 14-day pass today.",
          rationale: "Clear urgency in call to action",
        },
      ],
      mockApprovedClaims
    );

    expect(res.success).toBe(true);
    expect(res.simulatedVariant!.simulatedScenes[2].text).toBe("Claim your 14-day pass today.");
    expect(res.simulatedVariant!.structuralDelta.hasCtaChanged).toBe(true);
  });

  it("applies scene duration adjustment and recalculates total duration and WPM", () => {
    const res = applyCounterfactualMutations(
      mockBaseline,
      [
        {
          type: "scene_duration_adjust",
          targetSceneIndex: 0,
          newDurationSeconds: 10.0, // increased from 5.0 to 10.0
          rationale: "Give viewer more time to read hook",
        },
      ],
      mockApprovedClaims
    );

    expect(res.success).toBe(true);
    const delta = res.simulatedVariant!.structuralDelta;
    expect(delta.baselineDurationSeconds).toBe(30.0);
    expect(delta.simulatedDurationSeconds).toBe(35.0);
    expect(delta.durationDeltaSeconds).toBe(5.0);
  });

  it("applies scene reorder permutation accurately", () => {
    const res = applyCounterfactualMutations(
      mockBaseline,
      [
        {
          type: "scene_reorder",
          newOrder: [2, 0, 1],
          rationale: "Test leading with CTA scene",
        },
      ],
      mockApprovedClaims
    );

    expect(res.success).toBe(true);
    const scenes = res.simulatedVariant!.simulatedScenes;
    expect(scenes[0].sceneIndex).toBe(0);
    expect(scenes[0].text).toContain("Click the link below");
    expect(scenes[1].sceneIndex).toBe(1);
    expect(scenes[1].text).toContain("Stop scrolling");
    expect(scenes[2].sceneIndex).toBe(2);
    expect(scenes[2].text).toContain("Our high performance engine");
  });

  it("applies on-screen text change", () => {
    const res = applyCounterfactualMutations(
      mockBaseline,
      [
        {
          type: "on_screen_text_change",
          targetSceneIndex: 1,
          newOnScreenText: "Lightning Fast Engine",
          rationale: "Make on-screen visual punchier",
        },
      ],
      mockApprovedClaims
    );

    expect(res.success).toBe(true);
    expect(res.simulatedVariant!.simulatedScenes[1].onScreenText).toBe("Lightning Fast Engine");
  });

  it("applies approved claim substitution and updates scene claim list", () => {
    const res = applyCounterfactualMutations(
      mockBaseline,
      [
        {
          type: "claim_substitution",
          targetSceneIndex: 1,
          originalClaimText: "50 percent latency reduction",
          substituteBrandClaimId: "claim-approved-1",
          substituteBrandClaimText: "Sub-millisecond query execution on edge nodes",
          proofPointId: "proof-1",
          rationale: "Substitute with stronger approved latency proof point",
        },
      ],
      mockApprovedClaims
    );

    expect(res.success).toBe(true);
    const scene1Claims = res.simulatedVariant!.simulatedScenes[1].claims;
    expect(scene1Claims.some((c) => c.claimText === "Sub-millisecond query execution on edge nodes")).toBe(true);
    expect(scene1Claims.some((c) => c.claimText === "50 percent latency reduction")).toBe(false);
  });

  it("rejects unapproved or cross-tenant claim substitutions", () => {
    const res = applyCounterfactualMutations(
      mockBaseline,
      [
        {
          type: "claim_substitution",
          targetSceneIndex: 1,
          originalClaimText: "50 percent latency reduction",
          substituteBrandClaimId: "unapproved-claim-999",
          substituteBrandClaimText: "Unverified magic speed",
          proofPointId: "proof-none",
          rationale: "Attempt unauthorized claim",
        },
      ],
      mockApprovedClaims
    );

    expect(res.success).toBe(false);
    expect(res.errors[0]).toContain('Substitute claim "unapproved-claim-999" is not an approved Brand Codex claim');
  });

  it("rejects mutations exceeding maximum count of 5", () => {
    const excessiveMutations = Array(6).fill({
      type: "hook_replacement",
      targetSceneIndex: 0,
      newHookText: "Hook",
      rationale: "Excess",
    });

    const res = applyCounterfactualMutations(mockBaseline, excessiveMutations, mockApprovedClaims);
    expect(res.success).toBe(false);
    expect(res.errors[0]).toContain("Maximum 5 mutations allowed");
  });

  it("rejects invalid scene reorder permutations", () => {
    const res = applyCounterfactualMutations(
      mockBaseline,
      [
        {
          type: "scene_reorder",
          newOrder: [0, 0, 1], // duplicate 0, missing 2
          rationale: "Invalid reorder",
        },
      ],
      mockApprovedClaims
    );

    expect(res.success).toBe(false);
    expect(res.errors[0]).toContain("Invalid scene reorder permutation");
  });
});
