/**
 * Agent workflow foundation (pure). A run is a directed acyclic graph of
 * role-typed tasks. Every node that can produce user-facing output must
 * pass through the Evidence Arbiter, and every node that changes stored
 * truth needs a human checkpoint. Nothing here executes directly: until a
 * secure runtime exists, the run state is `unavailable` and the UI must say so.
 *
 * Council represents 11 typed specialist analysis roles under an evidence arbiter
 * and human reviewer boundary—never unconstrained autonomous agents.
 */

export type AgentRole =
  | "discovery"
  | "creative_analyst"
  | "evidence_arbiter"
  | "evaluator"
  | "human_reviewer"
  | "audience_researcher"
  | "claim_auditor"
  | "compliance_reviewer"
  | "experiment_designer"
  | "localization_reviewer"
  | "performance_analyst";

export const AGENT_ROLES: readonly AgentRole[] = [
  "discovery",
  "creative_analyst",
  "evidence_arbiter",
  "evaluator",
  "human_reviewer",
  "audience_researcher",
  "claim_auditor",
  "compliance_reviewer",
  "experiment_designer",
  "localization_reviewer",
  "performance_analyst",
] as const;

export type EvidenceOriginClass = "inference" | "sourced" | "observed" | "unknown" | "blocked";

export interface RoleContract {
  role: AgentRole;
  version: string;
  purpose: string;
  /** Inputs the role may read (legacy entities). */
  reads: readonly string[];
  /** Concrete capability identifiers for inputs (least privilege). */
  allowedInputCapabilities: readonly string[];
  /** Concrete capability identifiers for tools (least privilege). */
  allowedToolCapabilities: readonly string[];
  /** Actions strictly prohibited for this role. */
  prohibitedActions: readonly string[];
  /** Output schema name validated server-side before anything is stored. */
  outputSchema: string;
  /** Evidence class every output of this role carries. */
  evidenceClass: EvidenceOriginClass;
  /** Whether the role may propose writes to stored truth (applied ONLY via human checkpoint). */
  mayProposeWrites: boolean;
  /** Quota bucket required */
  quotaKind: "model_call" | "job_enqueue" | "storage_bytes" | "none";
  /** Maximum model invocations allowed per execution */
  maxCallsPerRun: number;
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Explicit fallback role or null */
  fallbackRole: AgentRole | null;
  /** Whether findings require human review */
  requiresHumanReview: boolean;
  /** Redacted audit metadata keys */
  auditMetadataKeys: readonly string[];
}

