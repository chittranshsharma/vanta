/**
 * Agent workflow foundation (pure). A run is a directed acyclic graph of
 * role-typed tasks. Every node that can produce user-facing output must
 * pass through the Evidence Arbiter, and every node that changes stored
 * truth needs a human checkpoint. Nothing here executes anything: until a
 * secure runtime exists (gateway deployed, jobs table applied, tasks
 * enabled) the run state is `unavailable` and the UI must say so.
 */

export type AgentRole = "discovery" | "creative_analyst" | "evidence_arbiter" | "evaluator" | "human_reviewer";

export interface RoleContract {
  role: AgentRole;
  purpose: string;
  /** Inputs the role may read. Nothing outside this list reaches the model. */
  reads: string[];
  /** Output schema name validated server-side before anything is stored. */
  outputSchema: string;
  /** Evidence class every output of this role carries. */
  evidenceClass: "inference" | "observed" | "unknown";
  /** Whether the role may write to stored truth (never directly; only via a checkpoint). */
  mayProposeWrites: boolean;
}

export const ROLE_CONTRACTS: Record<AgentRole, RoleContract> = {
  discovery: { role: "discovery", purpose: "Assemble the decision brief from Brand Brain and registered sources.", reads: ["brand_codex", "source_registry", "evidence_items"], outputSchema: "decision_brief.v1", evidenceClass: "inference", mayProposeWrites: false },
  creative_analyst: { role: "creative_analyst", purpose: "Explain structural findings on a Creative Twin against the brief.", reads: ["creative_twin", "creative_scenes", "creative_claims", "decision_brief"], outputSchema: "creative_findings.v1", evidenceClass: "inference", mayProposeWrites: true },
  evidence_arbiter: { role: "evidence_arbiter", purpose: "Check every cited id exists, every number has provenance, every claim has a class. Rejects whole outputs.", reads: ["candidate_output", "allowed_ids", "source_freshness"], outputSchema: "arbiter_verdict.v1", evidenceClass: "inference", mayProposeWrites: false },
  evaluator: { role: "evaluator", purpose: "Score output against the task rubric; never against audience outcomes.", reads: ["arbiter_passed_output", "rubric"], outputSchema: "evaluation.v1", evidenceClass: "inference", mayProposeWrites: false },
  human_reviewer: { role: "human_reviewer", purpose: "Approve or reject proposed writes. The only path to stored truth.", reads: ["evaluated_output"], outputSchema: "approval.v1", evidenceClass: "observed", mayProposeWrites: false }
};

export interface TaskNode {
  id: string;
  role: AgentRole;
  dependsOn: string[];
  /** True when the node's output is shown to the user or proposes a write. */
  userFacing: boolean;
}

export interface TaskGraph {
  name: string;
  nodes: TaskNode[];
}

export interface GraphValidation {
  valid: boolean;
  errors: string[];
  /** Topological order when valid. */
  order: string[];
}

export function validateGraph(graph: TaskGraph): GraphValidation {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const n of graph.nodes) {
    if (ids.has(n.id)) errors.push(`Duplicate node id "${n.id}".`);
    ids.add(n.id);
  }
  for (const n of graph.nodes) {
    for (const d of n.dependsOn) if (!ids.has(d)) errors.push(`Node "${n.id}" depends on unknown node "${d}".`);
  }
  // Topological sort (Kahn); leftover nodes mean a cycle.
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
    if (n.userFacing && n.role !== "evidence_arbiter" && n.role !== "human_reviewer") {
      const anc = [...ancestorsOf(n.id)].map((a) => byId.get(a)?.role);
      if (!anc.includes("evidence_arbiter")) errors.push(`User-facing node "${n.id}" is not downstream of an evidence_arbiter.`);
    }
    if (ROLE_CONTRACTS[n.role].mayProposeWrites) {
      const hasReviewer = graph.nodes.some((m) => m.role === "human_reviewer" && ancestorsOf(m.id).has(n.id));
      if (!hasReviewer) errors.push(`Node "${n.id}" may propose writes but no human_reviewer is downstream.`);
    }
  }
  return { valid: errors.length === 0, errors, order: errors.length === 0 ? order : [] };
}

/** The default Creative Council graph. Analyst output reaches the user only after arbitration, evaluation, and human review. */
export const CREATIVE_COUNCIL_GRAPH: TaskGraph = {
  name: "creative_council.v1",
  nodes: [
    { id: "brief", role: "discovery", dependsOn: [], userFacing: false },
    { id: "analysis", role: "creative_analyst", dependsOn: ["brief"], userFacing: false },
    { id: "arbiter", role: "evidence_arbiter", dependsOn: ["analysis"], userFacing: false },
    { id: "evaluation", role: "evaluator", dependsOn: ["arbiter"], userFacing: true },
    { id: "review", role: "human_reviewer", dependsOn: ["evaluation"], userFacing: true }
  ]
};

export type RunStatus = "unavailable" | "pending_approval" | "queued" | "running" | "awaiting_review" | "approved" | "rejected" | "failed";

const RUN_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  unavailable: [],
  pending_approval: ["queued", "rejected"],
  queued: ["running", "rejected"],
  running: ["awaiting_review", "failed"],
  awaiting_review: ["approved", "rejected"],
  approved: [],
  rejected: [],
  failed: ["pending_approval"]
};

export function canTransitionRun(from: RunStatus, to: RunStatus): boolean {
  return RUN_TRANSITIONS[from].includes(to);
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
