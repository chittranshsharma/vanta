# Supabase Deferred Validation & Migration Checklist

Every item here requires live Supabase access (dashboard, SQL editor, CLI, or MCP). An authorized operator runs these in order. Each item states what to run, what result proves the check, and what to do on failure.

All SQL is read-only unless the item says APPLY.

---

## D-0. Sensitive Local Logical Export & Truthful Free-Tier Recovery Procedure

Because Supabase project `ujxrapbhiedkwleccvqw` is on the **Free Plan**:
- **No Automated Backups / PITR:** The Free tier has no daily automated database backups, no Point-In-Time Recovery (PITR), and no automated restore points.
- **Data-loss / Disaster Posture:** A full point-in-time state recovery or zero-data-loss guarantee is **not possible** under Free-tier limitations.
- **Purpose of Local Logical Export:** A manual JSON export provides a best-effort **logical table row capture** solely to allow manual row re-insertion in case of accidental table corruption during manual DDL operations.

### Scope of Logical Export
- **What is covered:** JSON snapshot of existing application table rows (`profiles`, `workspaces`, `workspace_members`, `audit_events`, `source_registry`, `creative_assets`, `ingestion_runs`, `creative_twins`, `creative_scenes`, `creative_claims`, `creative_twin_versions`).
- **What is NOT covered:**
  - `auth.users` encrypted passwords, salts, OAuth identities, and email confirmation tokens.
  - Storage bucket binary files/blobs (`storage.objects`).
  - Database OIDs, PostgreSQL internal sequence counters, WAL logs, or extension system state.
  - Granular point-in-time rollbacks.

### Security, Storage & Deletion Rules for Operators
1. **Never Commit Exports:** Export files contain sensitive live user emails, full names, and workspace metadata. They are strictly ignored in `.gitignore` (`*.backup.json`, `docs/backup_*.json`).
2. **Secure Local Storage:** Any exported file stored on an operator's local workstation must reside on an encrypted volume (BitLocker / FileVault) with strict local user permissions.
3. **Retention & Destruction:** Logical exports are strictly ephemeral. Once migration verification succeeds and is accepted, all local export files must be immediately shredded/deleted.

### Logical Export Query (Operator-Only, Ephemeral)
```sql
SELECT jsonb_build_object(
  'exported_at', NOW(),
  'project_ref', 'ujxrapbhiedkwleccvqw',
  'profiles', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.profiles t),
  'workspaces', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.workspaces t),
  'workspace_members', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.workspace_members t),
  'audit_events', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.audit_events t),
  'source_registry', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.source_registry t),
  'creative_assets', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.creative_assets t),
  'ingestion_runs', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.ingestion_runs t),
  'creative_twins', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.creative_twins t),
  'creative_scenes', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.creative_scenes t),
  'creative_claims', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.creative_claims t),
  'creative_twin_versions', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM public.creative_twin_versions t)
) AS logical_export;
```

---

## Canonical Migration Ledger State

- **Applied Live:** All Migrations `001` through `017`.
  - Migrations 001–005 recorded via initial migration setup.
  - Migration 006 SQL routines applied and hardened in PostgreSQL routines.
  - Migration `20260822000007_brand_brain_rls` applied live (`20260823083750_20260822000007_brand_brain_rls`).
  - Migration `20260822000008_bind_created_by` applied live (`20260823083936_20260822000008_bind_created_by`).
  - Migration `20260822000009_composite_tenant_fks` applied live (`20260823084225_20260822000009_composite_tenant_fks`).
  - Migration `20260822000010_model_task_runs` applied live (`20260823084335_20260822000010_model_task_runs`).
  - Migration `20260822000011_jobs` applied live (`20260823084353_20260822000011_jobs`).
  - Migration `20260822000012_derived_artifacts` applied live (`20260823084404_20260822000012_derived_artifacts`).
  - Migration `20260822000013_embeddings` applied live (`20260823084515_20260822000013_embeddings`).
  - Migration `20260822000014_connector_accounts` applied live (`20260823084528_20260822000014_connector_accounts`).
  - Migration `20260822000015_workspace_quotas` applied live (`20260823084535_20260822000015_workspace_quotas`).
  - Migration `20260822000016_experiments` applied live (`20260823084612_20260822000016_experiments`).
  - Migration `20260822000017_post_observations` applied live (`20260823084622_20260822000017_post_observations`).
- **Pending Live Apply:** None (Full chain 001–017 live).