export const ROLE_CONTRACTS: Record<AgentRole, RoleContract> = {
  discovery: {
    role: "discovery",
    version: "1.0.0",
    purpose: "Assemble the decision brief from Brand Brain and registered sources.",
    reads: ["brand_codex", "source_registry", "evidence_items"],
    allowedInputCapabilities: ["cap:read_brand_codex", "cap:read_source_registry", "cap:read_evidence_items"],
    allowedToolCapabilities: ["tool:decision_input_validator"],
    prohibitedActions: ["action:direct_db_write", "action:outbound_communication", "action:claim_approval"],
    outputSchema: "decision_brief.v1",
    evidenceClass: "inference",
    mayProposeWrites: false,
    quotaKind: "none",
    maxCallsPerRun: 1,
    timeoutMs: 15_000,
    fallbackRole: null,
    requiresHumanReview: false,
    auditMetadataKeys: ["workspace_id", "decision_type", "missing_inputs_count"],
  },
  creative_analyst: {
    role: "creative_analyst",
    version: "1.0.0",
    purpose: "Explain structural findings on a Creative Twin against the brief.",
    reads: ["creative_twin", "creative_scenes", "creative_claims", "decision_brief"],
    allowedInputCapabilities: ["cap:read_creative_twin", "cap:read_creative_scenes", "cap:read_creative_claims", "cap:read_decision_brief"],
    allowedToolCapabilities: ["tool:wpm_calculator", "tool:scene_pacing_analyzer"],
    prohibitedActions: ["action:direct_db_write", "action:outbound_communication", "action:claim_approval"],
    outputSchema: "creative_findings.v1",
    evidenceClass: "inference",
    mayProposeWrites: true,
    quotaKind: "model_call",
    maxCallsPerRun: 1,
    timeoutMs: 20_000,
    fallbackRole: null,
    requiresHumanReview: true,
    auditMetadataKeys: ["workspace_id", "twin_id", "scenes_analyzed", "proposals_count"],
  },
  evidence_arbiter: {
    role: "evidence_arbiter",
    version: "1.0.0",
    purpose: "Check every cited id exists, every number has provenance, every claim has a class. Rejects whole outputs.",
    reads: ["candidate_output", "allowed_ids", "source_freshness"],
    allowedInputCapabilities: ["cap:read_candidate_output", "cap:read_workspace_ids", "cap:read_source_provenance"],
    allowedToolCapabilities: ["tool:citation_verifier", "tool:evidence_gate"],
    prohibitedActions: ["action:direct_db_write", "action:outbound_communication", "action:synthetic_evidence_creation"],
    outputSchema: "arbiter_verdict.v1",
    evidenceClass: "inference",
    mayProposeWrites: false,
    quotaKind: "none",
    maxCallsPerRun: 1,
    timeoutMs: 10_000,
    fallbackRole: null,
    requiresHumanReview: false,
    auditMetadataKeys: ["workspace_id", "verdict", "checked_ids_count", "rejection_reasons_count"],
  },
  evaluator: {
    role: "evaluator",
    version: "1.0.0",
    purpose: "Score output against the task rubric; never against audience outcomes.",
    reads: ["arbiter_passed_output", "rubric", "observed_outcomes"],
    allowedInputCapabilities: ["cap:read_arbiter_output", "cap:read_task_rubric", "cap:read_observed_metrics"],
    allowedToolCapabilities: ["tool:deterministic_rubric_evaluator"],
    prohibitedActions: ["action:direct_db_write", "action:outbound_communication", "action:synthetic_prediction"],
    outputSchema: "evaluation.v1",
    evidenceClass: "inference",
    mayProposeWrites: false,
    quotaKind: "none",
    maxCallsPerRun: 1,
    timeoutMs: 10_000,
    fallbackRole: null,
    requiresHumanReview: false,
    auditMetadataKeys: ["workspace_id", "rubric_dimensions_count", "passed_rule_count"],
  },
  human_reviewer: {
    role: "human_reviewer",
    version: "1.0.0",
    purpose: "Approve or reject proposed writes. The only path to stored truth.",
    reads: ["evaluated_output"],
    allowedInputCapabilities: ["cap:read_evaluated_output"],
    allowedToolCapabilities: ["tool:human_review_ledger"],
    prohibitedActions: ["action:autonomous_execution", "action:bypass_audit"],
    outputSchema: "review_event.v1",
    evidenceClass: "observed",
    mayProposeWrites: false,
    quotaKind: "none",
    maxCallsPerRun: 0,
    timeoutMs: 0,
    fallbackRole: null,
    requiresHumanReview: false,
    auditMetadataKeys: ["workspace_id", "reviewer_user_id", "decision", "event_id"],
  },
  audience_researcher: {
    role: "audience_researcher",
    version: "1.0.0",
    purpose: "Summarize imported audience observations only; interpretations must be inference.",
    reads: ["conversation_observations", "import_batches"],
    allowedInputCapabilities: ["cap:read_conversation_observations", "cap:read_import_batches"],
    allowedToolCapabilities: ["tool:observation_aggregator"],
    prohibitedActions: ["action:direct_db_write", "action:outbound_communication", "action:predict_virality"],
    outputSchema: "audience_summary.v1",
    evidenceClass: "inference",
    mayProposeWrites: false,
    quotaKind: "model_call",
    maxCallsPerRun: 1,
    timeoutMs: 20_000,
    fallbackRole: null,
    requiresHumanReview: true,
    auditMetadataKeys: ["workspace_id", "batch_id", "observed_rows_count", "signals_count"],
  },
  claim_auditor: {
    role: "claim_auditor",
    version: "1.0.0",
    purpose: "Check creative statements against Brand Codex/proof points.",
    reads: ["creative_claims", "brand_claims", "brand_proof_points"],
    allowedInputCapabilities: ["cap:read_creative_claims", "cap:read_brand_claims", "cap:read_brand_proofs"],
    allowedToolCapabilities: ["tool:claim_grounding_matcher"],
    prohibitedActions: ["action:direct_db_write", "action:outbound_communication", "action:rubber_stamp_claims"],
    outputSchema: "claim_audit.v1",
    evidenceClass: "inference",
    mayProposeWrites: false,
    quotaKind: "model_call",
    maxCallsPerRun: 1,
    timeoutMs: 25_000,
    fallbackRole: null,
    requiresHumanReview: true,
    auditMetadataKeys: ["workspace_id", "claims_audited_count", "unsupported_claims_count"],
  },
  compliance_reviewer: {
    role: "compliance_reviewer",
    version: "1.0.0",
    purpose: "Detect policy/disclosure risks using explicit rules and cited sources.",
    reads: ["brand_compliance_boundaries", "candidate_copy"],
    allowedInputCapabilities: ["cap:read_compliance_boundaries", "cap:read_candidate_copy"],
    allowedToolCapabilities: ["tool:compliance_rule_checker"],
    prohibitedActions: ["action:direct_db_write", "action:outbound_communication", "action:grant_compliance_without_rule"],
    outputSchema: "compliance_verdict.v1",
    evidenceClass: "inference",
    mayProposeWrites: false,
    quotaKind: "none",
    maxCallsPerRun: 1,
    timeoutMs: 15_000,
    fallbackRole: null,
    requiresHumanReview: true,
    auditMetadataKeys: ["workspace_id", "boundaries_checked_count", "violations_count"],
  },
  experiment_designer: {
    role: "experiment_designer",
    version: "1.0.0",
    purpose: "Define measurable hypotheses and required observations without predicting results.",
    reads: ["metric_definitions", "brand_claims", "experiments"],
    allowedInputCapabilities: ["cap:read_metric_definitions", "cap:read_brand_claims", "cap:read_experiments"],
    allowedToolCapabilities: ["tool:null_hypothesis_formatter"],
    prohibitedActions: ["action:direct_db_write", "action:outbound_communication", "action:predict_winner"],
    outputSchema: "experiment_design.v1",
    evidenceClass: "inference",
    mayProposeWrites: true,
    quotaKind: "model_call",
    maxCallsPerRun: 1,
    timeoutMs: 20_000,
    fallbackRole: null,
    requiresHumanReview: true,
    auditMetadataKeys: ["workspace_id", "experiment_id", "variants_count", "metrics_specified"],
  },
  localization_reviewer: {
    role: "localization_reviewer",
    version: "1.0.0",
    purpose: "Compare localized creative/copy against approved source meaning and flag uncertainty.",
    reads: ["creative_scenes", "brand_tone_guidelines", "locales"],
    allowedInputCapabilities: ["cap:read_creative_scenes", "cap:read_tone_guidelines", "cap:read_locales"],
    allowedToolCapabilities: ["tool:tone_drift_detector"],
    prohibitedActions: ["action:direct_db_write", "action:outbound_communication", "action:unverified_translation_approval"],
    outputSchema: "localization_audit.v1",
    evidenceClass: "inference",
    mayProposeWrites: false,
    quotaKind: "model_call",
    maxCallsPerRun: 1,
    timeoutMs: 20_000,
    fallbackRole: null,
    requiresHumanReview: true,
    auditMetadataKeys: ["workspace_id", "target_locale", "drift_alerts_count"],
  },
  performance_analyst: {
    role: "performance_analyst",
    version: "1.0.0",
    purpose: "Analyze stored observed outcomes only; no fabricated baseline or causal claim.",
    reads: ["post_observations", "experiment_outcomes", "metric_definitions"],
    allowedInputCapabilities: ["cap:read_post_observations", "cap:read_experiment_outcomes", "cap:read_metric_definitions"],
    allowedToolCapabilities: ["tool:exact_metric_aggregator"],
    prohibitedActions: ["action:direct_db_write", "action:outbound_communication", "action:fabricate_virality"],
    outputSchema: "performance_summary.v1",
    evidenceClass: "inference",
    mayProposeWrites: false,
    quotaKind: "none",
    maxCallsPerRun: 1,
    timeoutMs: 15_000,
    fallbackRole: null,
    requiresHumanReview: true,
    auditMetadataKeys: ["workspace_id", "posts_analyzed", "outcomes_analyzed", "baseline_status"],
  },
};

