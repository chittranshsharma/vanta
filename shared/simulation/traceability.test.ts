import { describe, expect, it } from "vitest";
import { createObservedTraceLink } from "./traceability";
import { executeCounterfactualSimulation } from "./engine";
import type { CreativeTwinVersionSnapshot, SimulationRun } from "./types";

const mockSnapshot: CreativeTwinVersionSnapshot = {
  twinId: "twin-trace-1",
  twinVersion: 1,
  workspaceId: "ws-trace-corp",
  totalDurationSeconds: 20.0,
  averageWpm: 150,
  scenes: [
    {
      sceneIndex: 0,
      text: "Hook scene text",
      durationSeconds: 10.0,
      wpm: 150,
      claims: [],
    },
    {
      sceneIndex: 1,
      text: "CTA scene text",
      durationSeconds: 10.0,
      wpm: 150,
      claims: [],
    },
  ],
};

describe("createObservedTraceLink", () => {
  it("creates a traceability-only link without computing variance or lift and preserves simulation evidence class", () => {
    const execution = executeCounterfactualSimulation({
      workspaceId: "ws-trace-corp",
      actorUserId: "usr-1",
      baselineSnapshot: mockSnapshot,
      hypothesis: "Test hypothesis",
      mutations: [
        {
          type: "hook_replacement",
          targetSceneIndex: 0,
          newHookText: "New hook text",
          rationale: "Reason",
        },
      ],
      controls: [],
      quotaAvailable: true,
    });

    const run = execution.simulationRun!;
    expect(run.observedValidation).toBe("unknown");
    expect(run.evidenceClass).toBe("simulation");

    const linkResult = createObservedTraceLink({
      simulationRun: run,
      experimentOutcomeId: "outcome-real-12345",
      actorUserId: "usr-linker-7",
    });

    expect(linkResult.success).toBe(true);
    expect(linkResult.traceLink).toBeDefined();
    expect(linkResult.traceLink!.simulationRunId).toBe(run.simulationRunId);
    expect(linkResult.traceLink!.experimentOutcomeId).toBe("outcome-real-12345");
    expect(linkResult.traceLink!.linkedByUserId).toBe("usr-linker-7");

    // Invariant: Traceability only in v1—zero variance or lift calculation
    const rawTrace = linkResult.traceLink as unknown as Record<string, unknown>;
    expect(rawTrace.variance).toBeUndefined();
    expect(rawTrace.lift).toBeUndefined();
    expect(rawTrace.accuracy).toBeUndefined();
    expect(rawTrace.predictionError).toBeUndefined();

    // Invariant: Updated simulation run is marked linked but retains evidence_class = 'simulation'
    const updatedRun = linkResult.updatedSimulationRun!;
    expect(updatedRun.observedValidation).toBe("linked");
    expect(updatedRun.evidenceClass).toBe("simulation");
  });

  it("fails when required fields are missing", () => {
    const linkResult = createObservedTraceLink({
      simulationRun: null as unknown as SimulationRun,
      experimentOutcomeId: "",
      actorUserId: "",
    });

    expect(linkResult.success).toBe(false);
    expect(linkResult.errors).toContain("Missing simulation run to link.");
  });
});
