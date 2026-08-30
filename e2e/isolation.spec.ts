/**
 * QA-1: two-user, real-JWT tenant isolation (Upgrade G, roadmap row 7).
 *
 * Runs only when an operator supplies two real accounts in a test project:
 *   E2E_SUPABASE_URL, E2E_SUPABASE_ANON_KEY,
 *   E2E_USER_A_EMAIL, E2E_USER_A_PASSWORD, E2E_USER_B_EMAIL, E2E_USER_B_PASSWORD
 * Without them every test is reported as SKIPPED with the reason, never as passed.
 *
 * For each tenant table: user A, holding user B's workspace id, must not be
 * able to read, insert, update, or delete anything there. Reads return zero
 * rows; writes return a policy error or affect zero rows.
 */

import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const env = process.env;
const configured = Boolean(
  env.E2E_SUPABASE_URL && env.E2E_SUPABASE_ANON_KEY && env.E2E_USER_A_EMAIL && env.E2E_USER_A_PASSWORD && env.E2E_USER_B_EMAIL && env.E2E_USER_B_PASSWORD
);

const TENANT_TABLES = [
  "workspaces",
  "workspace_members",
  "audit_events",
  "brands",
  "brand_claims",
  "brand_audiences",
  "brand_proof_points",
  "brand_competitors",
  "brand_tone_guidelines",
  "brand_compliance_boundaries",
  "brand_codex_versions",
  "source_registry",
  "evidence_items",
  "metric_definitions",
  "creative_assets",
  "ingestion_runs",
  "creative_twins",
  "creative_scenes",
  "creative_claims",
  "creative_twin_versions",
  "model_task_runs",
  "jobs",
  "derived_artifacts",
  "retrieval_embeddings",
  "workspace_quotas",
  "experiments",
  "experiment_outcomes",
  "post_observations",
  "post_variant_attributions",
  "import_batches",
  "connector_accounts",
  "conversation_observations",
  "conversation_interpretations",
  "conversation_attributions",
  "conversation_review_events",
  "simulation_runs",
  "simulation_mutations",
  "simulation_results",
  "simulation_review_events",
  "simulation_observed_links",
] as const;

async function signIn(email: string, password: string): Promise<{ client: SupabaseClient; userId: string; workspaceId: string }> {
  const client = createClient(env.E2E_SUPABASE_URL!, env.E2E_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw new Error(`sign-in failed for ${email}: ${error?.message}`);
  const { data: ws } = await client.from("workspace_members").select("workspace_id").eq("user_id", data.user.id).limit(1).single();
  if (!ws) throw new Error(`no workspace for ${email}`);
  return { client, userId: data.user.id, workspaceId: ws.workspace_id as string };
}

test.describe("QA-1 tenant isolation", () => {
  test.skip(!configured, "E2E_* environment not configured; see docs/supabase-deferred-validation.md D-10");

  let a: Awaited<ReturnType<typeof signIn>>;
  let b: Awaited<ReturnType<typeof signIn>>;

  test.beforeAll(async () => {
    a = await signIn(env.E2E_USER_A_EMAIL!, env.E2E_USER_A_PASSWORD!);
    b = await signIn(env.E2E_USER_B_EMAIL!, env.E2E_USER_B_PASSWORD!);
    expect(a.workspaceId).not.toBe(b.workspaceId);
  });

  for (const table of TENANT_TABLES) {
    test(`A cannot read ${table} rows of B's workspace`, async () => {
      const col = table === "workspaces" ? "id" : "workspace_id";
      const { data, error } = await a.client.from(table).select("*").eq(col, b.workspaceId);
      // Either a policy/permission error, or zero rows. Never data.
      if (error) expect(error.message).toMatch(/permission|policy|denied|not exist/i);
      else expect(data).toEqual([]);
    });
  }

  test("A cannot insert into B's workspace (brand_claims)", async () => {
    const { data: brand } = await b.client.from("brands").select("id").eq("workspace_id", b.workspaceId).maybeSingle();
    test.skip(!brand, "B has no brand row; create one to run this check");
    const { error } = await a.client.from("brand_claims").insert({ brand_id: brand!.id, workspace_id: b.workspaceId, created_by: a.userId, claim_text: "x", claim_type: "approved" } as never);
    expect(error).not.toBeNull();
  });

  test("A cannot update or delete B's workspace row", async () => {
    const upd = await a.client.from("workspaces").update({ name: "hacked" }).eq("id", b.workspaceId).select("id");
    expect(upd.data ?? []).toEqual([]);
    const del = await a.client.from("workspaces").delete().eq("id", b.workspaceId).select("id");
    expect(del.data ?? []).toEqual([]);
    const { data: still } = await b.client.from("workspaces").select("name").eq("id", b.workspaceId).single();
    expect(still?.name).not.toBe("hacked");
  });

  test("A cannot call worker-only RPCs", async () => {
    const { error } = await a.client.rpc("claim_next_job", { p_worker_id: "e2e", p_job_types: ["model_task"] });
    expect(error).not.toBeNull();
  });

  test("A cannot read connector token columns even in own workspace", async () => {
    const { error } = await a.client.from("connector_accounts").select("access_token_ciphertext").eq("workspace_id", a.workspaceId);
    expect(error).not.toBeNull();
  });

  test("immutable snapshots reject updates for their own members", async () => {
    const { data: v } = await b.client.from("creative_twin_versions").select("id").eq("workspace_id", b.workspaceId).limit(1).maybeSingle();
    test.skip(!v, "B has no twin version; ingest an asset to run this check");
    const { error, data } = await b.client.from("creative_twin_versions").update({ change_summary: "x" }).eq("id", v!.id).select("id");
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
});
