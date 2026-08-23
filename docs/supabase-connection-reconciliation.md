# Supabase Connection and Migration Reconciliation Report

**Date:** 2026-08-23
**Status:** Static review complete. No live connection established. No migration applied. No branch created.
**Author:** Automated review, pre-authentication.

This report satisfies the three safeguards required before any write to the Supabase project. It is written to be read before granting apply authorization, and it deliberately separates **verified static facts** (derived from the repository) from **unverified live claims** (requiring an authenticated connection). Nothing in the "live status" column has been confirmed against the real database, because no connection exists yet.

---

## 1. Connection hygiene — done

| Item | Before | After |
| --- | --- | --- |
| MCP entries named `supabase` | 2 (conflicting scopes) | 1 |
| Project scope | `https://mcp.supabase.com/mcp?project_ref=ujxrapbhiedkwleccvqw&features=docs,account,database,debugging,development,functions,branching` | unchanged, retained |
| Local scope | `npx -y @supabase/mcp-server-supabase@latest --read-only --project-ref=YOUR_PROJECT_REF` | removed |
| `.mcp.json` git state | untracked | untracked, now excluded via `.git/info/exclude` |
| `supabase/.temp/` git state | untracked | untracked, now excluded via `.git/info/exclude` |

The removed local entry contained the literal unsubstituted placeholder `YOUR_PROJECT_REF`, so it could never have connected to the real project. It was also the reason `claude mcp list` reported conflicting scopes, and it mattered beyond cosmetics: OAuth tokens are stored per endpoint, so authenticating against one entry would not have carried over to the other.

`.git/info/exclude` was chosen over `.gitignore` deliberately. `.gitignore` is itself a committed file, so adding `.mcp.json` there would be a repository-wide decision imposed on every clone. `.git/info/exclude` is local-only and reversible, which matches the instruction that `.mcp.json` stays local unless explicitly decided otherwise. The file records this reasoning inline so a future reader does not "helpfully" move it.

**Remaining git observation, not acted on:** `todo.md` shows as modified in `git status`. That change was not made by this review.

---

## 2. Authentication — blocked on one human action

OAuth requires a browser consent flow. It cannot be completed programmatically. This is the only step in the entire plan that requires a human.

```
claude /mcp
```

Run in a regular terminal, select `supabase`, choose `Authenticate`. Then restart the session so the tools load.

### Read-only inventory scope, committed to in advance

After authentication, the first actions are restricted to reads. The following list is exhaustive; anything not on it requires separate approval.

| Permitted read | Tool | What it answers |
| --- | --- | --- |
| Migration history | `list_migrations` | Which of 001-017 the live project believes are applied |
| Postgres version | `execute_sql` (`select version()`) | Whether 009's `ON DELETE SET NULL (col)` syntax is supported |
| Table inventory | `list_tables` | Which of the 29 expected tables exist |
| RLS state and policies | `execute_sql` on `pg_class` / `pg_policy` | Whether tenant isolation is actually on |
| Function definitions and grants | `execute_sql` on `pg_proc` / `pg_get_functiondef` | SECURITY DEFINER inventory, D-6 |
| Storage policies | `execute_sql` on `storage.objects` policies | D-7 |
| Security and performance advisors | `get_advisors` | D-9 |
| Live project ref confirmation | `get_project_url` / project metadata | Confirms the ref in this config is the intended project |
| Parent composite uniques | `execute_sql` on `pg_constraint` | Prerequisite for 009, see section 4 |
| Row counts on 009's three child tables | `execute_sql` (`count(*)`) | Sizes the 009 pre-check risk |

**Explicitly excluded from the inventory pass:** `apply_migration`, any writing `execute_sql`, `deploy_edge_function`, any Storage mutation, branch creation, branch deletion, branch merge, and any data create/update/delete.

---

## 3. Reconciliation — migrations 007 through 017 as one dependency chain

### 3.1 Table ownership, all 17 migrations

Derived from the migration SQL itself, not from documentation.