export interface TaskNode {
  id: string;
  role: AgentRole;
  dependsOn: string[];
  /** True when the node's output is shown to the user or proposes a write. */
  userFacing: boolean;
  /** Explicit tools declared for this node. Must be authorized by RoleContract. */
  declaredTools?: readonly string[];
  /** Explicit inputs declared for this node. Must be authorized by RoleContract. */
  declaredInputs?: readonly string[];
}

export interface TaskGraph {
  name: string;
  nodes: TaskNode[];
}

export interface CouncilBudget {
  maxNodes?: number;
  maxModelCalls?: number;
}

export interface GraphValidation {
  valid: boolean;
  errors: string[];
  /** Topological order when valid. */
  order: string[];
}

export function validateGraph(graph: TaskGraph, budget?: CouncilBudget): GraphValidation {
  const errors: string[] = [];
  const ids = new Set<string>();

  // 1. Budget bounds
  if (budget?.maxNodes && graph.nodes.length > budget.maxNodes) {
    errors.push(`Graph node count ${graph.nodes.length} exceeds maximum budget of ${budget.maxNodes}.`);
  }

  let totalModelCalls = 0;
  for (const n of graph.nodes) {
    const contract = ROLE_CONTRACTS[n.role];
    if (!contract) {
      errors.push(`Node "${n.id}" specifies unknown role "${n.role}".`);
      continue;
    }
    totalModelCalls += contract.maxCallsPerRun;

    // Check declared tools capability
    if (n.declaredTools) {
      for (const tool of n.declaredTools) {
        if (!contract.allowedToolCapabilities.includes(tool)) {
          errors.push(`Node "${n.id}" (${n.role}) declared unauthorized tool "${tool}".`);
        }
      }
    }
    // Check declared inputs capability
    if (n.declaredInputs) {
      for (const input of n.declaredInputs) {
        if (!contract.allowedInputCapabilities.includes(input)) {
          errors.push(`Node "${n.id}" (${n.role}) declared unauthorized input "${input}".`);
        }
      }
    }
  }

  if (budget?.maxModelCalls && totalModelCalls > budget.maxModelCalls) {
    errors.push(`Graph model call estimate ${totalModelCalls} exceeds maximum budget of ${budget.maxModelCalls}.`);
  }

  // 2. Duplicate IDs and Unknown Dependencies
  for (const n of graph.nodes) {
    if (ids.has(n.id)) errors.push(`Duplicate node id "${n.id}".`);
    ids.add(n.id);
  }
  for (const n of graph.nodes) {
    for (const d of n.dependsOn) {
      if (!ids.has(d)) errors.push(`Node "${n.id}" depends on unknown node "${d}".`);
    }
  }

  // 3. Topological sort (Kahn); leftover nodes mean a cycle.
  const indeg = new Map<string, number>(graph.nodes.map((n) => [n.id, n.dependsOn.length]));
  const order: string[] = [];
  const queue = graph.nodes.filter((n) => n.dependsOn.length === 0).map((n) => n.id);
  while (queue.length > 0) {
    const id = queue.shift() as string;
    order.push(id);
    for (const n of graph.nodes) {
      if (n.dependsOn.includes(id)) {
        const left = (indeg.get(n.id) ?? 0) - 1;
        indeg.set(n.id, left);
        if (left === 0) queue.push(n.id);
      }
    }
  }
  if (order.length !== graph.nodes.length) errors.push("Graph contains a cycle.");

  // 4. Invariants: Arbiter & Reviewer boundaries
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const ancestorsOf = (id: string, seen = new Set<string>()): Set<string> => {
    for (const d of byId.get(id)?.dependsOn ?? []) {
      if (!seen.has(d)) {
        seen.add(d);
        ancestorsOf(d, seen);
      }
    }
    return seen;
  };

  for (const n of graph.nodes) {
    const contract = ROLE_CONTRACTS[n.role];
    if (!contract) continue;

    if (n.userFacing && n.role !== "evidence_arbiter" && n.role !== "human_reviewer") {
      const anc = [...ancestorsOf(n.id)].map((a) => byId.get(a)?.role);
      if (!anc.includes("evidence_arbiter")) {
        errors.push(`User-facing node "${n.id}" is not downstream of an evidence_arbiter.`);
      }
    }

    if (contract.mayProposeWrites || contract.requiresHumanReview) {
      const hasReviewer = graph.nodes.some((m) => m.role === "human_reviewer" && ancestorsOf(m.id).has(n.id));
      if (!hasReviewer) {
        errors.push(`Node "${n.id}" (${n.role}) requires human review, but no human_reviewer is downstream.`);
      }
    }
  }

  return { valid: errors.length === 0, errors, order: errors.length === 0 ? order : [] };
}

