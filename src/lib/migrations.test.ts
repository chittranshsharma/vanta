/**
 * Static migration contract tests.
 *
 * These tests parse the committed SQL in supabase/migrations and assert the
 * tenant-safety invariants the product depends on. They replace the former
 * rls.test.ts, whose eight cases were `expect(true).toBe(true)`.
 *
 * What they prove: the repository's schema declares the invariants.
 * What they do not prove: that the live project matches the repository.
 * Live verification is tracked in docs/supabase-deferred-validation.md.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, "..", "..", "supabase", "migrations");

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const sqlByFile = Object.fromEntries(
  files.map((f) => [f, readFileSync(join(MIGRATIONS_DIR, f), "utf8")])
) as Record<string, string>;

const allSql = files.map((f) => sqlByFile[f]).join("\n");

/** Strip SQL line comments so commented-out statements do not count. */
function stripComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
}

const code = stripComments(allSql);

function createdTables(sql: string): string[] {
  const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_]+)/gi;
  return [...sql.matchAll(re)].map((m) => m[1].toLowerCase());
}

function rlsEnabledTables(sql: string): Set<string> {
  const re = /alter\s+table\s+public\.([a-z_]+)\s+enable\s+row\s+level\s+security/gi;
  return new Set([...sql.matchAll(re)].map((m) => m[1].toLowerCase()));
}

type Policy = { name: string; cmd: string; body: string };

/** Policies by table. A later CREATE POLICY with the same name replaces the earlier one (DROP + CREATE pattern). */
function policiesByTable(sql: string): Map<string, Policy[]> {
  const byKey = new Map<string, Policy & { table: string }>();
  const re =
    /create\s+policy\s+"([^"]+)"\s+on\s+public\.([a-z_]+)\s+for\s+(select|insert|update|delete)([\s\S]*?);/gi;
  for (const m of sql.matchAll(re)) {
    const table = m[2].toLowerCase();
    byKey.set(`${table}::${m[1]}`, { table, name: m[1], cmd: m[3].toLowerCase(), body: m[4] });
  }
  const out = new Map<string, Policy[]>();
  for (const p of byKey.values()) {
    const list = out.get(p.table) ?? [];
    list.push({ name: p.name, cmd: p.cmd, body: p.body });
    out.set(p.table, list);
  }
  return out;
}

/** Extract every CREATE FUNCTION block, returning name and full text. */
function functionBlocks(sql: string): { name: string; text: string }[] {
  const re =
    /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z_]+)\s*\([\s\S]*?\$\$[\s\S]*?\$\$\s*;/gi;
  return [...sql.matchAll(re)].map((m) => ({ name: m[1].toLowerCase(), text: m[0] }));
}

describe("migration files", () => {
  it("includes the six applied migrations and the pending Brand Brain RLS migration", () => {
    expect(files).toEqual([
      "20260822000001_auth_workspaces.sql",
      "20260822000002_brand_brain.sql",
      "20260822000003_evidence_layer.sql",
      "20260822000004_creative_intake.sql",
      "20260822000005_creative_twin_expansion.sql",
      "20260822000006_secure_twin_correction_rpcs.sql",
      "20260822000007_brand_brain_rls.sql",
      "20260822000008_bind_created_by.sql",
      "20260822000009_composite_tenant_fks.sql",
      "20260822000010_model_task_runs.sql",
      "20260822000011_jobs.sql",
      "20260822000012_derived_artifacts.sql",
      "20260822000013_embeddings.sql",
      "20260822000014_connector_accounts.sql",
      "20260822000015_workspace_quotas.sql",
      "20260822000016_experiments.sql",
      "20260822000017_post_observations.sql",
      "20260822000018_backend_primitives.sql",
      "20260822000019_conversation_intelligence.sql",
      "20260822000020_expand_job_types.sql",
    ]);
  });

  it.each([
    "20260822000007_brand_brain_rls.sql",
    "20260822000008_bind_created_by.sql",
    "20260822000009_composite_tenant_fks.sql",
    "20260822000010_model_task_runs.sql",
    "20260822000011_jobs.sql",
    "20260822000012_derived_artifacts.sql",
    "20260822000013_embeddings.sql",
    "20260822000014_connector_accounts.sql",
    "20260822000015_workspace_quotas.sql",
    "20260822000016_experiments.sql",
    "20260822000017_post_observations.sql",
  ])("marks unapplied migration %s as PENDING LIVE APPLY in a header comment", (file) => {
    expect(sqlByFile[file]).toMatch(/PENDING LIVE APPLY/);
  });
});