| Migration | Tables created |
| --- | --- |
| 001 auth_workspaces | `profiles`, `workspaces`, `workspace_members`, `audit_events` |
| 002 brand_brain | `brands`, `brand_codex_versions`, `brand_audiences`, `brand_claims`, `brand_proof_points`, `brand_competitors`, `brand_tone_guidelines`, `brand_compliance_boundaries` |
| 003 evidence_layer | `source_registry`, `evidence_items`, `metric_definitions` |
| 004 creative_intake | `creative_assets`, `ingestion_runs`, `creative_twins` |
| 005 creative_twin_expansion | `creative_scenes`, `creative_claims`, `creative_twin_versions` |
| 006 secure_twin_correction_rpcs | none (RPCs only) |
| 007 brand_brain_rls | none (RLS only) |
| 008 bind_created_by | none (policies only) |
| 009 composite_tenant_fks | none (constraints only) |
| 010 model_task_runs | `model_task_runs` |
| 011 jobs | `jobs` |
| 012 derived_artifacts | `derived_artifacts` |
| 013 embeddings | `retrieval_embeddings` |
| 014 connector_accounts | `connector_accounts` (+ view `connector_accounts_public`) |
| 015 workspace_quotas | `workspace_quotas` |
| 016 experiments | `experiments`, `experiment_outcomes` |
| 017 post_observations | `post_observations` |

### 3.2 Order constraints

No migration references a table created by a later migration. **The declared order 007 through 017 is internally consistent.** The only intra-batch dependency is 012 and 013 both requiring `jobs` from 011.

| Migration | Depends on |
| --- | --- |
| 007 | nothing beyond 001-005 |
| 008 | nothing beyond 001-005 |
| 009 | `creative_assets` (004), `source_registry` (003) |
| 010 | `workspaces` (001), `creative_twins` (004) |
| 011 | `workspaces` (001) |
| 012 | `workspaces` (001), `creative_assets` (004), **`jobs` (011)** |
| 013 | `workspaces` (001), **`jobs` (011)** |
| 014 | `workspaces` (001) |
| 015 | `workspaces` (001) |
| 016 | `workspaces` (001), `creative_twins` (004), `source_registry` (003) |
| 017 | `workspaces` (001), `source_registry` (003), `creative_twins` (004) |

### 3.3 The main table

Live status is **UNVERIFIED** for every row. That is not a placeholder; it is the accurate value until authentication happens.

| # | Purpose | Deps | Pre-check | Live status | Branch suitability | Exact post-check |
| --- | --- | --- | --- | --- | --- | --- |
| **007** brand_brain_rls | Enables RLS on 8 `brand*` tables, creates 32 policies | 002 | Record `relrowsecurity` + policy count for all 8 `brand*` tables **before** applying. If any is `false`, live data is currently exposed and this is urgent. | UNVERIFIED | **Good.** Schema-only, no data dependency. | All 8 tables `rls_enabled = true`; `policy_count >= 4` except `brand_codex_versions` which has 2 by design (select, insert) |
| **008** bind_created_by | Recreates INSERT policies on 15 tables to force `created_by = auth.uid()` (`started_by` on `ingestion_runs`) | 001-005 | Per-table scan for rows whose `created_by` is not a workspace member. Non-zero means either prior exploitation or a service-role import, and must be explained before proceeding. | UNVERIFIED | **Poor.** A data-less branch has no rows, so the orphan scan is vacuous and proves nothing. | 15 INSERT policies present; an INSERT with a forged `created_by` is rejected |
| **009** composite_tenant_fks | Replaces 3 single-column FKs with composite `(id, workspace_id)` FKs, closing cross-tenant parent references | 003, 004 | **Three violation queries must each return zero rows** (see 4.1). Also: Postgres `>= 15`, and parent composite uniques must exist. | UNVERIFIED | **Poor, and misleading.** Applies cleanly to an empty branch and tells you nothing about your real rows. See section 4. | 3 new `*_workspace_id_fkey` constraints exist; 3 old `*_id_fkey` constraints gone; cross-tenant INSERT now rejected |
| **010** model_task_runs | Append-only model run audit table + mutation-blocking trigger | 001, 004 | None. New table. | UNVERIFIED | **Good.** | Table exists; RLS on; 4 policies; `trg_block_model_task_run_mutation` present; UPDATE raises |
| **011** jobs | Durable job queue, 6 RPCs (`claim_next_job`, `complete_job`, `fail_job`, `cancel_job`, `approve_job`, `release_stale_jobs`) | 001 | None. New table. | UNVERIFIED | **Good, and valuable** — the queue is genuinely exercisable without production data. | Table exists; RLS on; duplicate `idempotency_key` insert rejected; `claim_next_job` returns one row under concurrency |
| **012** derived_artifacts | Cached derived output with retention + `purge_expired_artifacts` | 001, 004, **011** | 011 applied first. | UNVERIFIED | **Good.** | Table exists; RLS on; `purge_expired_artifacts` deletes only rows past `retention_until` |
| **013** embeddings | `retrieval_embeddings` + `match_retrieval_candidates`, `retrieval_coverage`; **requires `vector` extension** | 001, **011** | **`create extension vector` must succeed.** This is the only migration in the batch that adds an extension. | UNVERIFIED | **Good, and important** — extension availability is exactly what a branch should prove first. | Extension present; table exists; RLS on; both functions `SECURITY INVOKER` so RLS still applies |
| **014** connector_accounts | OAuth connector storage, encrypted tokens, `connector_accounts_public` view, `request_connector` / `revoke_connector` | 001 | None. New table. | UNVERIFIED | **Good.** | Table exists; RLS on; direct `SELECT` on the base table by `authenticated` is denied; view returns non-secret columns only |
| **015** workspace_quotas | Per-workspace rate limits, `default_quota`, `consume_quota`, `audit_summary` | 001 | None. New table. | UNVERIFIED | **Good.** | Table exists; RLS on; `consume_quota` decrements atomically and refuses past the limit |
| **016** experiments | `experiments` + `experiment_outcomes`, transition guard trigger, outcome immutability trigger | 001, 003, 004 | None. New tables. | UNVERIFIED | **Good.** | Both tables exist; RLS on; 8 policies; invalid state transition raises; outcome UPDATE raises; deleting a cited `source_registry` row raises (`ON DELETE RESTRICT`) |
| **017** post_observations | Observed posting history, `posting_history_coverage`, update-blocking trigger; **has a UNIQUE index** | 001, 003, 004 | None on a new table, but note `uq_post_observations_external` — any future import with duplicate external ids will be rejected, by design. | UNVERIFIED | **Good.** | Table exists; RLS on; UPDATE raises; `member` DELETE affects 0 rows while `owner` DELETE succeeds; `posting_history_coverage` returns only the caller's workspace |

