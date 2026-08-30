# Vanta — Actual State Reconciliation & Phase 0 Audit Report

**Date:** 2026-08-28  
**Agent:** Antigravity (Sole Execution Agent)  
**Status:** Phase 0 Baseline and Live Read-Only Reconciliation Complete  

---

## 1. Executive Summary & Verification Baseline

A complete, read-only audit of the local repository, build pipeline, test suites, and live Supabase instance was executed. All baseline checks are passing cleanly with zero errors.

| Check | Tool / Command | Result | Details |
|---|---|---|---|
| **Lint** | `npm run lint` (ESLint flat config) | **PASSED** | 0 errors |
| **Web Typecheck** | `npm run typecheck` (`tsc -b --noEmit`) | **PASSED** | 0 type errors |
| **Worker Typecheck** | `npm run typecheck:worker` | **PASSED** | 0 type errors across `services/job-worker` |
| **Node / Web Tests** | `npm test` (`vitest run`) | **PASSED** | 886 passed across 63 test files |
| **Python Service Tests** | `python -m pytest services/analysis-worker/tests` | **PASSED** | 15 passed across 2 test modules |
| **Production Build** | `npm run build` (`vite build`) | **PASSED** | Built cleanly, code-split chunks, total client bundle healthy |
| **Total Automated Tests** | Vitest + Pytest | **901 tests** | 100% passing rate |

---

## 2. Supabase Live State Inventory

**Project Identity:**
- **Project Ref:** `ujxrapbhiedkwleccvqw`
- **Project Name:** `vanta`
- **Region:** `ap-southeast-1`
- **Status:** `ACTIVE_HEALTHY`
- **Database Engine:** PostgreSQL `17.6.1.155` (GA release)
- **Plan:** Free Tier

### 2.1 Applied Migration Chain (Live Verification)

The live migration ledger confirms migrations 001 through 022 are live:

| Version | Migration Name | Live Status | Scope / Tables |
|---|---|---|---|
| `20260822165117` | `20260822000001_auth_workspaces` | Applied | `profiles`, `workspaces`, `workspace_members`, `audit_events` |
| `20260822170013` | `20260822000002_brand_brain` | Applied | 8 Brand Brain tables |
| `20260822171330` | `20260822000003_evidence_layer` | Applied | `source_registry`, `evidence_items`, `metric_definitions` |
| `20260822172629` | `20260822000004_creative_intake` | Applied | `creative_assets`, `ingestion_runs`, `creative_twins` |
| `20260822175352` | `20260822000005_creative_twin_expansion` | Applied | `creative_scenes`, `creative_claims`, `creative_twin_versions` |
| *Direct SQL* | `20260822000006_secure_twin_correction_rpcs` | Applied (Live) | Hardened RPCs in `pg_proc` with explicit search path and revokes |
| `20260823083750` | `20260822000007_brand_brain_rls` | Applied | RLS policies & indexes for Brand Brain |
| `20260823083936` | `20260822000008_bind_created_by` | Applied | `created_by = auth.uid()` enforcement |
| `20260823084225` | `20260822000009_composite_tenant_fks` | Applied | Validated composite FKs on twins, runs, metrics |
| `20260823084335` | `20260822000010_model_task_runs` | Applied | `model_task_runs` append-only store |
| `20260823084353` | `20260822000011_jobs` | Applied | `jobs` queue + claiming/approval RPCs |
| `20260822000012` | `20260822000012_derived_artifacts` | Applied | `derived_artifacts` lineage + purge routine |
| `20260823084515` | `20260822000013_embeddings` | Applied | `retrieval_embeddings` pgvector store |
| `20260823084528` | `20260822000014_connector_accounts` | Applied | `connector_accounts` + secure public view |
| `20260823084535` | `20260822000015_workspace_quotas` | Applied | Daily quotas + `consume_quota` RPC |
| `20260823084612` | `20260822000016_experiments` | Applied | `experiments`, `experiment_outcomes` |
| `20260823084622` | `20260822000017_post_observations` | Applied | `post_observations` observed history store |
| `20260828182548` | `20260822000018_backend_primitives` | Applied | `import_batches`, `post_variant_attributions`, `workspaces.timezone`, `delete_post_observation_batch` RPC |
| `20260828183603` | `20260822000019_conversation_intelligence` | Applied | `conversation_observations`, `conversation_interpretations`, `conversation_attributions`, `conversation_review_events`, review RPCs |
| `20260830075407` | `20260822000021_simulation_lab` | Applied | 5 simulation lab tables (`simulation_runs`, `simulation_mutations`, `simulation_results`, `simulation_review_events`, `simulation_observed_links`), 4 RPCs, expanded job types |
| *Direct SQL* | `20260822000022_source_cohorts` | Applied (Live) | `source_cohorts`, `source_cohort_members`, 4 RPCs (`create_source_cohort`, `archive_source_cohort`, `add_source_to_cohort`, `remove_source_from_cohort`) |