describe("row level security coverage", () => {
  const tables = [...new Set(createdTables(code))];
  const enabled = rlsEnabledTables(code);
  const policies = policiesByTable(code);

  it("creates the 36 tenant tables the product documents", () => {
    expect(tables).toHaveLength(36);
  });

  it.each(tables)("enables RLS on public.%s", (table) => {
    expect(enabled.has(table)).toBe(true);
  });

  it.each(tables)("declares a SELECT policy on public.%s", (table) => {
    const cmds = (policies.get(table) ?? []).map((p) => p.cmd);
    expect(cmds).toContain("select");
  });

  it.each(tables)("scopes every policy on public.%s by tenant or self", (table) => {
    for (const p of policies.get(table) ?? []) {
      const scoped =
        /is_workspace_member|is_workspace_admin_or_owner|auth\.uid\(\)|(using|with\s+check)\s*\(\s*false\s*\)/i.test(
          p.body
        );
      expect(scoped, `${table} ${p.cmd} policy lacks tenant scope: ${p.body.trim()}`).toBe(true);
    }
  });

  it("keeps audit_events append-only (no UPDATE or DELETE policy)", () => {
    const cmds = (policies.get("audit_events") ?? []).map((p) => p.cmd);
    expect(cmds).not.toContain("update");
    expect(cmds).not.toContain("delete");
  });

  it.each([
    "creative_twin_versions",
    "brand_codex_versions",
    "model_task_runs",
    "experiment_outcomes",
    "conversation_review_events",
  ])(
    "denies UPDATE and DELETE on snapshot table public.%s at policy level",
    (table) => {
      const denies = (policies.get(table) ?? []).filter(
        (p) => (p.cmd === "update" || p.cmd === "delete") && /using\s*\(\s*false\s*\)/i.test(p.body)
      );
      expect(denies.map((d) => d.cmd).sort()).toEqual(["delete", "update"]);
    }
  );

  const actorBoundTables: [string, string][] = [
    ["workspaces", "created_by"],
    ["brands", "created_by"],
    ["brand_codex_versions", "created_by"],
    ["brand_audiences", "created_by"],
    ["brand_claims", "created_by"],
    ["brand_proof_points", "created_by"],
    ["brand_competitors", "created_by"],
    ["brand_tone_guidelines", "created_by"],
    ["brand_compliance_boundaries", "created_by"],
    ["source_registry", "created_by"],
    ["evidence_items", "created_by"],
    ["metric_definitions", "created_by"],
    ["creative_assets", "created_by"],
    ["ingestion_runs", "started_by"],
    ["creative_twin_versions", "created_by"],
    ["model_task_runs", "created_by"],
    ["jobs", "created_by"],
    ["derived_artifacts", "created_by"],
    ["experiments", "created_by"],
    ["experiment_outcomes", "created_by"],
    ["post_observations", "created_by"],
    ["import_batches", "created_by"],
    ["post_variant_attributions", "created_by"],
    ["conversation_observations", "created_by"],
    ["conversation_interpretations", "created_by"],
    ["conversation_attributions", "created_by"],
    ["conversation_review_events", "created_by"],
  ];

  it.each(actorBoundTables)(
    "final INSERT policy on public.%s binds %s to auth.uid() (migration 008)",
    (table, column) => {
      const inserts = (policies.get(table) ?? []).filter((p) => p.cmd === "insert");
      expect(inserts.length).toBeGreaterThan(0);
      for (const p of inserts) {
        expect(
          new RegExp(`${column}\\s*=\\s*auth\\.uid\\(\\)`, "i").test(p.body),
          `${table} policy "${p.name}" does not bind ${column}`
        ).toBe(true);
      }
    }
  );

  it("protects creative_twin_versions with a BEFORE UPDATE OR DELETE trigger", () => {
    expect(code).toMatch(
      /create\s+trigger\s+trg_block_twin_version_mutation\s+before\s+update\s+or\s+delete\s+on\s+public\.creative_twin_versions/i
    );
  });

  it("protects conversation_observations with a core immutability trigger", () => {
    expect(code).toMatch(
      /create\s+trigger\s+trg_block_conversation_observation_core_mutation\s+before\s+update\s+on\s+public\.conversation_observations/i
    );
  });
});

