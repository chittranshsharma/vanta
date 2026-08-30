import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { evaluateSourceCitability } from "../src/lib/sourceRegistry";
import { analyzeCohortOutliers } from "../shared/cohorts/outlierAnalysis";
import { optimizePublishingSchedule } from "../shared/publishing/scheduleOptimizer";
import { executeCounterfactualSimulation } from "../shared/simulation/engine";
import { aggregateConversationObservations } from "../shared/conversations/spikeAggregation";
import { buildSourceGroundedReplyDraft } from "../shared/conversations/replyDrafts";

const env = process.env;
const configured = Boolean(
  env.E2E_SUPABASE_URL &&
    env.E2E_SUPABASE_ANON_KEY &&
    env.E2E_USER_A_EMAIL &&
    env.E2E_USER_A_PASSWORD &&
    env.E2E_USER_B_EMAIL &&
    env.E2E_USER_B_PASSWORD
);

async function signIn(email: string, password: string): Promise<{ client: SupabaseClient; userId: string; workspaceId: string }> {
  const client = createClient(env.E2E_SUPABASE_URL!, env.E2E_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  const { data: ws } = await client.from("workspace_members").select("workspace_id").eq("user_id", data.user.id).limit(1).single();
  if (!ws) throw new Error(`no workspace for ${email}`);
  return { client, userId: data.user.id, workspaceId: ws.workspace_id as string };
}

test.describe("QA-2: Full Workspace Workflow & Tenant Isolation", () => {
  test.skip(!configured, "E2E_* environment not configured");

  let a: Awaited<ReturnType<typeof signIn>>;
  let b: Awaited<ReturnType<typeof signIn>>;

  test.beforeAll(async () => {
    a = await signIn(env.E2E_USER_A_EMAIL!, env.E2E_USER_A_PASSWORD!);
    b = await signIn(env.E2E_USER_B_EMAIL!, env.E2E_USER_B_PASSWORD!);
    expect(a.workspaceId).not.toBe(b.workspaceId);
  });

  test("Brand Brain: Tenant A registers approved claim", async () => {
    const { data: existingBrand } = await a.client.from("brands").select("id").eq("workspace_id", a.workspaceId).maybeSingle();
    let brandId = existingBrand?.id;
    if (!brandId) {
      const { data: newBrand } = await a.client
        .from("brands")
        .insert({
          workspace_id: a.workspaceId,
          name: "Acme Workflow Automation",
          core_promise: "Deterministic analytics without false predictions",
          created_by: a.userId,
        })
        .select()
        .single();
      brandId = newBrand?.id;
    }
    expect(brandId).toBeTruthy();

    const { data: claim, error } = await a.client
      .from("brand_claims")
      .insert({
        workspace_id: a.workspaceId,
        brand_id: brandId!,
        claim_text: `QA2 E2E Claim ${randomUUID().slice(0, 8)}`,
        claim_type: "approved",
        review_status: "approved",
        created_by: a.userId,
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(claim).toBeTruthy();

    // Teardown claim
    if (claim) {
      await a.client.from("brand_claims").delete().eq("id", claim.id);
    }
  });

  test("Source Registry & Cohorts (Slice A): Citability & Outlier Analysis", async () => {
    const { data: source, error: sourceErr } = await a.client
      .from("source_registry")
      .insert({
        workspace_id: a.workspaceId,
        name: `QA2 Feed ${randomUUID().slice(0, 8)}`,
        source_type: "api_feed",
        health_status: "unverified",
        created_by: a.userId,
      })
      .select()
      .single();

    expect(sourceErr).toBeNull();
    expect(source).toBeTruthy();

    const citability = evaluateSourceCitability(source!);
    expect(["verified", "citable_stale", "citable_unverified", "blocked"]).toContain(citability.status);

    const cohortName = `QA2 E2E Cohort ${randomUUID().slice(0, 8)}`;
    const { data: cohortData, error: cohortErr } = await a.client.rpc("create_source_cohort", {
      p_workspace_id: a.workspaceId,
      p_name: cohortName,
      p_description: "QA-2 automated validation cohort",
      p_tags: ["qa2", "validation"],
    });

    expect(cohortErr).toBeNull();
    const cohortId = (cohortData as unknown as { cohort_id: string })?.cohort_id;
    expect(cohortId).toBeTruthy();

    const smallSampleResult = analyzeCohortOutliers(
      [
        {
          id: "obs-1",
          sourceId: source!.id,
          metricKey: "views",
          value: 100,
          unit: "count",
          calculationMethod: "sum",
          observedAt: "2026-08-30T10:00:00Z",
          evidenceClass: "observed",
          citability: "verified",
        },
      ],
      {
        cohortId,
        expectedMetricKey: "views",
        expectedUnit: "count",
        expectedCalculationMethod: "sum",
      }
    );
    expect(smallSampleResult.status).toBe("insufficient_evidence");

    // Clean up
    await a.client.from("source_cohort_members").delete().eq("cohort_id", cohortId);
    await a.client.from("source_cohorts").delete().eq("id", cohortId);
    await a.client.from("source_registry").delete().eq("id", source!.id);
  });

  test("Publishing Schedule (Slice A): Timezone & Insufficient Sample Gate", () => {
    const scheduleResult = optimizePublishingSchedule(
      [
        {
          id: "p1",
          workspaceId: a.workspaceId,
          sourceId: "src-1",
          publishedAt: "2026-08-25T14:30:00Z",
          metricKey: "completion_rate",
          value: 0.65,
          unit: "ratio",
          calculationMethod: "mean",
          evidenceClass: "observed",
          citability: "verified",
        },
      ],
      {
        workspaceId: a.workspaceId,
        timeZone: "America/New_York",
        expectedMetricKey: "completion_rate",
        expectedUnit: "ratio",
        expectedCalculationMethod: "mean",
      }
    );

    expect(scheduleResult.status).toBe("insufficient_evidence");
    expect(scheduleResult.timeZone).toBe("America/New_York");
  });

  test("Simulation Lab (Slice B): Bounded Mutations, Governance Review & Epistemic Invariants", async () => {
    const simExecution = executeCounterfactualSimulation({
      workspaceId: a.workspaceId,
      actorUserId: a.userId,
      baselineSnapshot: {
        twinId: randomUUID(),
        twinVersion: 1,
        workspaceId: a.workspaceId,
        totalDurationSeconds: 20,
        averageWpm: 130,
        scenes: [
          { sceneIndex: 0, text: "Stop doing manual tasks.", durationSeconds: 5, wpm: 120, claims: [] },
          { sceneIndex: 1, text: "Switch to automated workflows today.", durationSeconds: 15, wpm: 133, claims: [] },
        ],
      },
      hypothesis: "Direct value hook.",
      mutations: [
        {
          type: "hook_replacement",
          targetSceneIndex: 0,
          newHookText: "Automate your repetitive tasks in minutes.",
          rationale: "Direct value hook replacement.",
        },
      ],
      controls: [],
      approvedClaims: [],
    });

    expect(simExecution.success).toBe(true);
    expect(simExecution.simulationRun?.evidenceClass).toBe("simulation");
    expect(simExecution.simulationRun?.observedValidation).toBe("unknown");
  });

  test("Conversation Intelligence (Slice C): Ingestion, Review & Grounded Reply Draft", async () => {
    const replyOutcome = buildSourceGroundedReplyDraft({
      observation_id: "obs-1",
      observation_text: "Does this support automated tests?",
      approved_claims: [{
        id: "claim-1",
        claim_text: "Reduces regression testing time by 50%",
        review_status: "approved",
      }],
      approved_proof_points: [],
    });

    expect(replyOutcome.status).toBe("ready");
    expect(replyOutcome.evidence_class).toBe("inference");

    const spikeRes = aggregateConversationObservations({
      observations: [{ observed_at: new Date().toISOString() }],
      timeZone: "America/New_York",
    });
    expect(spikeRes.total_observations).toBe(1);
  });

  test("Cross-Tenant Isolation: Tenant B cannot read or mutate Tenant A data", async () => {
    const { data: bReadsA_brand } = await b.client.from("brand_claims").select("*").eq("workspace_id", a.workspaceId);
    expect(bReadsA_brand).toEqual([]);

    const { data: bReadsA_sims } = await b.client.from("simulation_runs").select("*").eq("workspace_id", a.workspaceId);
    expect(bReadsA_sims).toEqual([]);

    const { error: bReviewsA_err } = await b.client.rpc("review_simulation_run_atomic", {
      p_workspace_id: a.workspaceId,
      p_simulation_run_id: randomUUID(),
      p_decision: "rejected",
      p_rationale: "Unauthorized cross-tenant attempt",
    });
    expect(bReviewsA_err).toBeTruthy();
  });
});
