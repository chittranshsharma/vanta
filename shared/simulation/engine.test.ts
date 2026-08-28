import { describe, expect, it } from "vitest";
import {
  applySimulationReview,
  executeCounterfactualSimulation,
  SIMULATION_ANALYSIS_ROLES,
  SIMULATION_SKIPPED_ROLES,
} from "./engine";
import type { CreativeTwinVersionSnapshot } from "./types";

const mockSnapshot: CreativeTwinVersionSnapshot = {
  twinId: "twin-sim-1",
  twinVersion: 2,
  workspaceId: "ws-sim-corp",
  totalDurationSeconds: 25.0,
  averageWpm: 150,
  scenes: [
    {
      sceneIndex: 0,
      text: "Stop wasting hours on manual spreadsheet tracking.",
      durationSeconds: 5.0,
      wpm: 96,
      claims: [],
    },
    {
      sceneIndex: 1,
      text: "Automate your customer data pipeline in under ten minutes.",
      durationSeconds: 12.0,
      wpm: 45,
      claims: [{ claimText: "10 minute data pipeline automation" }],
    },
    {
      sceneIndex: 2,
      text: "Try it free with your team today.",
      durationSeconds: 8.0,
      wpm: 52,
      claims: [],
    },
  ],
};

describe("executeCounterfactualSimulation", () => {
  it("executes the six-role analysis subgraph and produces a simulation run with strict epistemic boundaries", () => {
    const res = executeCounterfactualSimulation({
      workspaceId: "ws-sim-corp",
      actorUserId: "usr-operator-1",
      baselineSnapshot: mockSnapshot,
      hypothesis: "If hook highlights automated customer pipelines, reading burden decreases.",
      mutations: [
        {
          type: "hook_replacement",
          targetSceneIndex: 0,
          newHookText: "Automate data pipelines instantly.",
          rationale: "Punchier hook",
        },
      ],
      controls: ["soundtrack", "color_grading"],
      quotaAvailable: true,
    });

    expect(res.success).toBe(true);
    expect(res.simulationRun).toBeDefined();

    const run = res.simulationRun!;

    // 1. Council Execution checks: 6-role analysis subgraph + skipped roles report
    expect(run.councilExecution.analysisRolesRun).toEqual(SIMULATION_ANALYSIS_ROLES);
    expect(run.councilExecution.analysisRolesSkipped).toEqual(SIMULATION_SKIPPED_ROLES);
    expect(run.councilExecution.governanceRole).toBe("human_reviewer");

    // 2. CRITICAL EPISTEMIC INVARIANT: Evidence class is 'simulation'
    expect(run.evidenceClass).toBe("simulation");

    // 3. CRITICAL EMPIRICAL INVARIANT: Observed validation is strictly 'unknown' in v1
    expect(run.observedValidation).toBe("unknown");

    // 4. Governance state starts unreviewed
    expect(run.reviewDecision).toBe("unreviewed");
    expect(run.reviewedByUserId).toBeNull();

    // 5. Structural deltas are present and deterministic
    expect(run.simulatedVariant.structuralDelta.hasHookChanged).toBe(true);
    expect(run.simulatedVariant.structuralDelta.hasCtaChanged).toBe(false);

    // 6. Prohibited fields are NOT present
    const rawRun = run as unknown as Record<string, unknown>;
    expect(rawRun.viralityScore).toBeUndefined();
    expect(rawRun.predictedReach).toBeUndefined();
    expect(rawRun.conversionProbability).toBeUndefined();
    expect(rawRun.variance).toBeUndefined();
  });
});

describe("applySimulationReview", () => {
  it("records human acceptance while strictly preserving evidenceClass = 'simulation'", () => {
    const execution = executeCounterfactualSimulation({
      workspaceId: "ws-sim-corp",
      actorUserId: "usr-operator-1",
      baselineSnapshot: mockSnapshot,
      hypothesis: "Test hypothesis",
      mutations: [
        {
          type: "cta_replacement",
          targetSceneIndex: 2,
          newCtaText: "Start your free workflow now.",
          rationale: "Urgent CTA",
        },
      ],
      controls: [],
      quotaAvailable: true,
    });

    const initialRun = execution.simulationRun!;
    expect(initialRun.reviewDecision).toBe("unreviewed");

    // Apply human review gate
    const { updatedSimulationRun, auditEvent } = applySimulationReview(
      initialRun,
      "accepted",
      "usr-reviewer-9",
      "Approved simulation for physical experiment design"
    );

    // Review decision is now accepted
    expect(updatedSimulationRun.reviewDecision).toBe("accepted");
    expect(updatedSimulationRun.reviewedByUserId).toBe("usr-reviewer-9");
    expect(updatedSimulationRun.reviewedAt).toBeDefined();

    // CRITICAL INVARIANT: Human acceptance NEVER converts simulation into 'observed'!
    expect(updatedSimulationRun.evidenceClass).toBe("simulation");

    // Audit event is sanitized without prompts or raw customer text
    expect(auditEvent.action).toBe("simulation.run_reviewed");
    expect(auditEvent.actor_user_id).toBe("usr-reviewer-9");
    expect(auditEvent.metadata).toEqual({
      simulation_run_id: initialRun.simulationRunId,
      source_twin_id: initialRun.sourceTwinId,
      decision: "accepted",
      prior_decision: "unreviewed",
      evidence_class: "simulation",
      has_reason: true,
    });
  });
});