describe("conversation intelligence foundation (migration 019)", () => {
  const sql = sqlByFile["20260822000019_conversation_intelligence.sql"];

  it("creates conversation_observations with evidence_class = observed and review state checks", () => {
    expect(sql).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.conversation_observations/i);
    expect(sql).toMatch(/evidence_class\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'observed'\s+CHECK\s*\(\s*evidence_class\s*=\s*'observed'\s*\)/i);
    expect(sql).toMatch(/review_state\s+IN\s*\(\s*'unreviewed',\s*'needs_human',\s*'accepted',\s*'rejected',\s*'corrected'\s*\)/i);
    expect(sql).toMatch(/UNIQUE\s*\(\s*workspace_id,\s*idempotency_key\s*\)/i);
  });

  it("creates conversation_interpretations with evidence_class = inference and mandatory uncertainty note", () => {
    expect(sql).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.conversation_interpretations/i);
    expect(sql).toMatch(/evidence_class\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'inference'\s+CHECK\s*\(\s*evidence_class\s*=\s*'inference'\s*\)/i);
    expect(sql).toMatch(/uncertainty_note\s+TEXT\s+NOT\s+NULL/i);
  });

  it("creates conversation_attributions with composite FKs", () => {
    expect(sql).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.conversation_attributions/i);
    expect(sql).toMatch(/REFERENCES\s+public\.conversation_observations\(id,\s*workspace_id\)\s*\n?\s*ON\s+DELETE\s+CASCADE/i);
  });

  it("creates append-only conversation_review_events (denies update and delete)", () => {
    expect(sql).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.conversation_review_events/i);
    expect(sql).toMatch(/conversation_review_events_no_update[\s\S]*?USING\s*\(\s*false\s*\)/i);
    expect(sql).toMatch(/conversation_review_events_no_delete[\s\S]*?USING\s*\(\s*false\s*\)/i);
  });

  it("provides hardened review RPCs with transactional audit logging", () => {
    expect(sql).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.review_conversation_observation_atomic/i);
    expect(sql).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.review_conversation_interpretation_atomic/i);
    expect(sql).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.review_conversation_observation_atomic/i);
    expect(sql).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.review_conversation_observation_atomic[\s\S]*?TO\s+authenticated/i);
  });
});