/** The default Creative Council graph (5 base roles). */
export const CREATIVE_COUNCIL_GRAPH: TaskGraph = {
  name: "creative_council.v1",
  nodes: [
    { id: "brief", role: "discovery", dependsOn: [], userFacing: false },
    { id: "analysis", role: "creative_analyst", dependsOn: ["brief"], userFacing: false },
    { id: "arbiter", role: "evidence_arbiter", dependsOn: ["analysis"], userFacing: false },
    { id: "evaluation", role: "evaluator", dependsOn: ["arbiter"], userFacing: true },
    { id: "review", role: "human_reviewer", dependsOn: ["evaluation"], userFacing: true },
  ],
};

/** Complete 11-role master council graph */
export const FULL_COUNCIL_GRAPH: TaskGraph = {
  name: "full_specialist_council.v1",
  nodes: [
    { id: "discovery", role: "discovery", dependsOn: [], userFacing: false },
    { id: "creative_analyst", role: "creative_analyst", dependsOn: ["discovery"], userFacing: false },
    { id: "audience_researcher", role: "audience_researcher", dependsOn: ["discovery"], userFacing: false },
    { id: "claim_auditor", role: "claim_auditor", dependsOn: ["discovery"], userFacing: false },
    { id: "compliance_reviewer", role: "compliance_reviewer", dependsOn: ["claim_auditor"], userFacing: false },
    { id: "localization_reviewer", role: "localization_reviewer", dependsOn: ["creative_analyst"], userFacing: false },
    { id: "experiment_designer", role: "experiment_designer", dependsOn: ["creative_analyst", "claim_auditor"], userFacing: false },
    { id: "performance_analyst", role: "performance_analyst", dependsOn: ["audience_researcher"], userFacing: false },
    {
      id: "evidence_arbiter",
      role: "evidence_arbiter",
      dependsOn: [
        "creative_analyst",
        "audience_researcher",
        "claim_auditor",
        "compliance_reviewer",
        "localization_reviewer",
        "experiment_designer",
        "performance_analyst",
      ],
      userFacing: false,
    },
    { id: "evaluator", role: "evaluator", dependsOn: ["evidence_arbiter"], userFacing: true },
    { id: "human_reviewer", role: "human_reviewer", dependsOn: ["evaluator"], userFacing: true },
  ],
};

