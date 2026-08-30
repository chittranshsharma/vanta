import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createPersistentSimulationRun,
  listSimulationRuns,
  fetchSimulationRunDetails,
  reviewSimulationRun,
  linkSimulationObservedOutcome,
  transitionSimulationRunStatus,
  enqueueSimulationJob,
} from "./simulations";
import { supabase } from "./supabase";
import type { CreativeTwinVersionSnapshot } from "../../shared/simulation/types";

vi.mock("./supabase", () => {
  const rpcMock = vi.fn();
  const fromMock = vi.fn();
  return {
    isSupabaseConfigured: true,
    supabase: {
      rpc: rpcMock,
      from: fromMock,
    },
  };
});

const mockBaselineSnapshot: CreativeTwinVersionSnapshot = {
  twinId: "twin-111",
  twinVersion: 1,
  workspaceId: "ws-123",
  totalDurationSeconds: 30,
  averageWpm: 140,
  scenes: [
    {
      sceneIndex: 0,
      text: "Stop wasting hours on manual creative auditing today.",
      onScreenText: "Automate Your Creative Audits",
      durationSeconds: 5,
      wpm: 120,
      claims: [],
    },
    {
      sceneIndex: 1,
      text: "Vanta gives you evidence-grounded creative intelligence with transparent proof.",
      onScreenText: "Evidence-Grounded Intelligence",
      durationSeconds: 15,
      wpm: 150,
      claims: [{ claimText: "evidence-grounded creative intelligence" }],
    },
    {
      sceneIndex: 2,
      text: "Try Vanta now and see transparent evidence in action.",
      onScreenText: "Start Free Trial",
      durationSeconds: 10,
      wpm: 150,
      claims: [],
    },
  ],
};