describe("backend primitives (migration 018)", () => {
  const sql = sqlByFile["20260822000018_backend_primitives.sql"];

  it("adds stable workspace timezone column", () => {
    expect(sql).toMatch(/ALTER\s+TABLE\s+public\.workspaces\s+ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+timezone\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'UTC'/i);
  });

  it("creates import_batches with tenant isolation and status checks", () => {
    expect(sql).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.import_batches/i);
    expect(sql).toMatch(/batch_kind\s+IN\s*\(\s*'post_observations',\s*'experiment_outcomes',\s*'conversation_observations'\s*\)/i);
    expect(sql).toMatch(/status\s+IN\s*\(\s*'pending',\s*'completed',\s*'partial',\s*'failed'\s*\)/i);
    expect(sql).toMatch(/REFERENCES\s+public\.source_registry\(id,\s*workspace_id\)\s*\n?\s*ON\s+DELETE\s+SET\s+NULL/i);
  });

  it("creates post_variant_attributions with uniqueness preventing duplicate post mappings", () => {
    expect(sql).toMatch(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+public\.post_variant_attributions/i);
    expect(sql).toMatch(/UNIQUE\s*\(\s*workspace_id,\s*provider,\s*external_post_id\s*\)/i);
    expect(sql).toMatch(/REFERENCES\s+public\.creative_assets\(id,\s*workspace_id\)\s*\n?\s*ON\s+DELETE\s+CASCADE/i);
    expect(sql).toMatch(/REFERENCES\s+public\.creative_twins\(id,\s*workspace_id\)\s*\n?\s*ON\s+DELETE\s+CASCADE/i);
  });

  it("provides atomic batch deletion RPC with transactional audit write and admin guard", () => {
    expect(sql).toMatch(/CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.delete_post_observation_batch/i);
    expect(sql).toMatch(/is_workspace_admin_or_owner\(p_workspace_id\)/i);
    expect(sql).toMatch(/INSERT\s+INTO\s+public\.audit_events/i);
    expect(sql).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.delete_post_observation_batch\(UUID,\s*UUID\)\s+FROM\s+PUBLIC,\s*anon/i);
    expect(sql).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.delete_post_observation_batch\(UUID,\s*UUID\)\s+TO\s+authenticated/i);
  });

  it("adds DEFAULT NULL to scene correction parameters", () => {
    expect(sql).toMatch(/p_start_seconds\s+NUMERIC\s+DEFAULT\s+NULL/i);
    expect(sql).toMatch(/p_end_seconds\s+NUMERIC\s+DEFAULT\s+NULL/i);
    expect(sql).toMatch(/p_reading_burden_wpm\s+INT\s+DEFAULT\s+NULL/i);
  });
});

describe("experiment outcome provenance (migration 016)", () => {
  const sql = sqlByFile["20260822000016_experiments.sql"];

  it("forces every outcome row to be observed evidence", () => {
    expect(sql).toMatch(/evidence_class\s+TEXT\s+NOT\s+NULL\s+DEFAULT\s+'observed'\s+CHECK\s*\(\s*evidence_class\s*=\s*'observed'\s*\)/i);
  });

  it("requires the source citability at import time", () => {
    expect(sql).toMatch(/source_citability\s+TEXT\s+NOT\s+NULL/i);
    expect(sql).toMatch(/source_citability\s+IN\s*\(\s*'verified',\s*'citable_stale',\s*'citable_unverified'\s*\)/i);
  });

  it("keeps the ambiguity flag on the row", () => {
    expect(sql).toMatch(/date_ambiguous\s+BOOLEAN\s+NOT\s+NULL\s+DEFAULT\s+false/i);
  });

  it("restricts deletion of a source that outcomes cite", () => {
    expect(sql).toMatch(/REFERENCES\s+public\.source_registry\(id,\s*workspace_id\)\s*\n?\s*ON\s+DELETE\s+RESTRICT/i);
  });

  it("guards experiment status transitions in the database, not only the client", () => {
    expect(sql).toMatch(/RAISE\s+EXCEPTION\s+'Invalid experiment transition/i);
    expect(sql).toMatch(/create\s+trigger\s+trg_guard_experiment_transition\s+before\s+update\s+on\s+public\.experiments/i);
  });
});

describe("observed posting history (migration 017)", () => {
  const sql = sqlByFile["20260822000017_post_observations.sql"];

  it("stores only observed rows tied to a registered source", () => {
    expect(sql).toMatch(/evidence_class\s*=\s*'observed'/i);
    expect(sql).toMatch(/source_id\s+UUID\s+NOT\s+NULL/i);
    expect(sql).toMatch(/REFERENCES\s+public\.source_registry\(id,\s*workspace_id\)\s*\n?\s*ON\s+DELETE\s+RESTRICT/i);
  });

  it("deduplicates re-imports by external post id per metric", () => {
    expect(sql).toMatch(/CREATE\s+UNIQUE\s+INDEX[^;]*post_observations\(workspace_id,\s*metric_key,\s*external_post_id\)[^;]*WHERE\s+external_post_id\s+IS\s+NOT\s+NULL/i);
  });

  it("keeps rows immutable and restricts deletion to admins", () => {
    expect(sql).toMatch(/post_observations_no_update[\s\S]*?USING\s*\(\s*false\s*\)/i);
    expect(sql).toMatch(/post_observations_delete[\s\S]*?is_workspace_admin_or_owner/i);
    expect(sql).toMatch(/create\s+trigger\s+trg_block_post_observation_update\s+before\s+update\s+on\s+public\.post_observations/i);
  });

  it("exposes coverage counts through a SECURITY INVOKER function and no ranking", () => {
    expect(sql).toMatch(/posting_history_coverage[\s\S]*?SECURITY\s+INVOKER/i);
    expect(sql).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.posting_history_coverage\(UUID\)\s+FROM\s+PUBLIC,\s*anon/i);
    expect(sql).not.toMatch(/order\s+by\s+avg|best_time|recommended/i);
  });
});

