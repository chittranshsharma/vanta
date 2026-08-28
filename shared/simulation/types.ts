/**
 * Counterfactual Simulation Lab Domain Types and Contracts.
 *
 * Enforces the canonical 5-class evidence taxonomy ('observed', 'sourced', 'inference',
 * 'simulation', 'unknown') and keeps operational status cleanly separated.
 *
 * Invariant: Simulation outputs are strictly evidence_class = 'simulation'.
 * Invariant: v1 calculates structural deltas only—never performance prediction, virality,
 * or variance/lift against observed outcomes.
 */

import type { AgentRole } from "../agents/graph";
import type { ReviewDecision } from "../agents/council";

export type SimulationStatus =
  | "draft"
  | "queued"
  | "running"
  | "completed"
  | "blocked"
  | "failed"
  | "cancelled";

export type ObservedValidationStatus = "unknown" | "linked";

/**
 * Seven bounded, explicit mutation types supported in v1.
 */
export type MutationType =
  | "hook_replacement"
  | "cta_replacement"
  | "scene_reorder"
  | "scene_duration_adjust"
  | "on_screen_text_change"
  | "claim_substitution"
  | "tone_guideline_adaptation";

export interface BaseMutation {
  type: MutationType;
  rationale: string;
}

export interface HookReplacementMutation extends BaseMutation {
  type: "hook_replacement";
  /** Scene index (usually 0). */
  targetSceneIndex: number;
  newHookText: string;
}

export interface CtaReplacementMutation extends BaseMutation {
  type: "cta_replacement";
  /** Scene index (usually the last scene). */
  targetSceneIndex: number;
  newCtaText: string;
}

export interface SceneReorderMutation extends BaseMutation {
  type: "scene_reorder";
  /** Permutation of all existing scene indices, e.g. [1, 0, 2]. */
  newOrder: number[];
}

export interface SceneDurationAdjustMutation extends BaseMutation {
  type: "scene_duration_adjust";
  targetSceneIndex: number;
  /** New duration in seconds (must be >= 1.0s). */
  newDurationSeconds: number;
}

export interface OnScreenTextChangeMutation extends BaseMutation {
  type: "on_screen_text_change";
  targetSceneIndex: number;
  newOnScreenText: string;
}

export interface ClaimSubstitutionMutation extends BaseMutation {
  type: "claim_substitution";
  targetSceneIndex: number;
  originalClaimText: string;
  /** Must reference an approved brand_claims row in the same workspace. */
  substituteBrandClaimId: string;
  substituteBrandClaimText: string;
  proofPointId: string;
}

export interface ToneGuidelineAdaptationMutation extends BaseMutation {
  type: "tone_guideline_adaptation";
  targetSceneIndex: number;
  toneGuidelineId: string;
  adaptedScriptText: string;
}

export type CounterfactualMutation =
  | HookReplacementMutation
  | CtaReplacementMutation
  | SceneReorderMutation
  | SceneDurationAdjustMutation
  | OnScreenTextChangeMutation
  | ClaimSubstitutionMutation
  | ToneGuidelineAdaptationMutation;

export interface SceneSnapshot {
  sceneIndex: number;
  text: string;
  onScreenText?: string | null;
  durationSeconds: number;
  wpm: number | null;
  claims: Array<{ claimText: string; brandClaimId?: string }>;
}

export interface CreativeTwinVersionSnapshot {
  twinId: string;
  twinVersion: number;
  workspaceId: string;
  totalDurationSeconds: number;
  averageWpm: number | null;
  scenes: readonly SceneSnapshot[];
}

/**
 * Deterministic structural delta summary.
 * Invariant: Never contains predicted performance, virality, reach, or conversion.
 */
export interface StructuralDelta {
  baselineDurationSeconds: number;
  simulatedDurationSeconds: number;
  durationDeltaSeconds: number;

  baselineAverageWpm: number | null;
  simulatedAverageWpm: number | null;
  wpmDelta: number | null;

  baselineSceneCount: number;
  simulatedSceneCount: number;
  sceneCountDelta: number;

  baselineClaimCount: number;
  simulatedClaimCount: number;
  claimCountDelta: number;

  hasCtaChanged: boolean;
  hasHookChanged: boolean;
  warnings: readonly string[];
}

export interface SimulatedVariant {
  sourceTwinId: string;
  sourceTwinVersion: number;
  mutationsAppliedCount: number;
  simulatedScenes: readonly SceneSnapshot[];
  structuralDelta: StructuralDelta;
  assumptions: readonly string[];
  limitations: readonly string[];
}

export interface SimulationCouncilExecution {
  analysisRolesRun: readonly AgentRole[];
  analysisRolesSkipped: readonly AgentRole[];
  governanceRole: "human_reviewer";
  executedAt: string;
}

export interface SimulationRun {
  simulationRunId: string;
  workspaceId: string;
  actorUserId: string;
  sourceTwinId: string;
  sourceTwinVersion: number;
  hypothesis: string;
  mutations: readonly CounterfactualMutation[];
  controls: readonly string[];
  status: SimulationStatus;
  evidenceClass: "simulation" | "unknown";
  observedValidation: ObservedValidationStatus;
  reviewDecision: ReviewDecision;
  reviewedByUserId?: string | null;
  reviewedAt?: string | null;
  uncertaintyNote: string;
  simulatedVariant: SimulatedVariant;
  councilExecution: SimulationCouncilExecution;
  createdAt: string;
  completedAt: string;
}

/**
 * Post-hoc traceability link.
 * Invariant: Connects empirical outcome to simulation for traceability ONLY.
 * Invariant: v1 does NOT calculate variance, lift, accuracy, or prediction error.
 */
export interface SimulationObservedTrace {
  traceId: string;
  simulationRunId: string;
  experimentOutcomeId: string;
  linkedByUserId: string;
  linkedAt: string;
}
