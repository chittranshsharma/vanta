import { describe, expect, it } from "vitest";
import {
  AGENT_ROLES,
  CREATIVE_COUNCIL_GRAPH,
  FULL_COUNCIL_GRAPH,
  ROLE_CONTRACTS,
  canTransitionRun,
  gateRuntime,
  planMinimalSubgraph,
  validateGraph,
  type TaskGraph,
} from "./graph";

describe("validateGraph", () => {
  it("accepts the default council graph in topological order", () => {
    const v = validateGraph(CREATIVE_COUNCIL_GRAPH);
    expect(v.valid).toBe(true);
    expect(v.order).toEqual(["brief", "analysis", "arbiter", "evaluation", "review"]);
  });

  it("accepts the 11-role master council graph in topological order", () => {
    const v = validateGraph(FULL_COUNCIL_GRAPH);
    expect(v.valid).toBe(true);
    expect(v.order.length).toBe(11);
    expect(v.order[0]).toBe("discovery");
    expect(v.order[v.order.length - 1]).toBe("human_reviewer");
  });

  it("rejects user-facing output that bypasses the arbiter", () => {
    const g: TaskGraph = { name: "x", nodes: [{ id: "a", role: "creative_analyst", dependsOn: [], userFacing: true }] };
    const v = validateGraph(g);
    expect(v.valid).toBe(false);
    expect(v.errors).toEqual([
      expect.stringMatching(/not downstream of an evidence_arbiter/),
      expect.stringMatching(/requires human review/),
    ]);
  });

  it("rejects cycles and unknown dependencies", () => {
    const g: TaskGraph = {
      name: "x",
      nodes: [
        { id: "a", role: "discovery", dependsOn: ["b"], userFacing: false },
        { id: "b", role: "evidence_arbiter", dependsOn: ["a"], userFacing: false },
        { id: "c", role: "evaluator", dependsOn: ["zzz"], userFacing: false },
      ],
    };
    const v = validateGraph(g);
    expect(v.errors).toContain("Graph contains a cycle.");
    expect(v.errors).toContain('Node "c" depends on unknown node "zzz".');
  });

  it("rejects nodes declaring unauthorized tools or inputs", () => {
    const g: TaskGraph = {
      name: "x",
      nodes: [
        {
          id: "disc",
          role: "discovery",
          dependsOn: [],
          userFacing: false,
          declaredTools: ["tool:unauthorized_database_mutator"],
          declaredInputs: ["cap:unauthorized_admin_key"],
        },
        { id: "arb", role: "evidence_arbiter", dependsOn: ["disc"], userFacing: false },
        { id: "eval", role: "evaluator", dependsOn: ["arb"], userFacing: true },
        { id: "rev", role: "human_reviewer", dependsOn: ["eval"], userFacing: true },
      ],
    };
    const v = validateGraph(g);
    expect(v.valid).toBe(false);
    expect(v.errors).toContain('Node "disc" (discovery) declared unauthorized tool "tool:unauthorized_database_mutator".');
    expect(v.errors).toContain('Node "disc" (discovery) declared unauthorized input "cap:unauthorized_admin_key".');
  });

  it("rejects graphs that exceed maximum node budget", () => {
    const v = validateGraph(FULL_COUNCIL_GRAPH, { maxNodes: 5 });
    expect(v.valid).toBe(false);
    expect(v.errors).toContain("Graph node count 11 exceeds maximum budget of 5.");
  });

  it("rejects graphs that exceed maximum model call budget", () => {
    const v = validateGraph(FULL_COUNCIL_GRAPH, { maxModelCalls: 2 });
    expect(v.valid).toBe(false);
    expect(v.errors[0]).toMatch(/exceeds maximum budget of 2/);
  });
});

describe("planMinimalSubgraph", () => {
  it("plans a minimal subgraph containing only requested roles and necessary ancestors plus governance", () => {
    const sub = planMinimalSubgraph("audience_brief", ["audience_researcher"]);
    expect(sub.nodes.map((n) => n.role)).toEqual([
      "discovery",
      "audience_researcher",
      "evidence_arbiter",
      "evaluator",
      "human_reviewer",
    ]);

    const v = validateGraph(sub);
    expect(v.valid).toBe(true);
  });

  it("plans a compliance subgraph with claim auditor and compliance reviewer", () => {
    const sub = planMinimalSubgraph("compliance_check", ["compliance_reviewer"]);
    expect(sub.nodes.map((n) => n.role)).toEqual([
      "discovery",
      "claim_auditor",
      "compliance_reviewer",
      "evidence_arbiter",
      "evaluator",
      "human_reviewer",
    ]);
    const v = validateGraph(sub);
    expect(v.valid).toBe(true);
  });
});

describe("role contracts", () => {
  it("defines all 11 specialist roles with least-privilege capability boundaries", () => {
    expect(AGENT_ROLES.length).toBe(11);
    for (const role of AGENT_ROLES) {
      const c = ROLE_CONTRACTS[role];
      expect(c).toBeDefined();
      expect(c.version).toBe("1.0.0");
      expect(c.allowedInputCapabilities.length).toBeGreaterThan(0);
      expect(c.allowedToolCapabilities.length).toBeGreaterThan(0);
      expect(c.prohibitedActions.length).toBeGreaterThan(0);
      expect(c.auditMetadataKeys.length).toBeGreaterThan(0);

      // Only human_reviewer is observed; all analysis is inference
      if (c.role === "human_reviewer") {
        expect(c.evidenceClass).toBe("observed");
      } else {
        expect(c.evidenceClass).toBe("inference");
      }
    }
  });

  it("prohibits autonomous database mutations and outbound communication on all analysis roles", () => {
    for (const role of AGENT_ROLES) {
      if (role === "human_reviewer") continue;
      const c = ROLE_CONTRACTS[role];
      expect(c.prohibitedActions).toContain("action:direct_db_write");
      expect(c.prohibitedActions).toContain("action:outbound_communication");
    }
  });
});

describe("runtime gate", () => {
  it("is unavailable when anything is unknown and lists every reason", () => {
    const g = gateRuntime({ gateway: "unknown", jobsTable: "unknown", agentTasksEnabled: "unknown" });
    expect(g.state).toBe("unavailable");
    expect(g.reasons).toHaveLength(3);
  });
  it("is available only when all capabilities are positively known", () => {
    expect(gateRuntime({ gateway: "configured", jobsTable: "applied", agentTasksEnabled: "yes" })).toEqual({
      state: "available",
      reasons: [],
    });
  });
});

describe("run transitions", () => {
  it("never leaves unavailable and requires review before approval", () => {
    expect(canTransitionRun("unavailable", "queued")).toBe(false);
    expect(canTransitionRun("running", "approved")).toBe(false);
    expect(canTransitionRun("awaiting_review", "approved")).toBe(true);
  });
});