describe("privileged SQL", () => {
  const blocks = functionBlocks(code);
  const definers = blocks.filter((b) => /security\s+definer/i.test(b.text));

  it("finds the SECURITY DEFINER functions the schema documents", () => {
    const names = new Set(definers.map((d) => d.name));
    for (const expected of [
      "is_workspace_member",
      "is_workspace_admin_or_owner",
      "handle_new_user",
      "block_manual_connected_status",
      "storage_workspace_id",
      "save_scene_correction_atomic",
      "save_claim_correction_atomic",
      "claim_next_job",
      "complete_job",
      "fail_job",
      "cancel_job",
      "approve_job",
      "release_stale_jobs",
      "purge_expired_artifacts",
      "request_connector",
      "revoke_connector",
      "consume_quota",
      "audit_summary",
      "delete_post_observation_batch",
      "block_conversation_observation_core_mutation",
      "review_conversation_observation_atomic",
      "review_conversation_interpretation_atomic",
    ]) {
      expect(names.has(expected), `missing SECURITY DEFINER function ${expected}`).toBe(true);
    }
  });

  it("final definition of every SECURITY DEFINER function sets an explicit search_path", () => {
    // Later migrations redefine earlier functions; only the last definition matters.
    const last = new Map<string, string>();
    for (const d of definers) last.set(d.name, d.text);
    for (const [name, text] of last) {
      expect(/set\s+search_path\s*=/i.test(text), `${name} lacks SET search_path`).toBe(true);
    }
  });

  it.each(["save_scene_correction_atomic", "save_claim_correction_atomic"])(
    "%s requires non-null auth.uid(), derives the actor server-side, and is revoked from PUBLIC and anon",
    (name) => {
      const final = [...definers].reverse().find((d) => d.name === name);
      expect(final).toBeDefined();
      const text = final!.text;
      expect(text).toMatch(/v_actor_id\s*:=\s*auth\.uid\(\)/i);
      expect(text).toMatch(/if\s+v_actor_id\s+is\s+null\s+then/i);
      expect(text).not.toMatch(/p_user_id/i);
      expect(text).toMatch(/is_workspace_member\(p_workspace_id\)/i);
      expect(text).toMatch(/pg_advisory_xact_lock/i);
      const revoke = new RegExp(
        `revoke\\s+all\\s+on\\s+function\\s+public\\.${name}\\([^)]*\\)\\s+from\\s+public\\s*,\\s*anon`,
        "i"
      );
      expect(code).toMatch(revoke);
    }
  );

  it.each(["claim_next_job", "complete_job", "fail_job", "release_stale_jobs", "purge_expired_artifacts", "audit_summary"])(
    "worker RPC %s is revoked from PUBLIC, anon, and authenticated (service_role only)",
    (name) => {
      const revoke = new RegExp(`revoke\\s+all\\s+on\\s+function\\s+public\\.${name}\\([^)]*\\)\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated`, "i");
      expect(code).toMatch(revoke);
      const grant = new RegExp(`grant\\s+execute\\s+on\\s+function\\s+public\\.${name}\\([^)]*\\)\\s+to\\s+service_role\\s*;`, "i");
      expect(code).toMatch(grant);
    }
  );

  it.each(["cancel_job", "approve_job", "request_connector", "revoke_connector", "consume_quota"])("member RPC %s requires non-null auth.uid() and membership", (name) => {
    const final = [...definers].reverse().find((d) => d.name === name);
    expect(final).toBeDefined();
    expect(final!.text).toMatch(/v_actor_id\s*:=\s*auth\.uid\(\)/i);
    expect(final!.text).toMatch(/if\s+v_actor_id\s+is\s+null\s+then/i);
    expect(final!.text).toMatch(/is_workspace_(member|admin_or_owner)\(p_workspace_id\)/i);
  });

  it("workspace_quotas is writable only through consume_quota (browser insert/update/delete denied)", () => {
    const denies = (policiesByTable(code).get("workspace_quotas") ?? []).filter((p) => /(using|with\s+check)\s*\(\s*false\s*\)/i.test(p.body)).map((p) => p.cmd).sort();
    expect(denies).toEqual(["delete", "insert", "update"]);
  });

  it("connector_accounts base table is revoked from browser roles; public view exposes no token columns", () => {
    expect(code).toMatch(/revoke\s+all\s+on\s+table\s+public\.connector_accounts\s+from\s+public\s*,\s*anon\s*,\s*authenticated/i);
    const view = code.match(/create\s+or\s+replace\s+view\s+public\.connector_accounts_public[\s\S]*?from\s+public\.connector_accounts\s*;/i);
    expect(view).not.toBeNull();
    expect(view![0]).not.toMatch(/ciphertext|token_key_id/i);
    expect(view![0]).toMatch(/security_invoker\s*=\s*true/i);
    const colGrant = code.match(/grant\s+select\s*\(([^)]*)\)\s*on\s+public\.connector_accounts\s+to\s+authenticated/i);
    expect(colGrant).not.toBeNull();
    expect(colGrant![1]).not.toMatch(/ciphertext|token_key_id/i);
  });

  it("revoke_connector clears ciphertext immediately", () => {
    const fn = [...definers].reverse().find((d) => d.name === "revoke_connector");
    expect(fn).toBeDefined();
    expect(fn!.text).toMatch(/access_token_ciphertext\s*=\s*null/i);
    expect(fn!.text).toMatch(/refresh_token_ciphertext\s*=\s*null/i);
  });

  it("retrieval_embeddings is read-only for browser roles (insert/update/delete denied)", () => {
    const denies = (policiesByTable(code).get("retrieval_embeddings") ?? []).filter((p) => /(using|with\s+check)\s*\(\s*false\s*\)/i.test(p.body)).map((p) => p.cmd).sort();
    expect(denies).toEqual(["delete", "insert", "update"]);
  });

  it("vector search runs as SECURITY INVOKER so RLS applies, and returns no embedding text", () => {
    const fn = code.match(/create\s+or\s+replace\s+function\s+public\.match_retrieval_candidates[\s\S]*?\$\$;/i);
    expect(fn).not.toBeNull();
    expect(fn![0]).toMatch(/security\s+invoker/i);
    expect(fn![0]).not.toMatch(/security\s+definer/i);
    expect(fn![0]).toMatch(/where\s+e\.workspace_id\s*=\s*p_workspace_id/i);
  });

  it("jobs table denies direct UPDATE and DELETE so every transition goes through an RPC", () => {
    const denies = (policiesByTable(code).get("jobs") ?? []).filter((p) => /using\s*\(\s*false\s*\)/i.test(p.body)).map((p) => p.cmd).sort();
    expect(denies).toEqual(["delete", "update"]);
  });

  it("storage policies derive workspace from the object path through the defensive helper only", () => {
    const storagePolicies = [
      ...code.matchAll(/create\s+policy\s+"workspace_assets_[a-z]+"\s+on\s+storage\.objects[\s\S]*?;/gi),
    ].map((m) => m[0]);
    expect(storagePolicies).toHaveLength(4);
    for (const p of storagePolicies) {
      expect(p).toMatch(/bucket_id\s*=\s*'workspace-assets'/i);
      expect(p).toMatch(/public\.storage_workspace_id\(name\)/i);
      expect(p).not.toMatch(/::uuid/i);
    }
  });
});