### 3.4 Rerunnability and destructive statements

Every one of 007-017 uses `IF NOT EXISTS` on tables and indexes, `DROP POLICY IF EXISTS` before `CREATE POLICY`, `CREATE OR REPLACE FUNCTION`, and `DROP TRIGGER IF EXISTS` before `CREATE TRIGGER`. **All eleven are individually rerunnable.** No migration in the batch contains `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or `ALTER COLUMN ... TYPE`.

Three contain `DELETE`/`UPDATE`, and all three are inside function bodies rather than executed at migration time: `purge_expired_artifacts` (012), the job-state RPCs (011), and `revoke_connector` (014). None mutates data when the migration runs.

**009 is the sole exception to the safety pattern.** It executes `DROP CONSTRAINT IF EXISTS` at migration time. See section 4.

---

## 4. Migration 009 — the one real hazard

### 4.1 The three pre-check queries, exact

All three must return zero rows.

```sql
select t.id from public.creative_twins t
  join public.creative_assets a on a.id = t.asset_id
  where a.workspace_id <> t.workspace_id;

select r.id from public.ingestion_runs r
  join public.creative_assets a on a.id = r.asset_id
  where a.workspace_id <> r.workspace_id;

select m.id from public.metric_definitions m
  join public.source_registry s on s.id = m.source_id
  where s.workspace_id <> m.workspace_id;
```

A non-empty result is not a migration problem. It is evidence that the vulnerability 009 exists to close was actually reachable, and it needs a data decision before any schema change.

### 4.2 Atomicity risk

009 drops each old constraint and then adds the new one:

```sql
ALTER TABLE public.creative_twins DROP CONSTRAINT IF EXISTS creative_twins_asset_id_fkey;
ALTER TABLE public.creative_twins ADD CONSTRAINT creative_twins_asset_id_workspace_id_fkey
  FOREIGN KEY (asset_id, workspace_id) REFERENCES public.creative_assets(id, workspace_id) ON DELETE CASCADE;