---

## D-1. Apply and verify migration 20260822000007 (Brand Brain RLS) - P0-1

**Status: APPLIED & VERIFIED LIVE (2026-08-23).**

- **Pre-check:** All 8 Brand Brain tables existed with initial policies.
- **Application:** Applied `supabase/migrations/20260822000007_brand_brain_rls.sql` via Supabase migration runner.
- **Post-check:** All 8 `brand_*` tables show `rls_enabled = true` and `policy_count = 4` (32 policies total). All 7 supporting indexes on `workspace_id` created.
- **Ledger Record:** `20260823083750_20260822000007_brand_brain_rls` confirmed in `supabase_migrations.schema_migrations`.

---

## D-2. Bind created_by to auth.uid() - P1-6

**Status: APPLIED & VERIFIED LIVE (2026-08-23).**

- **Pre-check:** D-2 orphan/invalid actor scan re-executed across 15 tables immediately before application; 0 violations found.
- **Application:** Applied `supabase/migrations/20260822000008_bind_created_by.sql` via Supabase migration runner.
- **Post-check:** All 15 INSERT policies verified in `pg_policies` enforcing `created_by = auth.uid()` (`started_by = auth.uid()` on `ingestion_runs`), `auth.uid() IS NOT NULL`, and `is_workspace_member(workspace_id)`.
- **Isolation Verification:** Authenticated session simulation verified: valid actor ID insert succeeds; forged actor ID fails; cross-workspace insert fails.
- **Ledger Record:** `20260823083936_20260822000008_bind_created_by` confirmed in `supabase_migrations.schema_migrations`.

---

## D-3. Hardened Composite Foreign Keys - P1-7

**Status: APPLIED & VERIFIED LIVE (2026-08-23).**

- **Pre-check:** Re-verified parent composite unique constraints and confirmed 0 cross-tenant link violations across `creative_twins`, `ingestion_runs`, and `metric_definitions`.
- **Application:** Applied `supabase/migrations/20260822000009_composite_tenant_fks.sql` via Supabase migration runner using staged `NOT VALID` -> `VALIDATE` -> `DROP` old FKs.
- **Post-check:**
  - Verified 3 composite foreign keys (`creative_twins_asset_id_workspace_id_fkey`, `ingestion_runs_asset_id_workspace_id_fkey`, `metric_definitions_source_id_workspace_id_fkey`) are active and `convalidated = true`.
  - Verified old single-column FKs removed.
  - Verified 3 composite indexes (`idx_creative_twins_asset_workspace`, `idx_ingestion_runs_asset_workspace`, `idx_metric_definitions_source_workspace`) created.
  - Negative test suite: Confirmed cross-tenant writes on all 3 relationships are blocked with `foreign_key_violation` (23503).
- **Ledger Record:** `20260823084225_20260822000009_composite_tenant_fks` confirmed in `supabase_migrations.schema_migrations`.


## D-4. Model gateway live checks - Ticket 5.0

Only after user approval to deploy (see `docs/model-gateway-deployment-readiness.md`).

1. Confirm `audit_events` rows appear with `action = 'model_gateway.invocation'` and `resource_type = 'model_gateway'` after one health check. Zero rows means P1-2 regressed.
2. Run 11 health checks in one hour as owner; the 11th must return 429.
3. Call with a `viewer` role JWT; expect 403.
4. Call with no `Authorization`; expect 401.
5. Call with an extra body field; expect 400 `invalid_request`.
6. Call from an origin not in `ALLOWED_ORIGINS`; browser must block via CORS.
7. Temporarily unset `GROQ_API_KEY`; expect 503 `gateway_not_configured`. Restore.
8. Ticket 5.1 (after migration 010 and `ENABLED_TASKS=claim_grounding_audit`): run one audit as a member; expect a `model_task_runs` row whose `output.verdicts` ids all exist in `creative_claims`, `brand_claims`, `brand_proof_points` for that workspace:

```sql
select r.id, v->>'creative_claim_id' as cc, exists(select 1 from public.creative_claims c where c.id = (v->>'creative_claim_id')::uuid and c.workspace_id = r.workspace_id) as cc_ok
from public.model_task_runs r, jsonb_array_elements(r.output->'verdicts') v
where r.task_type = 'claim_grounding_audit' order by r.created_at desc limit 50;
```

   Every `cc_ok` must be true. Then `update public.model_task_runs set status = 'passed' where false;` as a member must raise (append-only).

