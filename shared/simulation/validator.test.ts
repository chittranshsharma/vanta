import { describe, expect, it } from "vitest";
import { validateSimulationRunRequest } from "./validator";
import type { CreativeTwinVersionSnapshot } from "./types";

const mockSnapshot: CreativeTwinVersionSnapshot = {
  twinId: "twin-1",
  twinVersion: 1,
  workspaceId: "ws-aaa",
  totalDurationSeconds: 20.0,
  averageWpm: 140,
  scenes: [
    {
      sceneIndex: 0,
      text: "Scene 1 text here",
      durationSeconds: 10.0,
      wpm: 140,
      claims: [],
    },
    {
      sceneIndex: 1,
      text: "Scene 2 text here",
      durationSeconds: 10.0,
      wpm: 140,
      claims: [],
    },
  ],
};

describe("validateSimulationRunRequest", () => {
  it("validates a well-formed simulation request", () => {
    const res = validateSimulationRunRequest({
      workspaceId: "ws-aaa",
      actorUserId: "usr-1",
      baselineSnapshot: mockSnapshot,
      hypothesis: "If Scene 1 hook is condensed, reading burden will drop below 150 WPM.",
      mutations: [
        {
          type: "hook_replacement",
          targetSceneIndex: 0,
          newHookText: "Condensed hook text",
          rationale: "Improve hook pacing",
        },
      ],
      controls: ["video_aspect_ratio", "scene_count"],
      quotaAvailable: true,
    });

    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it("rejects cross-tenant baseline snapshot", () => {
    const res = validateSimulationRunRequest({
      workspaceId: "ws-different-bbb",
      actorUserId: "usr-1",
      baselineSnapshot: mockSnapshot, // workspaceId: 'ws-aaa'
      hypothesis: "Test hypothesis",
      mutations: [
        {
          type: "hook_replacement",
          targetSceneIndex: 0,
          newHookText: "Hook",
          rationale: "Reason",
        },
      ],
      controls: [],
    });

    expect(res.valid).toBe(false);
    expect(res.errors[0]).toContain("Cross-tenant baseline rejected");
  });

  it("rejects missing hypothesis or empty mutations", () => {
    const res = validateSimulationRunRequest({
      workspaceId: "ws-aaa",
      actorUserId: "usr-1",
      baselineSnapshot: mockSnapshot,
      hypothesis: "",
      mutations: [],
      controls: [],
    });

    expect(res.valid).toBe(false);
    expect(res.errors).toContain("An explicit counterfactual hypothesis is required.");
    expect(res.errors).toContain("At least one counterfactual mutation must be declared.");
  });

  it("fails closed before execution when quota is exhausted", () => {
    const res = validateSimulationRunRequest({
      workspaceId: "ws-aaa",
      actorUserId: "usr-1",
      baselineSnapshot: mockSnapshot,
      hypothesis: "Valid hypothesis",
      mutations: [
        {
          type: "hook_replacement",
          targetSceneIndex: 0,
          newHookText: "Hook",
          rationale: "Reason",
        },
      ],
      controls: [],
      quotaAvailable: false,
    });

    expect(res.valid).toBe(false);
    expect(res.errors).toContain(
      "Workspace model quota exhausted or reset pending. Execution halted before model call."
    );
  });
});