```

The `ADD CONSTRAINT` validates every existing row. If it fails, the `DROP` has already executed. Postgres DDL is transactional, so an executor that wraps the file in a single transaction rolls both back safely. The file contains **no explicit `BEGIN`/`COMMIT`**, so safety depends entirely on the executor.

**Failure mode if the executor does not wrap:** `creative_twins.asset_id` ends up with no foreign key at all — strictly worse than the state 009 was written to improve, and silent.

Two mitigations, both cheap:
1. Run the 4.1 pre-checks immediately before applying, in the same session. Already planned.
2. Add explicit `BEGIN;` / `COMMIT;` to the file. This edits a committed migration, so it is a decision to make, not one to assume. Recommended.

### 4.3 Two unverified prerequisites

The file's own comments assert both. Comments are not evidence.

- **Postgres 15+**, for `ON DELETE SET NULL (source_id)` with a column list. Confirm with `select version()`.
- **Parent composite uniques must already exist**: `creative_assets UNIQUE (id, workspace_id)` from 004, `source_registry UNIQUE (id, workspace_id)` from 003. A composite FK cannot be created without them. Confirm in `pg_constraint`.

---

## 5. Branching — the answer, and why it changes the plan

### 5.1 Verified facts

| Question | Answer | Source |
| --- | --- | --- |
| Available on Free? | **No.** "Branching — Not included in free" | supabase.com/pricing |
| Cost on Pro/Team? | **$0.01344 per branch, per hour** — about $0.32/day, about $9.68 for a 30-day month if left running | supabase.com/pricing |
| Does it copy production data? | **No.** "New branches do not start with any data from your main project. This is meant to better protect your sensitive production data." | supabase.com/docs/guides/deployment/branching |
| Is it anonymized? | **The question does not apply** — there is no data to anonymize. Do not describe a branch as an anonymized copy. | same |
| How does data get in? | Only via an explicit seed file | same |
| Ephemeral or persistent? | Preview branches auto-delete on PR merge or close. Persistent branches survive. | same |
| Isolation | Each branch is a separate Supabase instance with its own credentials | same |

### 5.2 What this means

The branch-first instinct was sound, and the reason it was sound is worth keeping: never let production be the first place a migration runs. But data-less branches deliver only part of that protection.

**A branch gives real evidence for:** does the SQL parse, is the Postgres version sufficient, is the `vector` extension available, do the triggers and RPCs behave, does RLS deny what it should. That covers **010 through 017 well** — nine migrations that only create new tables.

**A branch gives no evidence for:** 008's orphan `created_by` scan and 009's three cross-tenant violation checks. Both are questions about existing rows, and a branch has none. Applying them to an empty branch produces a green result that means nothing — the most dangerous kind of test, because it looks like proof.

**Is a branch safe for this existing workspace?** Creating one is safe: separate instance, no production data copied, no effect on the primary project. Two caveats. First, **merging is a production write** and is out of scope under the stated rules. Second, branching requires Pro; on Free the attempt simply fails, which is a harmless but pointless call.

### 5.3 Consequence: the Free-plan backup gap

If this project is on Free, the pricing page states plainly: **no automatic backups, no point-in-time recovery**, and pausing after one week of inactivity.

Applying 009 in-place, on Free, against real data, with no backup and no PITR, has no recovery path if it goes wrong. The plan's own risk controls quietly assume a rollback that would not exist. Confirming the plan tier is therefore a **required output of the read-only inventory**, not a detail.

### 5.4 Recommended sequencing

Contingent on the inventory, and on explicit approval before any write.

1. Complete the read-only inventory. Establish plan tier, Postgres version, real migration history, actual RLS state, parent composite uniques, and the 4.1 pre-check results against **live** data.
2. If on Pro: create one persistent branch, apply 010 through 017 there one at a time, run each D-check. This is cheap, isolated, and genuinely informative.
3. For 007, 008, 009: a branch cannot validate these. They need the live pre-checks from step 1 plus a backup that is confirmed to exist. Not a branch run.
4. Never merge. A successful branch run is evidence for a later proposal, not authorization.

---

## 6. What was done, and what was not

**Done:** duplicate MCP entry removed; single project-scoped endpoint retained; `.mcp.json` and `supabase/.temp/` excluded from git locally; all 17 migrations statically analyzed for dependencies, order violations, destructive statements, and rerunnability; 009 read line by line; branching availability, data handling, and cost verified against Supabase's own published pages.

**Not done, by design:** no authentication (requires a browser); no live query of any kind; no migration applied; no branch created; no Edge Function deployed; no Storage change; no data written; migrations 001 through 006 untouched.

**Not verified, and cannot be without a connection:** every value in the "live status" column, the plan tier, the Postgres version, whether 001-006 are genuinely applied, and whether the parent composite uniques exist.

Repository work continues independently. Connection and deployment remain a separate guarded track.
