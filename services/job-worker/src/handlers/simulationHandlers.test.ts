import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkerJob } from "../loop.js";
import {
  makeSimulationValidateHandler,
  makeSimulationExecuteHandler,
  makeSimulationReviewReadyHandler,
  makeSimulationObservedLinkHandler,
} from "./simulationHandlers.js";

function makeJob(type: WorkerJob["job_type"], payload: Record<string, unknown> = {}, workspaceId = "ws-1"): WorkerJob {
  return {
    id: "job-100",
    workspace_id: workspaceId,
    job_type: type,
    status: "running",
    payload,
    attempts: 1,
    max_attempts: 3,
    correlation_id: "corr-100",
  };
}

const mockBaselineSnapshot = {
  twinId: "twin-1",
  twinVersion: 1,
  workspaceId: "ws-1",
  totalDurationSeconds: 20,
  averageWpm: 150,
  scenes: [
    {
      sceneIndex: 0,
      text: "Hook scene text with some words.",
      onScreenText: "Hook Title",
      durationSeconds: 5,
      wpm: 120,
      claims: [],
    },
    {
      sceneIndex: 1,
      text: "Body scene text with approved claim.",
      onScreenText: "Body Title",
      durationSeconds: 15,
      wpm: 160,
      claims: [{ claimText: "Original claim" }],
    },
  ],
};

