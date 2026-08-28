/**
 * Specialist Council Execution Coordinator (Pure / Domain Layer).
 *
 * Enforces pre-call budget checks, DAG validation, cross-tenant boundary verification,
 * separation of evidence classification from human governance, and sanitized audit metadata.
 */

import {
  type AgentRole,
  type EvidenceOriginClass,
  type TaskGraph,
  ROLE_CONTRACTS,
  planMinimalSubgraph,
  validateGraph,
} from "./graph";
import type { FallbackReason, RoleFallbackResult } from "./fallback";

export type CouncilTaskType =
  | "creative_audit"
  | "compliance_check"
  | "performance_review"
  | "audience_brief"
  | "experiment_plan"
  | "full_council";

export type ReviewDecision = "unreviewed" | "accepted" | "rejected" | "corrected" | "needs_human";

export interface Finding<T = unknown> {
  id: string;
  role: AgentRole;
  /** Epistemic origin of the finding. Human approval never converts inference to observed. */
  evidence_class: EvidenceOriginClass;
  /** Administrative review governance state. */
  review_decision: ReviewDecision;
  /** Mandatory uncertainty disclosure for inference. */
  uncertainty_note: string;
  /** Entity IDs explicitly cited by this finding within the same workspace. */
  cited_entity_ids: readonly string[];
  /** Structured output payload. */
  payload: T;
  /** AI model provenance if model-derived. */
  model_provenance?: {
    provider: string;
    model: string;
    timestamp: string;
  };
}

export interface SanitizedAuditEvent {
  event_id: string;
  workspace_id: string;
  actor_user_id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface CouncilExecutionContext {
  workspaceId: string;
  actorUserId: string;
  taskType: CouncilTaskType;
  /** Budget ceilings */
  budget?: {
    maxNodes?: number;
    maxModelCalls?: number;
  };
  /** Pre-flight quota status from workspace_quotas */
  quotaAvailable: boolean;
}

export interface CouncilPreflightResult {
  allowed: boolean;
  reasons: string[];
  graph: TaskGraph;
  plannedRoles: readonly AgentRole[];
  modelCallsRequired: number;
}

/**
 * Validates pre-flight conditions before any specialist role executes.
 * Fails closed if budget, quota, or graph constraints are violated.
 */
export function validateCouncilPreflight(ctx: CouncilExecutionContext): CouncilPreflightResult {
  const reasons: string[] = [];

  if (!ctx.workspaceId || ctx.workspaceId.trim().length === 0) {
    reasons.push("Missing workspace identifier.");
  }
  if (!ctx.actorUserId || ctx.actorUserId.trim().length === 0) {
    reasons.push("Missing actor user identifier.");
  }

  // Determine requested roles based on task type
  const requestedRoles = getRolesForTaskType(ctx.taskType);
  const graph = planMinimalSubgraph(ctx.taskType, requestedRoles);

  // Validate graph topology and budget
  const gVal = validateGraph(graph, ctx.budget);
  if (!gVal.valid) {
    reasons.push(...gVal.errors);
  }

  // Calculate model calls
  let modelCallsRequired = 0;
  for (const n of graph.nodes) {
    const contract = ROLE_CONTRACTS[n.role];
    if (contract && contract.quotaKind === "model_call") {
      modelCallsRequired += contract.maxCallsPerRun;
    }
  }

  if (modelCallsRequired > 0 && !ctx.quotaAvailable) {
    reasons.push("Workspace model quota exhausted or reset pending. Execution halted before model call.");
  }

  return {
    allowed: reasons.length === 0,
    reasons,
    graph,
    plannedRoles: graph.nodes.map((n) => n.role),
    modelCallsRequired,
  };
}

/**
 * Maps high-level task intent to the minimum requested specialist roles.
 */
export function getRolesForTaskType(taskType: CouncilTaskType): readonly AgentRole[] {
  switch (taskType) {
    case "creative_audit":
      return ["creative_analyst", "claim_auditor"];
    case "compliance_check":
      return ["compliance_reviewer", "claim_auditor"];
    case "performance_review":
      return ["performance_analyst", "audience_researcher"];
    case "audience_brief":
      return ["audience_researcher"];
    case "experiment_plan":
      return ["experiment_designer", "claim_auditor"];
    case "full_council":
      return [
        "creative_analyst",
        "audience_researcher",
        "claim_auditor",
        "compliance_reviewer",
        "localization_reviewer",
        "experiment_designer",
        "performance_analyst",
      ];
  }
}

/**
 * Validates that an entity referenced by a role strictly belongs to the caller's workspace.
 * Fails closed across tenant boundaries.
 */
export function validateEntityBelongsToWorkspace(
  entityWorkspaceId: string,
  callerWorkspaceId: string
): boolean {
  if (!entityWorkspaceId || !callerWorkspaceId) return false;
  return entityWorkspaceId === callerWorkspaceId;
}

export interface CouncilRunReport {
  runId: string;
  taskType: CouncilTaskType;
  workspaceId: string;
  plannedRoles: readonly AgentRole[];
  executedRoles: readonly AgentRole[];
  skippedRoles: readonly AgentRole[];
  fallbackRoles: readonly { role: AgentRole; reason: FallbackReason; status: string }[];
  findings: readonly Finding[];
  sanitizedAuditEvents: readonly SanitizedAuditEvent[];
}

/**
 * Applies a human review decision to a finding.
 *
 * CRITICAL INVARIANT:
 * Human acceptance is governance state (`review_decision = 'accepted'`).
 * It does NOT promote an AI-derived `evidence_class = 'inference'` to `'observed'`.
 */
export function applyHumanReview<T>(
  finding: Finding<T>,
  decision: "accepted" | "rejected" | "corrected",
  reviewerUserId: string,
  workspaceId: string,
  reason?: string
): { updatedFinding: Finding<T>; auditEvent: SanitizedAuditEvent } {
  const updatedFinding: Finding<T> = {
    ...finding,
    review_decision: decision,
    // Preserve the original epistemic evidence_class!
    evidence_class: finding.evidence_class,
  };

  const auditEvent: SanitizedAuditEvent = {
    event_id: `rev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    workspace_id: workspaceId,
    actor_user_id: reviewerUserId,
    action: "council.finding_reviewed",
    resource_type: "council_finding",
    resource_id: finding.id,
    metadata: {
      role: finding.role,
      decision,
      prior_decision: finding.review_decision,
      original_evidence_class: finding.evidence_class,
      has_reason: Boolean(reason),
    },
    timestamp: new Date().toISOString(),
  };

  return { updatedFinding, auditEvent };
}

/**
 * Pure helper to convert a fallback result into a standard Finding.
 */
export function createFindingFromFallback(
  fallback: RoleFallbackResult,
  id: string
): Finding {
  return {
    id,
    role: fallback.role,
    evidence_class: fallback.evidenceClass,
    review_decision: fallback.requiresHumanReview ? "needs_human" : "unreviewed",
    uncertainty_note: fallback.uncertaintyNote,
    cited_entity_ids: [],
    payload: fallback.deterministicOutput ?? null,
  };
}
