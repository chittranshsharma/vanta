/**
 * Pure Mutation Engine for Counterfactual Simulation Lab.
 *
 * Applies typed, bounded mutations to an immutable Creative Twin version snapshot.
 * Invariant: Never mutates baseline input objects.
 * Invariant: Produces deterministic structural deltas only (no performance predictions).
 */

import type {
  CounterfactualMutation,
  CreativeTwinVersionSnapshot,
  SceneSnapshot,
  SimulatedVariant,
  StructuralDelta,
} from "./types.js";

export interface ApprovedBrandClaimContext {
  id: string;
  workspaceId: string;
  claimText: string;
  claimType: string;
  reviewStatus: string;
  proofPointId: string;
}

export interface MutationApplicationResult {
  success: boolean;
  errors: readonly string[];
  simulatedVariant: SimulatedVariant | null;
}

/** Word count helper for deterministic WPM calculation */
function countWords(text: string): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

/** Calculate scene WPM */
function calculateSceneWpm(text: string, durationSeconds: number): number | null {
  if (durationSeconds <= 0) return null;
  const words = countWords(text);
  return Math.round((words / durationSeconds) * 60);
}

/** Calculate overall average WPM across scenes */
function calculateAverageWpm(scenes: readonly SceneSnapshot[]): number | null {
  const totalWords = scenes.reduce((sum, s) => sum + countWords(s.text), 0);
  const totalDuration = scenes.reduce((sum, s) => sum + s.durationSeconds, 0);
  if (totalDuration <= 0) return null;
  return Math.round((totalWords / totalDuration) * 60);
}

/**
 * Applies bounded counterfactual mutations to a Creative Twin version snapshot.
 */