describe("simulation worker handlers", () => {
  describe("simulation_validate handler", () => {
    it("fails permanently when required payload fields are missing", async () => {
      const fakeClient = {} as SupabaseClient;
      const handler = makeSimulationValidateHandler(fakeClient);
      const res = await handler(makeJob("simulation_validate", {}), { deadlineMs: Date.now() + 5000 });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.failure.kind).toBe("permanent");
        expect(res.failure.code).toBe("bad_payload");
      }
    });

    it("fails permanently when twin version is not found in workspace", async () => {
      const fakeClient = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const handler = makeSimulationValidateHandler(fakeClient);
      const res = await handler(
        makeJob("simulation_validate", { twin_id: "twin-1", twin_version_id: "tv-missing" }),
        { deadlineMs: Date.now() + 5000 }
      );

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.failure.kind).toBe("permanent");
        expect(res.failure.code).toBe("not_found");
      }
    });

    it("validates successfully when twin and claim references match workspace", async () => {
      const fakeClient = {
        from: (table: string) => {
          if (table === "creative_twin_versions") {
            const b = {
              select: () => b,
              eq: () => b,
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: "tv-1", twin_id: "twin-1", workspace_id: "ws-1", version_number: 1 },
                  error: null,
                }),
            };
            return b;
          }
          if (table === "brand_claims") {
            const b = {
              select: () => b,
              eq: () => b,
              maybeSingle: () =>
                Promise.resolve({
                  data: { id: "claim-1", workspace_id: "ws-1", claim_type: "approved", review_status: "approved" },
                  error: null,
                }),
            };
            return b;
          }
          return {};
        },
      } as unknown as SupabaseClient;

      const handler = makeSimulationValidateHandler(fakeClient);
      const res = await handler(
        makeJob("simulation_validate", {
          twin_id: "twin-1",
          twin_version_id: "tv-1",
          hypothesis: "Test hypothesis",
          mutations: [
            {
              type: "claim_substitution",
              targetSceneIndex: 1,
              originalClaimText: "Original claim",
              substituteBrandClaimId: "claim-1",
              substituteBrandClaimText: "Approved claim text",
              proofPointId: "proof-1",
              rationale: "Align with brand",
            },
          ],
        }),
        { deadlineMs: Date.now() + 5000 }
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.result.valid).toBe(true);
        expect(res.result.mutation_count).toBe(1);
      }
    });
  });

  describe("simulation_execute handler", () => {
    it("fails permanently when twin version snapshot is not found", async () => {
      const fakeClient = {
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: null, error: null }),
                }),
              }),
            }),
          }),
        }),
      } as unknown as SupabaseClient;

      const handler = makeSimulationExecuteHandler(fakeClient);
      const res = await handler(
        makeJob("simulation_execute", {
          simulation_run_id: "sim-1",
          twin_id: "twin-1",
          twin_version_id: "tv-missing",
        }),
        { deadlineMs: Date.now() + 5000 }
      );

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.failure.kind).toBe("permanent");
        expect(res.failure.code).toBe("not_found");
      }
    });

    it("applies mutations deterministically, commits results, and completes run", async () => {
      let resultsInserted = false;
      let statusUpdated = false;

      const fakeClient = {
        auth: {
          getUser: () => Promise.resolve({ data: { user: { id: "u-1" } }, error: null }),
        },
        rpc: (fn: string) => {
          if (fn === "transition_simulation_run_status_atomic") {
            statusUpdated = true;
            return Promise.resolve({ data: { success: true, status: "completed" }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        from: (table: string) => {
          if (table === "creative_twin_versions") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      maybeSingle: () =>
                        Promise.resolve({
                          data: {
                            id: "tv-1",
                            twin_id: "twin-1",
                            workspace_id: "ws-1",
                            snapshot: mockBaselineSnapshot,
                          },
                          error: null,
                        }),
                    }),
                  }),
                }),
              }),
            };
          }
          if (table === "brand_claims") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => Promise.resolve({ data: [], error: null }),
                  }),
                }),
              }),
            };
          }
          if (table === "simulation_results") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () => Promise.resolve({ data: null, error: null }),
                  }),
                }),
              }),
              insert: () => {
                resultsInserted = true;
                return Promise.resolve({ error: null });
              },
            };
          }
          return {};
        },
      } as unknown as SupabaseClient;

      const handler = makeSimulationExecuteHandler(fakeClient);
      const res = await handler(
        makeJob("simulation_execute", {
          simulation_run_id: "sim-1",
          twin_id: "twin-1",
          twin_version_id: "tv-1",
          mutations: [
            {
              type: "hook_replacement",
              targetSceneIndex: 0,
              newHookText: "Brand new hook text replacing old hook.",
              rationale: "Pacing optimization",
            },
          ],
        }),
        { deadlineMs: Date.now() + 5000 }
      );

      expect(res.ok).toBe(true);
      expect(resultsInserted).toBe(true);
      expect(statusUpdated).toBe(true);
      if (res.ok) {
        expect(res.result.simulation_run_id).toBe("sim-1");
        expect(res.result.status).toBe("completed");
        expect(res.result.mutations_applied).toBe(1);
      }
    });
  });

  describe("simulation_review_ready handler", () => {
    it("transitions unreviewed run to needs_human and writes review event", async () => {
      let runReviewed = false;

      const fakeClient = {
        rpc: (fn: string) => {
          if (fn === "review_simulation_run_atomic") {
            runReviewed = true;
            return Promise.resolve({ data: { success: true, new_decision: "needs_human" }, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        from: (table: string) => {
          if (table === "simulation_runs") {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: () =>
                      Promise.resolve({
                        data: { id: "sim-1", workspace_id: "ws-1", review_decision: "unreviewed", status: "completed" },
                        error: null,
                      }),
                  }),
                }),
              }),
            };
          }
          return {};
        },
      } as unknown as SupabaseClient;

      const handler = makeSimulationReviewReadyHandler(fakeClient);
      const res = await handler(
        makeJob("simulation_review_ready", { simulation_run_id: "sim-1" }),
        { deadlineMs: Date.now() + 5000 }
      );

      expect(res.ok).toBe(true);
      expect(runReviewed).toBe(true);
      if (res.ok) {
        expect(res.result.review_decision).toBe("needs_human");
      }
    });
  });

  describe("simulation_observed_link handler", () => {
    it("invokes link_simulation_observed_outcome_atomic RPC and returns link result", async () => {
      const fakeClient = {
        rpc: (fn: string, args: { p_simulation_run_id: string; p_experiment_outcome_id: string }) => {
          if (fn === "link_simulation_observed_outcome_atomic") {
            return Promise.resolve({
              data: {
                success: true,
                link_id: "link-123",
                simulation_run_id: args.p_simulation_run_id,
                experiment_outcome_id: args.p_experiment_outcome_id,
                idempotent_replay: false,
              },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
      } as unknown as SupabaseClient;

      const handler = makeSimulationObservedLinkHandler(fakeClient);
      const res = await handler(
        makeJob("simulation_observed_link", {
          simulation_run_id: "sim-1",
          experiment_outcome_id: "outcome-999",
          note: "Post-hoc trace linkage",
        }),
        { deadlineMs: Date.now() + 5000 }
      );

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.result.link_id).toBe("link-123");
        expect(res.result.experiment_outcome_id).toBe("outcome-999");
      }
    });
  });
});