/**
 * Minimal Subgraph Planner: Selects the minimal set of ancestor nodes required
 * for requested specialist roles, and automatically stitches required downstream
 * evidence_arbiter, evaluator, and human_reviewer nodes.
 */
export function planMinimalSubgraph(taskName: string, requestedRoles: readonly AgentRole[]): TaskGraph {
  const master = FULL_COUNCIL_GRAPH;
  const masterMap = new Map(master.nodes.map((n) => [n.role, n]));

  // Find all required roles including ancestors
  const activeRoles = new Set<AgentRole>(requestedRoles);
  activeRoles.add("discovery");

  // Ancestor resolution
  let changed = true;
  while (changed) {
    changed = false;
    for (const role of [...activeRoles]) {
      const node = masterMap.get(role);
      if (!node) continue;
      for (const depId of node.dependsOn) {
        const depNode = master.nodes.find((n) => n.id === depId);
        if (depNode && !activeRoles.has(depNode.role)) {
          activeRoles.add(depNode.role);
          changed = true;
        }
      }
    }
  }

  // Always append downstream governance gates
  activeRoles.add("evidence_arbiter");
  activeRoles.add("evaluator");
  activeRoles.add("human_reviewer");

  // Build minimal nodes
  const nodes: TaskNode[] = [];
  for (const n of master.nodes) {
    if (!activeRoles.has(n.role)) continue;

    // Filter dependsOn to only active nodes
    let deps = n.dependsOn.filter((d) => {
      const parent = master.nodes.find((m) => m.id === d);
      return parent && activeRoles.has(parent.role);
    });

    // For evidence_arbiter, if intermediate roles are skipped, depend on all active upstream specialist nodes
    if (n.role === "evidence_arbiter") {
      deps = nodes.filter((m) => m.role !== "evidence_arbiter" && m.role !== "evaluator" && m.role !== "human_reviewer").map((m) => m.id);
    }

    nodes.push({
      id: n.id,
      role: n.role,
      dependsOn: deps,
      userFacing: n.userFacing,
    });
  }

  return { name: taskName, nodes };
}

