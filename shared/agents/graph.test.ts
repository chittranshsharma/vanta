import { describe, expect, it } from "vitest";
import { CREATIVE_COUNCIL_GRAPH, ROLE_CONTRACTS, canTransitionRun, gateRuntime, validateGraph, type TaskGraph } from "./graph";

describe("validateGraph", () => {
  it("accepts the default council graph in topological order", () => {
    const v = validateGraph(CREATIVE_COUNCIL_GRAPH);
    expect(v.valid).toBe(true);
    expect(v.order).toEqual(["brief", "analysis", "arbiter", "evaluation", "review"]);
  });
  it("rejects user-facing output that bypasses the arbiter", () => {
    const g: TaskGraph = { name: "x", nodes: [{ id: "a", role: "creative_analyst", dependsOn: [], userFacing: true }] };
    const v = validateGraph(g);
    expect(v.valid).toBe(false);
    expect(v.errors).toEqual([expect.stringMatching(/not downstream of an evidence_arbiter/), expect.stringMatching(/no human_reviewer/)]);
  });
  it("rejects cycles and unknown dependencies", () => {
    const g: TaskGraph = { name: "x", nodes: [
      { id: "a", role: "discovery", dependsOn: ["b"], userFacing: false },
      { id: "b", role: "evidence_arbiter", dependsOn: ["a"], userFacing: false },
      { id: "c", role: "evaluator", dependsOn: ["zzz"], userFacing: false }
    ] };
    const v = validateGraph(g);
    expect(v.errors).toContain("Graph contains a cycle.");
    expect(v.errors).toContain('Node "c" depends on unknown node "zzz".');
  });
});

describe("role contracts", () => {
  it("only the human reviewer produces observed evidence; no role writes directly", () => {
    for (const c of Object.values(ROLE_CONTRACTS)) {
      if (c.role === "human_reviewer") expect(c.evidenceClass).toBe("observed");
      else expect(c.evidenceClass).toBe("inference");
      expect(c.reads.length).toBeGreaterThan(0);
    }
    expect(ROLE_CONTRACTS.evaluator.purpose).toMatch(/never against audience outcomes/);
  });
});

describe("runtime gate", () => {
  it("is unavailable when anything is unknown and lists every reason", () => {
    const g = gateRuntime({ gateway: "unknown", jobsTable: "unknown", agentTasksEnabled: "unknown" });
    expect(g.state).toBe("unavailable");
    expect(g.reasons).toHaveLength(3);
  });
  it("is available only when all capabilities are positively known", () => {
    expect(gateRuntime({ gateway: "configured", jobsTable: "applied", agentTasksEnabled: "yes" })).toEqual({ state: "available", reasons: [] });
  });
});

describe("run transitions", () => {
  it("never leaves unavailable and requires review before approval", () => {
    expect(canTransitionRun("unavailable", "queued")).toBe(false);
    expect(canTransitionRun("running", "approved")).toBe(false);
    expect(canTransitionRun("awaiting_review", "approved")).toBe(true);
  });
});