describe("simulations service boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createPersistentSimulationRun", () => {
    it("executes deterministic mutations and persists run via atomic RPC", async () => {
      const rpcSpy = vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: { success: true, simulation_run_id: "sim-999", idempotent_replay: false },
        error: null,
      } as any);

      const result = await createPersistentSimulationRun({
        workspaceId: "ws-123",
        actorUserId: "user-456",
        baselineSnapshot: mockBaselineSnapshot,
        twinVersionId: "tv-111-v1",
        hypothesis: "Shortening hook increases pacing without losing core message.",
        mutations: [
          {
            type: "hook_replacement",
            targetSceneIndex: 0,
            newHookText: "Stop wasting hours auditing ads manually.",
            rationale: "More punchy hook",
          },
        ],
      });

      expect(result.error).toBeNull();
      expect(result.data?.simulationRunId).toBe("sim-999");
      expect(result.data?.idempotentReplay).toBe(false);
      expect(result.data?.execution.success).toBe(true);
      expect(result.data?.execution.simulationRun?.evidenceClass).toBe("simulation");
      expect(result.data?.execution.simulationRun?.observedValidation).toBe("unknown");

      expect(rpcSpy).toHaveBeenCalledWith(
        "create_simulation_run_atomic",
        expect.objectContaining({
          p_workspace_id: "ws-123",
          p_twin_id: "twin-111",
          p_twin_version_id: "tv-111-v1",
          p_twin_version: 1,
          p_hypothesis: "Shortening hook increases pacing without losing core message.",
        })
      );
    });

    it("rejects cross-tenant baseline snapshot before RPC invocation", async () => {
      const result = await createPersistentSimulationRun({
        workspaceId: "ws-123",
        actorUserId: "user-456",
        baselineSnapshot: {
          ...mockBaselineSnapshot,
          workspaceId: "ws-other-tenant",
        },
        twinVersionId: "tv-111-v1",
        hypothesis: "Test hypothesis",
        mutations: [
          {
            type: "hook_replacement",
            targetSceneIndex: 0,
            newHookText: "New hook",
            rationale: "Rationale",
          },
        ],
      });

      expect(result.data).toBeNull();
      expect(result.error).toMatch(/Cross-tenant baseline rejected/i);
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it("returns idempotent replay when RPC signals duplicate request", async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: { success: true, simulation_run_id: "sim-existing-123", idempotent_replay: true },
        error: null,
      } as any);

      const result = await createPersistentSimulationRun({
        workspaceId: "ws-123",
        actorUserId: "user-456",
        baselineSnapshot: mockBaselineSnapshot,
        twinVersionId: "tv-111-v1",
        hypothesis: "Idempotent test",
        idempotencyKey: "sim-idemp-1",
        mutations: [
          {
            type: "scene_duration_adjust",
            targetSceneIndex: 1,
            newDurationSeconds: 12,
            rationale: "Slightly faster middle scene",
          },
        ],
      });

      expect(result.error).toBeNull();
      expect(result.data?.simulationRunId).toBe("sim-existing-123");
      expect(result.data?.idempotentReplay).toBe(true);
    });

    it("surfaces server RPC error cleanly", async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: { message: "Twin version not found in workspace ws-123." },
      } as any);

      const result = await createPersistentSimulationRun({
        workspaceId: "ws-123",
        actorUserId: "user-456",
        baselineSnapshot: mockBaselineSnapshot,
        twinVersionId: "tv-invalid",
        hypothesis: "Invalid twin version test",
        mutations: [
          {
            type: "hook_replacement",
            targetSceneIndex: 0,
            newHookText: "New Hook",
            rationale: "Rationale",
          },
        ],
      });

      expect(result.data).toBeNull();
      expect(result.error).toBe("Twin version not found in workspace ws-123.");
    });
  });

  describe("listSimulationRuns", () => {
    it("queries simulation_runs scoped by workspace and ordered by created_at DESC", async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: "sim-1",
              workspace_id: "ws-123",
              hypothesis: "Hypothesis 1",
              status: "completed",
              evidence_class: "simulation",
              observed_validation: "unknown",
              review_decision: "unreviewed",
            },
          ],
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockQuery as any);

      const result = await listSimulationRuns("ws-123");
      expect(result.error).toBeNull();
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].id).toBe("sim-1");
      expect(mockQuery.eq).toHaveBeenCalledWith("workspace_id", "ws-123");
      expect(mockQuery.order).toHaveBeenCalledWith("created_at", { ascending: false });
    });
  });

  describe("fetchSimulationRunDetails", () => {
    it("fetches run, mutations, results, reviews, and trace links", async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "simulation_runs") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "sim-1",
                workspace_id: "ws-123",
                hypothesis: "Hypothesis",
                evidence_class: "simulation",
                observed_validation: "unknown",
                review_decision: "unreviewed",
              },
              error: null,
            }),
          } as any;
        }
        if (table === "simulation_mutations") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "mut-1",
                  sequence_order: 0,
                  mutation_type: "hook_replacement",
                  rationale: "Punchy hook",
                },
              ],
              error: null,
            }),
          } as any;
        }
        if (table === "simulation_results") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "res-1",
                structural_delta: { durationDeltaSeconds: -2 },
              },
              error: null,
            }),
          } as any;
        }
        if (table === "simulation_review_events") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "rev-1",
                  event_kind: "created",
                  new_decision: "unreviewed",
                },
              ],
              error: null,
            }),
          } as any;
        }
        if (table === "simulation_observed_links") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          } as any;
        }
        return {} as any;
      });

      const result = await fetchSimulationRunDetails("ws-123", "sim-1");
      expect(result.error).toBeNull();
      expect(result.data?.run.id).toBe("sim-1");
      expect(result.data?.mutations).toHaveLength(1);
      expect(result.data?.results?.id).toBe("res-1");
      expect(result.data?.reviewEvents).toHaveLength(1);
      expect(result.data?.observedLinks).toEqual([]);
    });

    it("returns error if run is not found", async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === "simulation_runs") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          } as any;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        } as any;
      });

      const result = await fetchSimulationRunDetails("ws-123", "sim-nonexistent");
      expect(result.data).toBeNull();
      expect(result.error).toMatch(/Simulation run sim-nonexistent not found/i);
    });
  });

  describe("reviewSimulationRun", () => {
    it("calls review_simulation_run_atomic and records review decision", async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: {
          success: true,
          simulation_run_id: "sim-1",
          previous_decision: "unreviewed",
          new_decision: "accepted",
          idempotent_no_op: false,
        },
        error: null,
      } as any);

      const result = await reviewSimulationRun({
        workspaceId: "ws-123",
        simulationRunId: "sim-1",
        decision: "accepted",
        rationale: "Approved for physical A/B testing in staging",
      });

      expect(result.error).toBeNull();
      expect(result.data?.newDecision).toBe("accepted");
      expect(result.data?.idempotentNoOp).toBe(false);

      expect(supabase.rpc).toHaveBeenCalledWith("review_simulation_run_atomic", {
        p_workspace_id: "ws-123",
        p_simulation_run_id: "sim-1",
        p_decision: "accepted",
        p_rationale: "Approved for physical A/B testing in staging",
        p_metadata: {},
      });
    });

    it("handles idempotent review no-op cleanly", async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: {
          success: true,
          simulation_run_id: "sim-1",
          previous_decision: "accepted",
          new_decision: "accepted",
          idempotent_no_op: true,
        },
        error: null,
      } as any);

      const result = await reviewSimulationRun({
        workspaceId: "ws-123",
        simulationRunId: "sim-1",
        decision: "accepted",
      });

      expect(result.error).toBeNull();
      expect(result.data?.idempotentNoOp).toBe(true);
    });
  });

  describe("linkSimulationObservedOutcome", () => {
    it("links real experiment outcome for traceability via atomic RPC", async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: {
          success: true,
          link_id: "link-777",
          simulation_run_id: "sim-1",
          experiment_outcome_id: "out-888",
          idempotent_replay: false,
        },
        error: null,
      } as any);

      const result = await linkSimulationObservedOutcome({
        workspaceId: "ws-123",
        simulationRunId: "sim-1",
        experimentOutcomeId: "out-888",
        note: "Linked to live experiment outcome batch #12",
      });

      expect(result.error).toBeNull();
      expect(result.data?.linkId).toBe("link-777");
      expect(result.data?.idempotentReplay).toBe(false);

      expect(supabase.rpc).toHaveBeenCalledWith("link_simulation_observed_outcome_atomic", {
        p_workspace_id: "ws-123",
        p_simulation_run_id: "sim-1",
        p_experiment_outcome_id: "out-888",
        p_note: "Linked to live experiment outcome batch #12",
        p_metadata: {},
      });
    });
  });

  describe("transitionSimulationRunStatus and cancelSimulationRun", () => {
    it("transitions status via RPC without deleting records", async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: {
          success: true,
          simulation_run_id: "sim-1",
          previous_status: "queued",
          status: "cancelled",
          idempotent_no_op: false,
        },
        error: null,
      } as any);

      const result = await transitionSimulationRunStatus({
        workspaceId: "ws-123",
        simulationRunId: "sim-1",
        targetStatus: "cancelled",
        reason: "User cancelled planning variant",
      });

      expect(result.error).toBeNull();
      expect(result.data?.status).toBe("cancelled");

      expect(supabase.rpc).toHaveBeenCalledWith("transition_simulation_run_status_atomic", {
        p_workspace_id: "ws-123",
        p_simulation_run_id: "sim-1",
        p_target_status: "cancelled",
        p_reason: "User cancelled planning variant",
      });
    });
  });

  describe("enqueueSimulationJob", () => {
    it("checks quota before enqueueing background simulation job", async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: true,
        error: null,
      } as any);

      const mockInsert = {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: "job-999" },
          error: null,
        }),
      };

      vi.mocked(supabase.from).mockReturnValue(mockInsert as any);

      const result = await enqueueSimulationJob({
        workspaceId: "ws-123",
        jobType: "simulation_execute",
        payload: {
          simulation_run_id: "sim-1",
          twin_id: "twin-111",
          twin_version_id: "tv-111-v1",
        },
      });

      expect(result.error).toBeNull();
      expect(result.data?.jobId).toBe("job-999");
      expect(supabase.rpc).toHaveBeenCalledWith("consume_quota", {
        p_workspace_id: "ws-123",
        p_kind: "job_enqueue",
        p_count: 1,
      });
    });

    it("fails closed when daily job enqueue quota is exhausted", async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: false,
        error: null,
      } as any);

      const result = await enqueueSimulationJob({
        workspaceId: "ws-123",
        jobType: "simulation_execute",
        payload: {
          simulation_run_id: "sim-1",
        },
      });

      expect(result.data).toBeNull();
      expect(result.error).toMatch(/Daily job enqueue quota exhausted/i);
      expect(supabase.from).not.toHaveBeenCalled();
    });
  });
});