export type RunStatus =
  | "unavailable"
  | "pending_approval"
  | "queued"
  | "running"
  | "awaiting_review"
  | "approved"
  | "rejected"
  | "failed";

const RUN_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  unavailable: [],
  pending_approval: ["queued", "rejected"],
  queued: ["running", "cancelled" as RunStatus],
  running: ["awaiting_review", "failed"],
  awaiting_review: ["approved", "rejected"],
  approved: [],
  rejected: [],
  failed: ["pending_approval"],
};

export function canTransitionRun(from: RunStatus, to: RunStatus): boolean {
  return RUN_TRANSITIONS[from]?.includes(to) ?? false;
}

export interface RetryPolicy {
  maxAttemptsPerNode: number;
  /** When the arbiter rejects, the analyst may be re-run with the rejection reasons at most this many times. */
  maxArbiterRepairs: number;
  /** When exhausted, the run fails closed; no partial output is shown. */
  onExhausted: "fail_closed";
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = { maxAttemptsPerNode: 2, maxArbiterRepairs: 1, onExhausted: "fail_closed" };

export interface RuntimeCapabilities {
  gateway: "configured" | "missing" | "unknown";
  jobsTable: "applied" | "missing" | "unknown";
  /** Whether the server allowlist includes the agent task types. Unknown from the browser. */
  agentTasksEnabled: "yes" | "no" | "unknown";
}

export interface RuntimeGate {
  state: "available" | "unavailable";
  reasons: string[];
}

/** Agent runs are available only when every capability is positively known. Unknown is unavailable. */
export function gateRuntime(c: RuntimeCapabilities): RuntimeGate {
  const reasons: string[] = [];
  if (c.gateway !== "configured") reasons.push(c.gateway === "missing" ? "Model gateway is not deployed or has no provider key." : "Model gateway status is unknown; run the probe in Setup and status.");
  if (c.jobsTable !== "applied") reasons.push(c.jobsTable === "missing" ? "Jobs table (migration 011) is not applied." : "Jobs table status is unknown.");
  if (c.agentTasksEnabled !== "yes") reasons.push(c.agentTasksEnabled === "no" ? "Agent task types are not enabled on the server (ENABLED_TASKS)." : "No agent task type is allowlisted in this build.");
  return { state: reasons.length === 0 ? "available" : "unavailable", reasons };
}