## D-5. Atomic re-parse RPC - P1-8

Design a `SECURITY DEFINER` function `reparse_twin_atomic(p_twin_id, p_workspace_id, p_scenes jsonb, p_claims jsonb)` following the 006 authorization pattern (non-null `auth.uid()`, membership, creator-or-admin, advisory lock, `search_path = public, pg_temp`, revoke from `PUBLIC`/`anon`). Not authored yet; blocked until D-1 clears the queue.

## D-6. SECURITY DEFINER function inventory

```sql
select p.proname, p.prosecdef, p.proconfig,
  (select string_agg(r.rolname, ',') from pg_roles r where has_function_privilege(r.oid, p.oid, 'execute') and r.rolname in ('anon','authenticated','public')) as exec_roles
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef;
```

Expect: every row has `search_path` in `proconfig`; `save_scene_correction_atomic` and `save_claim_correction_atomic` list only `authenticated` in `exec_roles`. Static review of the migration files already shows this; the live check proves the 006 patch was applied.

## D-7. Storage policies

```sql
select polname, polcmd from pg_policy where polrelid = 'storage.objects'::regclass and polname like 'workspace_assets_%';
select id, public from storage.buckets where id = 'workspace-assets';
```

Expect 4 policies and `public = false`.

## D-8. Immutability trigger

```sql
select tgname, tgenabled from pg_trigger where tgrelid = 'public.creative_twin_versions'::regclass;
```

Expect `trg_block_twin_version_mutation` with `tgenabled = 'O'`. Then as an owner JWT attempt `update public.creative_twin_versions set change_summary = 'x' where false;` through PostgREST: must raise, not silently no-op.

## D-9. Supabase advisors

Dashboard: Database > Advisors. Run Security and Performance. Record every finding in `docs/fable-audit.md` with a P-level. Known expected items: missing indexes on composite FKs are acceptable at current volume.

## D-10. QA-1 two-user isolation

Create two real accounts in the project. With each JWT, attempt SELECT/INSERT/UPDATE/DELETE on every public table using the other user's `workspace_id`. All must return zero rows or a policy error. Automate in Playwright once the Edge Function and RLS fixes above are live.

## D-11. Jobs queue (migration 011) - Upgrade C

After applying 011:

1. As a member JWT: `insert into public.jobs (workspace_id, created_by, job_type, idempotency_key) values (<ws>, auth.uid(), 'model_task', 'test-1');` succeeds; the same statement again fails with `23505`.
2. As a member JWT: `update public.jobs set status = 'succeeded' where id = <job>;` must affect 0 rows (policy denies).
3. As a member JWT: `select public.claim_next_job('x', array['model_task']);` must fail with permission denied (service_role only).
4. With the service-role key: `select public.claim_next_job('w1', array['model_task']);` returns the job with `status = running`, `attempts = 1`, `locked_by = 'w1'`.
5. `select public.fail_job(<job>, 'w1', '{"m":"x"}', true, 5);` returns `status = queued`, `run_after` about 5 seconds ahead. Repeat claim + fail until `attempts = max_attempts`; the last call returns `status = dead`.
6. `select public.release_stale_jobs(60);` returns 0 when nothing is stale.
7. As a member, enqueue `source_refresh`: row must land in `awaiting_approval`; `approve_job` as a `member` role fails, as `owner` succeeds.

## D-12. Derived artifacts (migration 012) - Upgrade D

1. `create extension` is not required for 012. Apply after 011.
2. As a member: insert a `deterministic` artifact for an asset in the workspace succeeds; inserting with `producer = 'media_worker'` fails (policy).
3. As a member: insert referencing an `asset_id` from another workspace fails (composite FK).
4. As service_role: `select * from public.purge_expired_artifacts(10);` returns zero rows when nothing has expired; insert a row with `retention_until = now() - interval '1 day'` and a storage path, call again: one row returned and the row is gone.
5. Worker smoke (after deploy, ffprobe installed): enqueue `media_probe` for a small MP4; expect `jobs.status = succeeded` and `result.features.video.codec` populated; for a renamed PNG declared as video expect `dead` with `last_error.code = type_mismatch`.

## D-13. Retrieval embeddings (migration 013) - Upgrade E