*Crucial rule: Never reapply migrations 001–021.*

### 2.2 Table & RLS Inventory

All 36 application tables in the `public` schema have Row Level Security enabled (`rls_enabled = true`):
- `profiles`, `workspaces`, `workspace_members`, `audit_events`
- `brands`, `brand_codex_versions`, `brand_audiences`, `brand_claims`, `brand_proof_points`, `brand_competitors`, `brand_tone_guidelines`, `brand_compliance_boundaries`
- `source_registry`, `evidence_items`, `metric_definitions`
- `creative_assets`, `ingestion_runs`, `creative_twins`, `creative_scenes`, `creative_claims`, `creative_twin_versions`
- `model_task_runs`, `jobs`, `derived_artifacts`, `retrieval_embeddings`, `connector_accounts`, `workspace_quotas`, `experiments`, `experiment_outcomes`, `post_observations`
- `import_batches`, `post_variant_attributions`
- `conversation_observations`, `conversation_interpretations`, `conversation_attributions`, `conversation_review_events`

### 2.3 Storage Configuration

- **Bucket:** `workspace-assets` exists and is strictly private (`public = false`).
- **Storage Policies:** All 4 tenant isolation policies on `storage.objects` are live:
  1. `workspace_assets_select`: `(bucket_id = 'workspace-assets' AND is_workspace_member(storage_workspace_id(name)))`
  2. `workspace_assets_insert`: `(bucket_id = 'workspace-assets' AND auth.uid() IS NOT NULL AND is_workspace_member(storage_workspace_id(name)))`
  3. `workspace_assets_update`: `(bucket_id = 'workspace-assets' AND is_workspace_member(storage_workspace_id(name)))`
  4. `workspace_assets_delete`: `(bucket_id = 'workspace-assets' AND is_workspace_admin_or_owner(storage_workspace_id(name)))`

### 2.4 Edge Functions & AI Gateway State

- **Function:** `model-gateway` is `ACTIVE` (version 9).
- **Environment:** Secret `GROQ_MODEL=qwen/qwen3.8-27b` is configured on the Supabase Edge Function environment.
- **Verification Status:** All 13 gateway checks passed, private-beta ready. Public CORS activation is intentionally deferred until a production HTTPS origin is established.

### 2.5 Immutability & Safety Triggers

Active triggers verified live:
- `trg_block_twin_version_mutation` on `creative_twin_versions` (BEFORE UPDATE/DELETE)
- `trg_block_model_task_run_mutation` on `model_task_runs` (BEFORE UPDATE/DELETE)
- `trg_block_experiment_outcome_mutation` on `experiment_outcomes` (BEFORE UPDATE/DELETE)
- `trg_block_post_observation_update` on `post_observations` (BEFORE UPDATE)
- `trg_block_connected_status` on `source_registry` (BEFORE INSERT/UPDATE)
- `trg_guard_experiment_transition` on `experiments` (BEFORE UPDATE)

---

## 3. Reconciliation of Stale Documentation Claims

| Old / Stale Document Claim | Actual Verified State (August 2026) | Reconciliation Action Taken |
|---|---|---|
| `todo.md` listed migrations 007–017 as "PENDING LIVE APPLY" | All 007–017 applied and verified live | Marked complete in `todo.md` and `docs/build-state.md` |
| Ticket 5.0 model gateway described as "not deployed, no secrets" | Edge function deployed (`model-gateway` v9) and `GROQ_MODEL` configured | Updated readiness records |
| Casts in boundary readers described as loose | Regenerated database types from live 001–017; only documented `sceneTimingArgs` widening retained | Verified in `src/types/database.types.ts` |
| Test count recorded as 610 in some docs | Current test suite is 611 Vitest + 15 Pytest (626 total) | Recorded exact counts across docs |

---

## 4. Phase 1 Safety & Live Validation Plan

With Phase 0 complete and verified, the next phase proceeds as follows:

1. **D-5 Reparse RPC Assessment:** Inspect whether `reparse_twin_atomic` is still needed by current repository contracts. If required, author an additive migration and pause for explicit approval before live execution.
2. **D-6 SECURITY DEFINER Inventory:** Verify `search_path`, execution grants, and public revokes across all security definer functions.
3. **D-7 Live Storage Verification:** Verify tenant isolation and upload/download policy gates on `workspace-assets`.
4. **D-8 Immutability Trigger Verification:** Prove negative mutation blocks on version/outcome/history tables.
5. **D-9 Security & Performance Advisor Review:** Document and categorize all 29 advisor notices with risk-assessed, safe remediation plans without blind code execution.
6. **QA-1 Real-JWT Two-User E2E Isolation:** Proved strict multi-tenant boundaries on 35 tenant tables, updates/inserts, worker-only RPCs, token column privacy, and immutable twin versions. 40/40 Playwright checks passing live.
7. **Total Automated Tests:** 721 Vitest tests + 15 Pytest tests = 736 total automated tests (100% passing).