describe("composite tenant foreign keys", () => {
  it.each([
    ["creative_twins", "asset_id", "creative_assets"],
    ["ingestion_runs", "asset_id", "creative_assets"],
    ["metric_definitions", "source_id", "source_registry"],
  ])("migration 009 upgrades public.%s.%s to a composite FK on %s", (child, col, parent) => {
    const re = new RegExp(
      `alter\\s+table\\s+public\\.${child}\\s+add\\s+constraint\\s+\\w+\\s+foreign\\s+key\\s*\\(\\s*${col}\\s*,\\s*workspace_id\\s*\\)\\s*references\\s+public\\.${parent}\\s*\\(\\s*id\\s*,\\s*workspace_id\\s*\\)`,
      "i"
    );
    expect(code).toMatch(re);
  });

  it("metric_definitions composite FK nulls only source_id on parent delete", () => {
    expect(code).toMatch(/on\s+delete\s+set\s+null\s*\(\s*source_id\s*\)/i);
  });

  it.each([
    ["evidence_items", "source_registry"],
    ["creative_assets", "source_registry"],
    ["creative_scenes", "creative_twins"],
    ["creative_claims", "creative_twins"],
    ["creative_claims", "brand_claims"],
    ["creative_twin_versions", "creative_twins"],
    ["model_task_runs", "creative_twins"],
    ["derived_artifacts", "creative_assets"],
    ["derived_artifacts", "jobs"],
    ["retrieval_embeddings", "jobs"],
  ])("public.%s references %s with (id, workspace_id)", (child, parent) => {
    const tableBlock = code.match(
      new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${child}\\s*\\([\\s\\S]*?\\n\\);`, "i")
    );
    expect(tableBlock, `table block for ${child}`).not.toBeNull();
    expect(tableBlock![0]).toMatch(
      new RegExp(`references\\s+public\\.${parent}\\s*\\(\\s*id\\s*,\\s*workspace_id\\s*\\)`, "i")
    );
  });
});

describe("expand job types (migration 020)", () => {
  const sql = sqlByFile["20260822000020_expand_job_types.sql"];

  it("replaces jobs_job_type_check with all 10 job types", () => {
    expect(sql).toMatch(/ALTER\s+TABLE\s+public\.jobs\s+DROP\s+CONSTRAINT\s+IF\s+EXISTS\s+jobs_job_type_check/i);
    expect(sql).toMatch(/ALTER\s+TABLE\s+public\.jobs\s+ADD\s+CONSTRAINT\s+jobs_job_type_check\s+CHECK/i);
    expect(sql).toMatch(/conversation_import_validate/i);
    expect(sql).toMatch(/conversation_deduplicate/i);
    expect(sql).toMatch(/conversation_interpretation_proposal/i);
    expect(sql).toMatch(/conversation_attribution/i);
    expect(sql).toMatch(/conversation_aggregate/i);
  });
});