1. `create extension vector` must succeed (Supabase: enabled by default on new projects; otherwise Dashboard > Database > Extensions).
2. As a member: `insert into public.retrieval_embeddings ...` must fail (policy `with check (false)`).
3. As service_role: insert one row with a 1536-dim vector; as the member: `select * from public.match_retrieval_candidates(<ws>, <same vector>, array['brand_claims'], 5);` returns it with `similarity` close to 1. Repeat with another workspace id the member does not belong to: zero rows.
4. `select * from public.retrieval_coverage(<ws>);` returns three rows with sane counts.
5. Worker smoke (after provider configured): enqueue `embedding_refresh`; expect `jobs.result.embedded > 0` and a second run reporting `skipped` equal to the first run's `embedded`.

## D-14. Connector accounts (migration 014) - Upgrade F

1. Requires PostgreSQL 15+ for `security_invoker` views. Apply after 011.
2. As a member JWT: `select * from public.connector_accounts;` must fail with permission denied (table revoked). `select * from public.connector_accounts_public;` succeeds and has no `*_ciphertext` or `token_key_id` columns.
3. As an admin: `select public.request_connector(<ws>, 'rss', array[]::text[]);` returns an id; the public view shows `status = pending_consent`; `audit_events` has `connector.requested`.
4. As service_role: set `access_token_ciphertext = '\x00'::bytea, token_key_id = 'k1', status = 'connected', consent_granted_by = <admin>, consent_granted_at = now()`. Then as admin: `select public.revoke_connector(<id>, <ws>);` returns true and, as service_role, both ciphertext columns are NULL.
5. As a `member` role: `request_connector` and `revoke_connector` must fail (admin/owner only).

## D-15. Workspace quotas (migration 015) - Upgrade G

1. As a member: `select * from public.consume_quota(<ws>, 'model_call');` returns `allowed = true, used = 1, daily_limit = 50`. Call 50 more times: the last returns `allowed = false`.
2. As a member: `update public.workspace_quotas set used_today = 0;` affects 0 rows.
3. As a `viewer` of another workspace: `consume_quota(<other ws>, 'model_call')` raises access denied.
4. As service_role: `select * from public.audit_summary(<ws>, 7);` returns grouped rows; as a member it must fail.
5. Gateway: after 015 is live, a health-check response must carry no `quota_mode: best_effort`; G-2 fallback can then be removed.

## D-16. Experiments and observed outcomes (migration 016)

Pre-check: 007 through 015 applied; `creative_twins` and `source_registry` carry `UNIQUE (id, workspace_id)` (they do in 003 and 005).

1. Apply `20260822000016_experiments.sql`. Expect tables `experiments`, `experiment_outcomes`, two triggers, two functions.
2. As a member: insert an experiment with `created_by = auth.uid()`; succeeds. With another user's id; fails (008 pattern).
3. As a member: `update public.experiments set status = 'concluded' where status = 'draft'` raises `Invalid experiment transition draft -> concluded`.
4. As a member: insert an `experiment_outcomes` row with `evidence_class = 'inference'`; CHECK fails. Insert with a `source_id` from another workspace; composite FK fails.
5. As a member: `update` or `delete` on `experiment_outcomes` affects 0 rows (policy) and, as service_role, raises the append-only exception (trigger).
6. As a member of workspace B: `select * from public.experiments` shows no rows from workspace A.
7. Regenerate types; remove the loose casts in `src/lib/experiments.ts`.

## D-17. Observed posting history (migration 017)

Pre-check: 016 applied; `source_registry` and `creative_twins` carry `UNIQUE (id, workspace_id)`.

1. Apply `20260822000017_post_observations.sql`. Expect one table, one partial unique index, one trigger, one function.
2. As a member: insert a row with `created_by = auth.uid()` and a source in the same workspace; succeeds. With a source from another workspace; composite FK fails.
3. Insert the same `(workspace_id, metric_key, external_post_id)` twice; the second raises `23505`. Insert two rows with `external_post_id = NULL`; both succeed (partial index).
4. `update public.post_observations set value = 1` affects 0 rows as a member; as service_role it raises the immutability exception.
5. As a `member` (not admin): `delete from public.post_observations` affects 0 rows. As owner: deletion succeeds.
6. `select * from public.posting_history_coverage(<ws>)` returns counts for the caller's workspace only; as a non-member it returns no rows (SECURITY INVOKER + RLS).
7. Attempt `delete from public.source_registry where id = <cited source>`: raises a foreign-key violation (ON DELETE RESTRICT).
8. Regenerate types; drop the loose casts in `src/lib/postHistory.ts`.
