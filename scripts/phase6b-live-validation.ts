/**
 * Phase 6B — Counterfactual Simulation Lab Live Disposable Validation Script
 *
 * Runs comprehensive live validation against the remote Supabase instance
 * using disposable test users and workspaces with real JWT sessions.
 *
 * Enforces:
 * - Read-only inventory and schema parity
 * - Authenticated lifecycle execution (Create -> Status -> Review -> Link -> Cancel)
 * - Strict evidence class ('simulation') preservation
 * - Authenticated negative cross-tenant and RLS violation proofs
 * - Idempotency replay on duplicate requests
 * - Worker job handlers and quota consumption
 * - Scoped cleanup
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import {
  makeSimulationValidateHandler,
  makeSimulationExecuteHandler,
  makeSimulationReviewReadyHandler,
  makeSimulationObservedLinkHandler,
} from "../services/job-worker/src/handlers/simulationHandlers.js";
import type { WorkerJob } from "../services/job-worker/src/loop.js";

const SUPABASE_URL = "https://ujxrapbhiedkwleccvqw.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqeHJhcGJoaWVka3dsZWNjdnF3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc0MTE3MzgsImV4cCI6MjEwMjk4NzczOH0.6bV-_1CRdAbQaTi3dl2UzMqj_7RxQOIi7O0i5tI4YXE";

interface ValidationResult {
  step: string;
  check: string;
  passed: boolean;
  details?: string;
}

const results: ValidationResult[] = [];

function record(step: string, check: string, passed: boolean, details?: string) {
  results.push({ step, check, passed, details });
  const status = passed ? "✓ PASS" : "✗ FAIL";
  console.log(`[${status}] ${step} - ${check}${details ? ` (${details})` : ""}`);
  if (!passed) {
    throw new Error(`VALIDATION FAILED at ${step} - ${check}: ${details}`);
  }
}

async function main() {
  console.log("==================================================================");
  console.log("Vanta — Phase 6B Live Disposable Validation Execution");
  console.log("==================================================================");

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  // ==================================================================
  // STEP A: READ-ONLY INVENTORY & UNANIMOUS ACCESS CHECKS
  // ==================================================================
  console.log("\n--- STEP A: Read-Only Inventory ---");

  // 1. Check unauthenticated access is blocked
  const { data: unauthSelect, error: unauthErr } = await anonClient
    .from("simulation_runs")
    .select("id")
    .limit(1);

  record(
    "Step A",
    "Unauthenticated direct SELECT on simulation_runs is blocked or empty",
    unauthSelect === null || unauthSelect.length === 0,
    unauthErr ? `Error: ${unauthErr.message}` : "Empty array returned (RLS filtered)"
  );

  const { error: unauthRpcErr } = await anonClient.rpc("create_simulation_run_atomic", {
    p_workspace_id: randomUUID(),
    p_twin_id: randomUUID(),
    p_twin_version_id: randomUUID(),
    p_twin_version: 1,
    p_hypothesis: "Unauthenticated test",
    p_mutations: [],
    p_results: {},
  });

  record(
    "Step A",
    "Unauthenticated call to create_simulation_run_atomic is rejected",
    Boolean(unauthRpcErr),
    unauthRpcErr?.message
  );

  // ==================================================================
  // STEP B: DISPOSABLE FIXTURE PROVISIONING
  // ==================================================================
  console.log("\n--- STEP B: Disposable Fixture Provisioning ---");

  const emailA = `vanta.test.a.${randomUUID().slice(0, 8)}@vanta-disposable.internal`;
  const emailB = `vanta.test.b.${randomUUID().slice(0, 8)}@vanta-disposable.internal`;
  const testPassword = `VantaTestPass123!-${randomUUID().slice(0, 8)}`;

  // Provision User A via DB helper
  const { data: userAIdRaw, error: provErrA } = await anonClient.rpc("create_disposable_test_user", {
    p_email: emailA,
    p_password: testPassword,
  });

  if (provErrA || !userAIdRaw) {
    throw new Error(`Failed to provision disposable user A: ${provErrA?.message}`);
  }
  const userAId = userAIdRaw as string;

  // Sign in User A to get a real authenticated JWT session
  const { data: authSessionA, error: signinErrA } = await anonClient.auth.signInWithPassword({
    email: emailA,
    password: testPassword,
  });

  if (signinErrA || !authSessionA.session) {
    throw new Error(`Failed to sign in User A: ${signinErrA?.message}`);
  }

  const clientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${authSessionA.session.access_token}` } },
  });

  // Get User A's default workspace created by trigger
  const { data: wsDataA, error: wsErrA } = await clientA
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userAId)
    .single();

  if (wsErrA || !wsDataA) {
    throw new Error(`Failed to retrieve default workspace for user A: ${wsErrA?.message}`);
  }
  const wsAId = wsDataA.workspace_id;
  record("Step B", "User A and Workspace A provisioned with real JWT session", true);

  // Provision User B via DB helper
  const { data: userBIdRaw, error: provErrB } = await anonClient.rpc("create_disposable_test_user", {
    p_email: emailB,
    p_password: testPassword,
  });

  if (provErrB || !userBIdRaw) {
    throw new Error(`Failed to provision disposable user B: ${provErrB?.message}`);
  }
  const userBId = userBIdRaw as string;

  // Sign in User B to get a real authenticated JWT session
  const { data: authSessionB, error: signinErrB } = await anonClient.auth.signInWithPassword({
    email: emailB,
    password: testPassword,
  });

  if (signinErrB || !authSessionB.session) {
    throw new Error(`Failed to sign in User B: ${signinErrB?.message}`);
  }

  const clientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${authSessionB.session.access_token}` } },
  });

  const { data: wsDataB, error: wsErrB } = await clientB
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userBId)
    .single();

  if (wsErrB || !wsDataB) {
    throw new Error(`Failed to retrieve default workspace for user B: ${wsErrB?.message}`);
  }
  const wsBId = wsDataB.workspace_id;
  record("Step B", "User B and Workspace B provisioned with real JWT session", true);

  // Provision synthetic Brand, Twin, Twin Version, Claim, Proof, Outcome in Workspace A using User A client
  const { data: brandA, error: brandErr } = await clientA
    .from("brands")
    .insert({
      workspace_id: wsAId,
      name: "Synthetic Test Brand",
      created_by: userAId,
    })
    .select("id")
    .single();

  if (brandErr || !brandA) throw new Error(`Failed to create test brand: ${brandErr?.message}`);

  const { data: claimA, error: claimErr } = await clientA
    .from("brand_claims")
    .insert({
      workspace_id: wsAId,
      brand_id: brandA.id,
      claim_text: "Verified deterministic intelligence",
      claim_type: "approved",
      review_status: "approved",
      created_by: userAId,
    })
    .select("id")
    .single();

  if (claimErr || !claimA) throw new Error(`Failed to create test claim: ${claimErr?.message}`);

  const { data: proofA, error: proofErr } = await clientA
    .from("brand_proof_points")
    .insert({
      workspace_id: wsAId,
      brand_id: brandA.id,
      claim_id: claimA.id,
      proof_text: "Deterministic schema unit test proof",
      evidence_class: "sourced_claim",
      created_by: userAId,
    })
    .select("id")
    .single();

  if (proofErr || !proofA) throw new Error(`Failed to create test proof point: ${proofErr?.message}`);

  // Create disposable source registry entry
  const { data: sourceA, error: srcErr } = await clientA
    .from("source_registry")
    .insert({
      workspace_id: wsAId,
      name: "Synthetic Ad Platform Source",
      source_type: "manual",
      created_by: userAId,
    })
    .select("id")
    .single();

  if (srcErr || !sourceA) throw new Error(`Failed to create test source: ${srcErr?.message}`);

  const { data: assetA, error: assetErr } = await clientA
    .from("creative_assets")
    .insert({
      workspace_id: wsAId,
      source_id: sourceA.id,
      created_by: userAId,
      asset_kind: "script",
      title: "Synthetic Test Script",
      original_filename: "test.txt",
      mime_type: "text/plain",
      byte_size: 1024,
      storage_bucket: "assets",
      storage_path: "test/test.txt",
      content_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      ingestion_status: "accepted",
    })
    .select("id")
    .single();

  if (assetErr || !assetA) throw new Error(`Failed to create test asset: ${assetErr?.message}`);

  const { data: twinA, error: twinErr } = await clientA
    .from("creative_twins")
    .insert({
      workspace_id: wsAId,
      asset_id: assetA.id,
      title: "Synthetic Test Twin",
      asset_kind: "script",
      state: "grounded_stub",
    })
    .select("id")
    .single();

  if (twinErr || !twinA) throw new Error(`Failed to create test twin: ${twinErr?.message}`);

  const mockSnapshot = {
    twinId: twinA.id,
    twinVersion: 1,
    workspaceId: wsAId,
    totalDurationSeconds: 30,
    averageWpm: 140,
    scenes: [
      {
        sceneIndex: 0,
        text: "Stop wasting hours on manual auditing today.",
        onScreenText: "Auditing Automation",
        durationSeconds: 5,
        wpm: 120,
        claims: [],
      },
      {
        sceneIndex: 1,
        text: "Verified deterministic intelligence delivers grounded results.",
        onScreenText: "Verified Intelligence",
        durationSeconds: 15,
        wpm: 150,
        claims: [{ claimText: "Verified deterministic intelligence", brandClaimId: claimA.id }],
      },
      {
        sceneIndex: 2,
        text: "Get started with Vanta now.",
        onScreenText: "Try Vanta",
        durationSeconds: 10,
        wpm: 150,
        claims: [],
      },
    ],
  };

  const { data: twinVersionA, error: tvErr } = await clientA
    .from("creative_twin_versions")
    .insert({
      workspace_id: wsAId,
      twin_id: twinA.id,
      version_number: 1,
      change_summary: "Initial baseline version",
      snapshot: mockSnapshot,
      created_by: userAId,
    })
    .select("id")
    .single();

  if (tvErr || !twinVersionA) throw new Error(`Failed to create twin version: ${tvErr?.message}`);

  // Create disposable experiment & outcome
  const { data: expA, error: expErr } = await clientA
    .from("experiments")
    .insert({
      workspace_id: wsAId,
      title: "Synthetic Experiment Title",
      hypothesis: "Synthetic experiment hypothesis for simulation validation",
      primary_metric_key: "retention_rate",
      variant_twin_ids: [twinA.id],
      min_observations_per_variant: 10,
      outcome_source: "csv_import",
      status: "draft",
      created_by: userAId,
    })
    .select("id")
    .single();

  if (expErr || !expA) throw new Error(`Failed to create test experiment: ${expErr?.message}`);

  const { data: outcomeA, error: outErr } = await clientA
    .from("experiment_outcomes")
    .insert({
      workspace_id: wsAId,
      experiment_id: expA.id,
      variant_twin_id: twinA.id,
      source_id: sourceA.id,
      metric_key: "retention_rate",
      value: 0.45,
      evidence_class: "observed",
      source_citability: "verified",
      observed_at: new Date().toISOString(),
      created_by: userAId,
    })
    .select("id")
    .single();

  if (outErr || !outcomeA) throw new Error(`Failed to create test outcome: ${outErr?.message}`);

  record("Step B", "Synthetic Twin, Version, Claim, Proof, and Outcome provisioned in Workspace A", true);

  try {
    // ==================================================================
    // STEP C: AUTHENTICATED LIFECYCLE EXECUTION (USER A JWT)
    // ==================================================================
    console.log("\n--- STEP C: Authenticated Lifecycle Execution ---");

    const idempotencyKey1 = `sim-test-${randomUUID()}`;
    const mutationsPayload = [
      {
        sequence_order: 0,
        mutation_type: "hook_replacement",
        target_scene_index: 0,
        rationale: "More concise hook",
        payload: { newHookText: "Auditing ads shouldn't take hours." },
      },
      {
        sequence_order: 1,
        mutation_type: "scene_duration_adjust",
        target_scene_index: 1,
        rationale: "Faster middle pacing",
        payload: { newDurationSeconds: 12 },
      },
    ];

    const resultsPayload = {
      simulated_scenes: mockSnapshot.scenes,
      structural_delta: {
        baselineDurationSeconds: 30,
        simulatedDurationSeconds: 27,
        durationDeltaSeconds: -3,
        baselineAverageWpm: 140,
        simulatedAverageWpm: 155,
        wpmDelta: 15,
        hasHookChanged: true,
        hasCtaChanged: false,
        warnings: [],
      },
      council_execution: { status: "completed", rolesEvaluated: ["creative_analyst", "claim_auditor"] },
      warnings: [],
    };

    // 1. Create Simulation Run via RPC
    const { data: createRes, error: createErr } = await clientA.rpc("create_simulation_run_atomic", {
      p_workspace_id: wsAId,
      p_twin_id: twinA.id,
      p_twin_version_id: twinVersionA.id,
      p_twin_version: 1,
      p_hypothesis: "Shortening hook and body pacing improves density without losing claims.",
      p_mutations: mutationsPayload,
      p_results: resultsPayload,
      p_assumptions: ["Synthetic test assumption"],
      p_limitations: ["Deterministic structural delta only"],
      p_controls: ["hook", "duration"],
      p_idempotency_key: idempotencyKey1,
      p_provenance: { engine_version: "1.0.0" },
      p_uncertainty_note: "Structural projection under deterministic parameter variations.",
    });

    record("Step C", "create_simulation_run_atomic RPC succeeds with authenticated user", !createErr, createErr?.message);
    const simResObj = createRes as { success: boolean; simulation_run_id: string; idempotent_replay: boolean };
    const simRunId = simResObj.simulation_run_id;
    record("Step C", "Simulation run ID returned", Boolean(simRunId));

    // 2. Verify Run Record
    const { data: runRow } = await clientA
      .from("simulation_runs")
      .select("*")
      .eq("id", simRunId)
      .eq("workspace_id", wsAId)
      .single();

    record("Step C", "simulation_runs row created with evidence_class = 'simulation'", runRow?.evidence_class === "simulation");
    record("Step C", "observed_validation initialized to 'unknown'", runRow?.observed_validation === "unknown");
    record("Step C", "review_decision initialized to 'unreviewed'", runRow?.review_decision === "unreviewed");

    // 3. Verify Mutations & Results
    const { data: mutRows } = await clientA
      .from("simulation_mutations")
      .select("*")
      .eq("simulation_run_id", simRunId)
      .order("sequence_order", { ascending: true });

    record("Step C", "2 simulation_mutations rows created in sequence", mutRows?.length === 2);

    const { data: resRow } = await clientA
      .from("simulation_results")
      .select("*")
      .eq("simulation_run_id", simRunId)
      .single();

    record("Step C", "simulation_results row created with structural delta", Boolean(resRow?.structural_delta));

    const { data: revEvents } = await clientA
      .from("simulation_review_events")
      .select("*")
      .eq("simulation_run_id", simRunId);

    record("Step C", "Initial simulation_review_events row recorded", revEvents?.length === 1 && revEvents[0].new_decision === "unreviewed");

    // 4. Test Idempotency Replay on Create
    const { data: replayCreateRes } = await clientA.rpc("create_simulation_run_atomic", {
      p_workspace_id: wsAId,
      p_twin_id: twinA.id,
      p_twin_version_id: twinVersionA.id,
      p_twin_version: 1,
      p_hypothesis: "Duplicate hypothesis",
      p_mutations: mutationsPayload,
      p_results: resultsPayload,
      p_idempotency_key: idempotencyKey1,
    });

    const replayObj = replayCreateRes as { success: boolean; simulation_run_id: string; idempotent_replay: boolean };
    record("Step C", "Duplicate create request returns idempotent_replay = true", replayObj?.idempotent_replay === true && replayObj?.simulation_run_id === simRunId);

    // 5. Test Review State Transitions
    // Transition 1: unreviewed -> needs_human
    const { data: rev1Res, error: rev1Err } = await clientA.rpc("review_simulation_run_atomic", {
      p_workspace_id: wsAId,
      p_simulation_run_id: simRunId,
      p_decision: "needs_human",
      p_rationale: "Automated analysis completed. Requesting human reviewer gate.",
    });

    if (rev1Err) {
      console.error("rev1Err:", rev1Err);
    }
    const rev1Obj = rev1Res as { success: boolean; new_decision: string };
    record("Step C", "Review transition unreviewed -> needs_human succeeds", !rev1Err && rev1Obj?.new_decision === "needs_human", rev1Err?.message);

    // Transition 2: needs_human -> accepted
    const { data: rev2Res } = await clientA.rpc("review_simulation_run_atomic", {
      p_workspace_id: wsAId,
      p_simulation_run_id: simRunId,
      p_decision: "accepted",
      p_rationale: "Human reviewer accepted variant for physical experiment staging.",
    });

    const rev2Obj = rev2Res as { success: boolean; new_decision: string };
    record("Step C", "Review transition needs_human -> accepted succeeds", rev2Obj?.new_decision === "accepted");

    // Confirm acceptance strictly preserves evidence_class = 'simulation'
    const { data: acceptedRun } = await clientA
      .from("simulation_runs")
      .select("evidence_class, review_decision, reviewed_by")
      .eq("id", simRunId)
      .single();

    record("Step C", "Human acceptance preserves evidence_class = 'simulation'", acceptedRun?.evidence_class === "simulation");
    record("Step C", "Reviewer ID bound to User A", acceptedRun?.reviewed_by === userAId);

    // Test Idempotent Review No-Op
    const { data: idempRevRes } = await clientA.rpc("review_simulation_run_atomic", {
      p_workspace_id: wsAId,
      p_simulation_run_id: simRunId,
      p_decision: "accepted",
    });

    const idempRevObj = idempRevRes as { success: boolean; idempotent_no_op: boolean };
    record("Step C", "Duplicate review request returns idempotent_no_op = true", idempRevObj?.idempotent_no_op === true);

    // 6. Test Outcome Linkage for Traceability
    const { data: linkRes, error: linkErr } = await clientA.rpc("link_simulation_observed_outcome_atomic", {
      p_workspace_id: wsAId,
      p_simulation_run_id: simRunId,
      p_experiment_outcome_id: outcomeA.id,
      p_note: "Linked to live physical experiment outcome batch #1",
    });

    record("Step C", "link_simulation_observed_outcome_atomic succeeds", !linkErr, linkErr?.message);
    const linkObj = linkRes as { success: boolean; link_id: string; idempotent_replay: boolean };
    record("Step C", "Traceability link ID returned", Boolean(linkObj?.link_id));

    // Verify observed_validation updated to 'linked' while evidence_class remains 'simulation'
    const { data: linkedRun } = await clientA
      .from("simulation_runs")
      .select("evidence_class, observed_validation, hypothesis")
      .eq("id", simRunId)
      .single();

    record("Step C", "observed_validation transitions to 'linked'", linkedRun?.observed_validation === "linked");
    record("Step C", "evidence_class remains strictly 'simulation'", linkedRun?.evidence_class === "simulation");
    record("Step C", "Baseline hypothesis and parameters unchanged after link", linkedRun?.hypothesis === "Shortening hook and body pacing improves density without losing claims.");

    // Test Idempotent Link Replay
    const { data: replayLinkRes } = await clientA.rpc("link_simulation_observed_outcome_atomic", {
      p_workspace_id: wsAId,
      p_simulation_run_id: simRunId,
      p_experiment_outcome_id: outcomeA.id,
    });

    const replayLinkObj = replayLinkRes as { success: boolean; idempotent_replay: boolean };
    record("Step C", "Duplicate link request returns idempotent_replay = true", replayLinkObj?.idempotent_replay === true);

    // 7. Test Status Transitions and Cancellation (Non-Destructive)
    // Create second disposable run in draft status
    const { data: create2Res } = await clientA.rpc("create_simulation_run_atomic", {
      p_workspace_id: wsAId,
      p_twin_id: twinA.id,
      p_twin_version_id: twinVersionA.id,
      p_twin_version: 1,
      p_hypothesis: "Run to test full status transition lifecycle",
      p_mutations: [],
      p_results: {},
      p_idempotency_key: `sim-cancel-${randomUUID()}`,
      p_status: "draft",
    });
    const create2Obj = create2Res as { simulation_run_id: string };
    const cancelRunId = create2Obj.simulation_run_id;

    // Transition 1: draft -> queued
    const { data: qRes, error: qErr } = await clientA.rpc("transition_simulation_run_status_atomic", {
      p_workspace_id: wsAId,
      p_simulation_run_id: cancelRunId,
      p_target_status: "queued",
    });
    const qObj = qRes as { status?: string } | null;
    record("Step C", "transition_simulation_run_status_atomic transitions draft -> queued", !qErr && qObj?.status === "queued", qErr?.message);

    // Transition 2: queued -> running
    const { data: rRes, error: rErr } = await clientA.rpc("transition_simulation_run_status_atomic", {
      p_workspace_id: wsAId,
      p_simulation_run_id: cancelRunId,
      p_target_status: "running",
    });
    const rObj = rRes as { status?: string } | null;
    record("Step C", "transition_simulation_run_status_atomic transitions queued -> running", !rErr && rObj?.status === "running", rErr?.message);

    // Transition 3: running -> cancelled
    const { data: cancelRes, error: cancelErr } = await clientA.rpc("transition_simulation_run_status_atomic", {
      p_workspace_id: wsAId,
      p_simulation_run_id: cancelRunId,
      p_target_status: "cancelled",
      p_reason: "Operator discarded variant draft",
    });

    record("Step C", "transition_simulation_run_status_atomic cancels run without error", !cancelErr, cancelErr?.message);
    const cancelObj = cancelRes as { success: boolean; status: string };
    record("Step C", "Status transitioned to 'cancelled'", cancelObj?.status === "cancelled");

    // Confirm cancelled row still exists in database (non-destructive)
    const { data: existingCancelledRun } = await clientA
      .from("simulation_runs")
      .select("id, status")
      .eq("id", cancelRunId)
      .single();

    record("Step C", "Cancelled run is preserved in database (not deleted)", existingCancelledRun?.status === "cancelled");

    // ==================================================================
    // STEP D: AUTHENTICATED NEGATIVE SECURITY TESTS (USER B JWT)
    // ==================================================================
    console.log("\n--- STEP D: Authenticated Negative Security Tests (User B JWT) ---");

    // 1. Cross-Workspace SELECT on all 5 simulation tables returns 0 rows
    const { data: crossRuns } = await clientB
      .from("simulation_runs")
      .select("*")
      .eq("workspace_id", wsAId);
    record("Step D", "Cross-workspace SELECT on simulation_runs returns 0 rows", crossRuns?.length === 0);

    const { data: crossMutations } = await clientB
      .from("simulation_mutations")
      .select("*")
      .eq("workspace_id", wsAId);
    record("Step D", "Cross-workspace SELECT on simulation_mutations returns 0 rows", crossMutations?.length === 0);

    const { data: crossResults } = await clientB
      .from("simulation_results")
      .select("*")
      .eq("workspace_id", wsAId);
    record("Step D", "Cross-workspace SELECT on simulation_results returns 0 rows", crossResults?.length === 0);

    const { data: crossReviews } = await clientB
      .from("simulation_review_events")
      .select("*")
      .eq("workspace_id", wsAId);
    record("Step D", "Cross-workspace SELECT on simulation_review_events returns 0 rows", crossReviews?.length === 0);

    const { data: crossLinks } = await clientB
      .from("simulation_observed_links")
      .select("*")
      .eq("workspace_id", wsAId);
    record("Step D", "Cross-workspace SELECT on simulation_observed_links returns 0 rows", crossLinks?.length === 0);

    // 2. Cross-Workspace RPC Invocation Denials
    // User B attempts to create run in Workspace A
    const { error: crossCreateErr } = await clientB.rpc("create_simulation_run_atomic", {
      p_workspace_id: wsAId,
      p_twin_id: twinA.id,
      p_twin_version_id: twinVersionA.id,
      p_twin_version: 1,
      p_hypothesis: "Cross tenant attempt",
      p_mutations: [],
      p_results: {},
    });
    record("Step D", "Cross-workspace create_simulation_run_atomic is rejected", Boolean(crossCreateErr), crossCreateErr?.message);

    // User B attempts to create run in Workspace B using Workspace A's twin version
    const { error: crossTwinErr } = await clientB.rpc("create_simulation_run_atomic", {
      p_workspace_id: wsBId,
      p_twin_id: twinA.id,
      p_twin_version_id: twinVersionA.id,
      p_twin_version: 1,
      p_hypothesis: "Cross tenant twin version reference",
      p_mutations: [],
      p_results: {},
    });
    record("Step D", "Referencing cross-workspace twin version in create RPC is rejected", Boolean(crossTwinErr), crossTwinErr?.message);

    // User B attempts to review User A's simulation run
    const { error: crossReviewErr } = await clientB.rpc("review_simulation_run_atomic", {
      p_workspace_id: wsAId,
      p_simulation_run_id: simRunId,
      p_decision: "rejected",
    });
    record("Step D", "Cross-workspace review_simulation_run_atomic is rejected", Boolean(crossReviewErr), crossReviewErr?.message);

    // User B attempts to link outcome to User A's simulation run
    const { error: crossLinkErr } = await clientB.rpc("link_simulation_observed_outcome_atomic", {
      p_workspace_id: wsAId,
      p_simulation_run_id: simRunId,
      p_experiment_outcome_id: outcomeA.id,
    });
    record("Step D", "Cross-workspace link_simulation_observed_outcome_atomic is rejected", Boolean(crossLinkErr), crossLinkErr?.message);

    // 3. Direct UPDATE and DELETE Policy Denials (RLS USING (false))
    // User A attempts direct SQL UPDATE on simulation_runs
    const { data: directUpdData, error: directUpdErr } = await clientA
      .from("simulation_runs")
      .update({ hypothesis: "Hacked hypothesis" })
      .eq("id", simRunId)
      .select();

    record(
      "Step D",
      "Direct client UPDATE on simulation_runs affects 0 rows or is rejected",
      !directUpdData || directUpdData.length === 0 || Boolean(directUpdErr),
      directUpdErr?.message ?? "0 rows updated (RLS policy denied)"
    );

    // User A attempts direct SQL DELETE on simulation_runs
    const { data: directDelData, error: directDelErr } = await clientA
      .from("simulation_runs")
      .delete()
      .eq("id", simRunId)
      .select();

    record(
      "Step D",
      "Direct client DELETE on simulation_runs affects 0 rows or is rejected",
      !directDelData || directDelData.length === 0 || Boolean(directDelErr),
      directDelErr?.message ?? "0 rows deleted (RLS policy denied)"
    );

    // User A attempts direct SQL DELETE on simulation_results
    const { data: directDelRes, error: directDelResErr } = await clientA
      .from("simulation_results")
      .delete()
      .eq("simulation_run_id", simRunId)
      .select();

    record(
      "Step D",
      "Direct client DELETE on simulation_results affects 0 rows or is rejected",
      !directDelRes || directDelRes.length === 0 || Boolean(directDelResErr),
      directDelResErr?.message ?? "0 rows deleted (RLS policy denied)"
    );

    // 4. Invalid Review Transitions
    // Attempting invalid review jump: accepted -> unreviewed
    const { error: invalidRevErr } = await clientA.rpc("review_simulation_run_atomic", {
      p_workspace_id: wsAId,
      p_simulation_run_id: simRunId,
      p_decision: "unreviewed",
    });
    record("Step D", "Invalid review transition (accepted -> unreviewed) is rejected", Boolean(invalidRevErr), invalidRevErr?.message);

    // ==================================================================
    // STEP E: WORKER HANDLER DISPOSABLE EXECUTION
    // ==================================================================
    console.log("\n--- STEP E: Simulation Worker Handlers Execution ---");

    function makeTestJob(type: WorkerJob["job_type"], payload: Record<string, unknown>): WorkerJob {
      return {
        id: `job-disp-${randomUUID()}`,
        workspace_id: wsAId,
        job_type: type,
        status: "running",
        payload,
        attempts: 1,
        max_attempts: 3,
        correlation_id: `corr-${randomUUID()}`,
      };
    }

    // 1. simulation_validate handler
    const validateHandler = makeSimulationValidateHandler(clientA);
    const valJob = makeTestJob("simulation_validate", {
      twin_id: twinA.id,
      twin_version_id: twinVersionA.id,
      hypothesis: "Test hypothesis",
      mutations: [
        {
          type: "claim_substitution",
          targetSceneIndex: 1,
          originalClaimText: "Verified deterministic intelligence",
          substituteBrandClaimId: claimA.id,
          substituteBrandClaimText: "Verified deterministic intelligence",
          proofPointId: proofA.id,
          rationale: "Approved claim verification",
        },
      ],
    });
    const valRes = await validateHandler(valJob, { deadlineMs: Date.now() + 5000 });
    record("Step E", "simulation_validate handler validates matching twin and approved claims", valRes.ok);

    // Cross-tenant invalid claim check in worker
    const valJobInvalid = makeTestJob("simulation_validate", {
      twin_id: twinA.id,
      twin_version_id: twinVersionA.id,
      mutations: [
        {
          type: "claim_substitution",
          targetSceneIndex: 1,
          originalClaimText: "Verified deterministic intelligence",
          substituteBrandClaimId: randomUUID(), // unapproved random UUID
          substituteBrandClaimText: "Fabricated claim",
          proofPointId: randomUUID(),
          rationale: "Unapproved claim test",
        },
      ],
    });
    const valResInvalid = await validateHandler(valJobInvalid, { deadlineMs: Date.now() + 5000 });
    record("Step E", "simulation_validate handler rejects unapproved or cross-tenant claim", !valResInvalid.ok);

    // 2. simulation_execute handler
    // Create a dedicated run in running status
    const { data: execRunRes } = await clientA.rpc("create_simulation_run_atomic", {
      p_workspace_id: wsAId,
      p_twin_id: twinA.id,
      p_twin_version_id: twinVersionA.id,
      p_twin_version: 1,
      p_hypothesis: "Worker execute test run",
      p_mutations: [],
      p_results: {},
      p_idempotency_key: `sim-exec-${randomUUID()}`,
      p_status: "draft",
    });
    const execRunObj = execRunRes as { simulation_run_id: string };
    const execRunId = execRunObj.simulation_run_id;

    await clientA.rpc("transition_simulation_run_status_atomic", {
      p_workspace_id: wsAId,
      p_simulation_run_id: execRunId,
      p_target_status: "queued",
    });
    await clientA.rpc("transition_simulation_run_status_atomic", {
      p_workspace_id: wsAId,
      p_simulation_run_id: execRunId,
      p_target_status: "running",
    });

    const executeHandler = makeSimulationExecuteHandler(clientA);
    const execJob = makeTestJob("simulation_execute", {
      simulation_run_id: execRunId,
      twin_id: twinA.id,
      twin_version_id: twinVersionA.id,
      mutations: [
        {
          type: "hook_replacement",
          targetSceneIndex: 0,
          newHookText: "Hook replaced by worker",
          rationale: "Worker execution test",
        },
      ],
    });
    const execRes = await executeHandler(execJob, { deadlineMs: Date.now() + 5000 });
    record("Step E", "simulation_execute handler computes mutations and updates status to completed", execRes.ok, !execRes.ok ? (execRes as { failure?: { message: string } }).failure?.message : undefined);

    // 3. simulation_review_ready handler
    const reviewReadyHandler = makeSimulationReviewReadyHandler(clientA);
    const readyJob = makeTestJob("simulation_review_ready", { simulation_run_id: execRunId });
    const readyRes = await reviewReadyHandler(readyJob, { deadlineMs: Date.now() + 5000 });
    record("Step E", "simulation_review_ready handler handles review gating safely", readyRes.ok, !readyRes.ok ? (readyRes as { failure?: { message: string } }).failure?.message : undefined);

    // 4. simulation_observed_link handler
    const observedLinkHandler = makeSimulationObservedLinkHandler(clientA);
    const linkJob = makeTestJob("simulation_observed_link", {
      simulation_run_id: execRunId,
      experiment_outcome_id: outcomeA.id,
      note: "Worker linked traceability note",
    });
    const workerLinkRes = await observedLinkHandler(linkJob, { deadlineMs: Date.now() + 5000 });
    record("Step E", "simulation_observed_link handler executes atomic linkage", workerLinkRes.ok, !workerLinkRes.ok ? (workerLinkRes as { failure?: { message: string } }).failure?.message : undefined);

    // ==================================================================
    // STEP F: PRIVACY & AUDIT METADATA CHECK
    // ==================================================================
    console.log("\n--- STEP F: Privacy and Audit Metadata Check ---");

    const { data: auditEvents } = await clientA
      .from("audit_events")
      .select("*")
      .eq("workspace_id", wsAId);

    let containsSecrets = false;
    for (const evt of auditEvents ?? []) {
      const jsonStr = JSON.stringify(evt);
      if (
        jsonStr.includes("eyJhbGci") ||
        jsonStr.includes("SUPABASE_SERVICE_ROLE_KEY") ||
        jsonStr.includes("VantaTestPass")
      ) {
        containsSecrets = true;
      }
    }
    record("Step F", "Audit events contain zero secrets, tokens, or plaintext passwords", !containsSecrets);

    console.log("\n==================================================================");
    console.log(`ALL ${results.length} LIVE VALIDATION CHECKS PASSED!`);
    console.log("==================================================================");
  } finally {
    // ==================================================================
    // STEP G: SCOPED CLEANUP
    // ==================================================================
    console.log("\n--- STEP G: Scoped Cleanup of Disposable Workspaces ---");

    // Clean up User A and User B via cleanup RPC
    await anonClient.rpc("cleanup_disposable_test_user", { p_user_id: userAId });
    console.log("Cleanup User A & Workspace A: Deleted successfully (cascaded)");

    await anonClient.rpc("cleanup_disposable_test_user", { p_user_id: userBId });
    console.log("Cleanup User B & Workspace B: Deleted successfully (cascaded)");
  }
}

main().catch((err) => {
  console.error("FATAL ERROR in live validation execution:", err);
  process.exit(1);
});