export function applyCounterfactualMutations(
  baseline: CreativeTwinVersionSnapshot,
  mutations: readonly CounterfactualMutation[],
  approvedClaims: readonly ApprovedBrandClaimContext[] = []
): MutationApplicationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validation 1: Mutation count bounds
  if (!mutations || mutations.length === 0) {
    return {
      success: false,
      errors: ["At least one counterfactual mutation must be declared."],
      simulatedVariant: null,
    };
  }

  if (mutations.length > 5) {
    return {
      success: false,
      errors: [`Maximum 5 mutations allowed per simulation run. Declared: ${mutations.length}.`],
      simulatedVariant: null,
    };
  }

  // Deep clone scenes to guarantee baseline immutability
  const clonedScenes: SceneSnapshot[] = baseline.scenes.map((s: SceneSnapshot) => ({
    sceneIndex: s.sceneIndex,
    text: s.text,
    onScreenText: s.onScreenText ?? null,
    durationSeconds: s.durationSeconds,
    wpm: s.wpm,
    claims: s.claims.map((c: { claimText: string; brandClaimId?: string }) => ({ ...c })),
  }));

  let hasHookChanged = false;
  let hasCtaChanged = false;

  for (let i = 0; i < mutations.length; i++) {
    const mut = mutations[i];
    const prefix = `Mutation #${i + 1} (${mut.type}):`;

    if (!mut.rationale || mut.rationale.trim().length === 0) {
      errors.push(`${prefix} Explicit mutation rationale is required.`);
    }

    switch (mut.type) {
      case "hook_replacement": {
        if (mut.targetSceneIndex < 0 || mut.targetSceneIndex >= clonedScenes.length) {
          errors.push(`${prefix} Target scene index ${mut.targetSceneIndex} out of bounds.`);
          break;
        }
        if (!mut.newHookText || mut.newHookText.trim().length === 0) {
          errors.push(`${prefix} Hook text cannot be empty.`);
          break;
        }
        if (mut.newHookText.length > 300) {
          errors.push(`${prefix} Hook text exceeds 300 character limit (length: ${mut.newHookText.length}).`);
          break;
        }

        const scene = clonedScenes[mut.targetSceneIndex];
        scene.text = mut.newHookText;
        scene.wpm = calculateSceneWpm(scene.text, scene.durationSeconds);
        hasHookChanged = true;
        break;
      }

      case "cta_replacement": {
        if (mut.targetSceneIndex < 0 || mut.targetSceneIndex >= clonedScenes.length) {
          errors.push(`${prefix} Target scene index ${mut.targetSceneIndex} out of bounds.`);
          break;
        }
        if (!mut.newCtaText || mut.newCtaText.trim().length === 0) {
          errors.push(`${prefix} CTA text cannot be empty.`);
          break;
        }
        if (mut.newCtaText.length > 200) {
          errors.push(`${prefix} CTA text exceeds 200 character limit (length: ${mut.newCtaText.length}).`);
          break;
        }

        const scene = clonedScenes[mut.targetSceneIndex];
        scene.text = mut.newCtaText;
        scene.wpm = calculateSceneWpm(scene.text, scene.durationSeconds);
        hasCtaChanged = true;
        break;
      }

      case "scene_reorder": {
        const order = mut.newOrder;
        if (!order || order.length !== clonedScenes.length) {
          errors.push(
            `${prefix} Reorder permutation length (${order?.length}) does not match scene count (${clonedScenes.length}).`
          );
          break;
        }
        const sortedOrder = [...order].sort((a, b) => a - b);
        const isValidPermutation = sortedOrder.every((idx, pos) => idx === pos);
        if (!isValidPermutation) {
          errors.push(`${prefix} Invalid scene reorder permutation: all scene indices from 0 to ${clonedScenes.length - 1} must appear exactly once.`);
          break;
        }

        // Reorder scenes
        const reordered = order.map((originalIdx: number, newIdx: number) => ({
          ...clonedScenes[originalIdx],
          sceneIndex: newIdx,
        }));
        clonedScenes.length = 0;
        clonedScenes.push(...reordered);
        break;
      }

      case "scene_duration_adjust": {
        if (mut.targetSceneIndex < 0 || mut.targetSceneIndex >= clonedScenes.length) {
          errors.push(`${prefix} Target scene index ${mut.targetSceneIndex} out of bounds.`);
          break;
        }
        if (typeof mut.newDurationSeconds !== "number" || mut.newDurationSeconds < 1.0) {
          errors.push(`${prefix} Scene duration must be a positive number of at least 1.0s (got ${mut.newDurationSeconds}s).`);
          break;
        }

        const scene = clonedScenes[mut.targetSceneIndex];
        scene.durationSeconds = mut.newDurationSeconds;
        scene.wpm = calculateSceneWpm(scene.text, scene.durationSeconds);
        break;
      }

      case "on_screen_text_change": {
        if (mut.targetSceneIndex < 0 || mut.targetSceneIndex >= clonedScenes.length) {
          errors.push(`${prefix} Target scene index ${mut.targetSceneIndex} out of bounds.`);
          break;
        }
        if (mut.newOnScreenText && mut.newOnScreenText.length > 150) {
          errors.push(`${prefix} On-screen text exceeds 150 character limit (length: ${mut.newOnScreenText.length}).`);
          break;
        }

        const scene = clonedScenes[mut.targetSceneIndex];
        scene.onScreenText = mut.newOnScreenText;
        break;
      }

      case "claim_substitution": {
        if (mut.targetSceneIndex < 0 || mut.targetSceneIndex >= clonedScenes.length) {
          errors.push(`${prefix} Target scene index ${mut.targetSceneIndex} out of bounds.`);
          break;
        }
        if (!mut.substituteBrandClaimId) {
          errors.push(`${prefix} Missing substituteBrandClaimId.`);
          break;
        }

        // Verify approved claim in same workspace
        const matchingApprovedClaim = approvedClaims.find(
          (c) =>
            c.id === mut.substituteBrandClaimId &&
            c.workspaceId === baseline.workspaceId &&
            c.reviewStatus === "approved"
        );

        if (!matchingApprovedClaim) {
          errors.push(
            `${prefix} Substitute claim "${mut.substituteBrandClaimId}" is not an approved Brand Codex claim in workspace "${baseline.workspaceId}".`
          );
          break;
        }

        const scene = clonedScenes[mut.targetSceneIndex];
        // Replace original claim in scene
        scene.claims = scene.claims.filter((c: { claimText: string; brandClaimId?: string }) => c.claimText !== mut.originalClaimText);
        scene.claims.push({
          claimText: mut.substituteBrandClaimText,
          brandClaimId: mut.substituteBrandClaimId,
        });
        break;
      }

      case "tone_guideline_adaptation": {
        if (mut.targetSceneIndex < 0 || mut.targetSceneIndex >= clonedScenes.length) {
          errors.push(`${prefix} Target scene index ${mut.targetSceneIndex} out of bounds.`);
          break;
        }
        if (!mut.adaptedScriptText || mut.adaptedScriptText.trim().length === 0) {
          errors.push(`${prefix} Adapted script text cannot be empty.`);
          break;
        }
        if (mut.adaptedScriptText.length > 500) {
          errors.push(`${prefix} Adapted script text exceeds 500 character limit (length: ${mut.adaptedScriptText.length}).`);
          break;
        }

        const scene = clonedScenes[mut.targetSceneIndex];
        scene.text = mut.adaptedScriptText;
        scene.wpm = calculateSceneWpm(scene.text, scene.durationSeconds);
        break;
      }
    }
  }

  // Calculate total simulated duration
  const totalSimulatedDuration = clonedScenes.reduce((sum: number, s: SceneSnapshot) => sum + s.durationSeconds, 0);
  if (totalSimulatedDuration < 5.0 || totalSimulatedDuration > 600.0) {
    errors.push(
      `Total simulated duration (${totalSimulatedDuration.toFixed(1)}s) is outside allowed creative limits [5.0s, 600.0s].`
    );
  }

  if (errors.length > 0) {
    return {
      success: false,
      errors,
      simulatedVariant: null,
    };
  }

  // Calculate structural delta
  const simulatedAverageWpm = calculateAverageWpm(clonedScenes);
  const baselineClaimCount = baseline.scenes.reduce((sum: number, s: SceneSnapshot) => sum + s.claims.length, 0);
  const simulatedClaimCount = clonedScenes.reduce((sum: number, s: SceneSnapshot) => sum + s.claims.length, 0);

  const structuralDelta: StructuralDelta = {
    baselineDurationSeconds: baseline.totalDurationSeconds,
    simulatedDurationSeconds: totalSimulatedDuration,
    durationDeltaSeconds: Number((totalSimulatedDuration - baseline.totalDurationSeconds).toFixed(2)),

    baselineAverageWpm: baseline.averageWpm,
    simulatedAverageWpm,
    wpmDelta:
      baseline.averageWpm !== null && simulatedAverageWpm !== null
        ? simulatedAverageWpm - baseline.averageWpm
        : null,

    baselineSceneCount: baseline.scenes.length,
    simulatedSceneCount: clonedScenes.length,
    sceneCountDelta: clonedScenes.length - baseline.scenes.length,

    baselineClaimCount,
    simulatedClaimCount,
    claimCountDelta: simulatedClaimCount - baselineClaimCount,

    hasCtaChanged,
    hasHookChanged,
    warnings,
  };

  const simulatedVariant: SimulatedVariant = {
    sourceTwinId: baseline.twinId,
    sourceTwinVersion: baseline.twinVersion,
    mutationsAppliedCount: mutations.length,
    simulatedScenes: clonedScenes,
    structuralDelta,
    assumptions: [
      "Mutations assume identical audio mixing, background soundtrack, and video resolution.",
      "Scene pacing calculations are derived from spoken word count per scene duration without empirical retention data.",
    ],
    limitations: [
      "Simulated variant does not represent recorded viewer behavior or platform algorithm distribution.",
      "WPM calculations are structural benchmarks, not guaranteed audience comprehension.",
    ],
  };

  return {
    success: true,
    errors: [],
    simulatedVariant,
  };
}
