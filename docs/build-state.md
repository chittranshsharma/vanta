# Vanta Build State

## Current status (2026-08-23)

Tickets 2.1, 2.2, 3.1, 3.2, 4.1, 4.2 complete. Ticket 5.0 (model gateway foundation) authored locally, patched during audit, **not deployed**. Phase 0 repository audit complete (`docs/fable-audit.md`).

Verified locally on 2026-08-23:

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | clean |
| `npm test` | 437 passed / 437, 34 suites |
| `pytest` (services/analysis-worker) | 15 passed |
| `npm run test:e2e` | 30 skipped with reason (no staging credentials); suite authored for QA-1 |
| `npm run typecheck:worker` | clean |
| `npm run build` | clean; largest chunk 240 kB (75 kB gzip), panels code-split |
| Browser smoke (dev server) | landing renders; auth dialog exposes `role="dialog"`, labelled close, Escape closes; workspace shell walked in demo mode (Decision Room ladder, Setup and status, Experiments, Test windows) with no console errors |

Access boundary this phase: **repository only**. No Supabase dashboard, MCP, SQL, deploy, or secret access. Every database statement below is static review of the committed SQL; live state is unverified.

## Migration state

| Migration | Repository | Live (per prior agents; unverified here) | Notes |
|---|---|---|---|
| `20260822000001_auth_workspaces` | committed | reported applied | RLS + 13 policies, helper functions, onboarding trigger |
| `20260822000002_brand_brain` | committed | reported applied | **No RLS in file.** 8 tables. |
| `20260822000003_evidence_layer` | committed | reported applied | RLS + 12 policies, composite FK, connected-status trigger |
| `20260822000004_creative_intake` | committed | reported applied | RLS + 12 policies, storage bucket + 4 object policies |
| `20260822000005_creative_twin_expansion` | committed | reported applied | RLS + 12 policies, immutability trigger, composite FKs |
| `20260822000006_secure_twin_correction_rpcs` | committed | reported applied | Hardened RPCs, search_path, revokes |
| `20260822000007_brand_brain_rls` | **committed, PENDING LIVE APPLY** | not applied | RLS + 30 policies for the 8 Brand Brain tables. Idempotent. Apply per `docs/supabase-deferred-validation.md` D-1. |
| `20260822000008_bind_created_by` | **committed, PENDING LIVE APPLY** | not applied | INSERT policies bind `created_by`/`started_by` to `auth.uid()` on 15 tables. Apply after 007 (D-2). |
| `20260822000009_composite_tenant_fks` | **committed, PENDING LIVE APPLY** | not applied | Composite FKs for `creative_twins.asset_id`, `ingestion_runs.asset_id`, `metric_definitions.source_id`. Pre-check D-3 first. |
| `20260822000010_model_task_runs` | **committed, PENDING LIVE APPLY** | not applied | Append-only model run records (Upgrade A / Ticket 5.1). D-4 step 8. |
| `20260822000011_jobs` | **committed, PENDING LIVE APPLY** | not applied | Durable job records + worker/member RPCs (Upgrade C). D-11. |
| `20260822000012_derived_artifacts` | **committed, PENDING LIVE APPLY** | not applied | Asset -> artifact lineage, retention sweeper (Upgrade D). D-12. |
| `20260822000013_embeddings` | **committed, PENDING LIVE APPLY** | not applied | pgvector store, SECURITY INVOKER candidate search, coverage (Upgrade E). D-13. |
| `20260822000014_connector_accounts` | **committed, PENDING LIVE APPLY** | not applied | Consent model, encrypted tokens, public view, request/revoke RPCs (Upgrade F). D-14. |
| `20260822000015_workspace_quotas` | **committed, PENDING LIVE APPLY** | not applied | Atomic daily quotas, audit summary (Upgrade G). D-15. |
| `20260822000016_experiments` | **committed, PENDING LIVE APPLY** | not applied | Experiments + append-only observed outcomes with source citability and ambiguity flag, transition guard trigger. D-16. |
| `20260822000017_post_observations` | **committed, PENDING LIVE APPLY** | not applied | Observed posting history, partial unique index for re-imports, coverage function. D-17. |

Do not re-apply 001-006. Apply 007 through 017 in order, only with user approval.

## Test suite (34 files, 437 tests; plus 15 pytest, 30 Playwright authored)

Per-upgrade breakdown lives in `docs/upgrade-reviews.md`. Core suites:

| File | Tests | Covers |
|---|---:|---|
| `src/lib/migrations.test.ts` | 121 | Static SQL contract: every table enables RLS, every policy tenant-scoped, INSERT policies bind the actor column, snapshot tables deny UPDATE/DELETE, SECURITY DEFINER functions set search_path, RPCs revoke PUBLIC/anon, storage policies use the defensive helper, composite FKs present (including 009 upgrades) |
| `src/lib/creativeIntake.test.ts` | 23 | Intake validators, SHA-256, CSV headers, known gaps |
| `supabase/functions/model-gateway/tasks/claimGroundingAudit.test.ts` | 19 | Ticket 5.1 output contract: allowed-ID citation checks, per-verdict rules, fail-closed whole-response rejection, task not yet allowlisted |
| `supabase/functions/model-gateway/guards.test.ts` | 23 | Body size by bytes, field whitelist, UUID/task allowlist, fail-closed rate limit, audit row shape, CORS never wildcard, output schema |
| `src/lib/creativeTwin.test.ts` | 13 | Scene parsing, WPM, claim extraction |
| `src/lib/creativeDoctor.test.ts` | 12 | Diagnostic rules, matrix derivation |
| `src/lib/sourceRegistry.test.ts` | 12 | Citability and freshness |
| `src/lib/modelGateway.test.ts` | 9 | Client adapter fail-closed paths |
| `src/lib/auth.test.ts` | 8 | Unconfigured fail-closed and configured pass-through, mocked client |
| `src/lib/workspaceOverview.test.ts` | 6 | Read failures reported, not masked as empty; absent tables become null counts, not errors |
| `src/lib/evidence.test.ts` | 3 | Numeric claim gate |

Removed: `src/lib/rls.test.ts` (8 tautologies).

## Changes in this phase

- Audit: `docs/fable-audit.md`, `docs/supabase-deferred-validation.md`, `docs/model-gateway-deployment-readiness.md`.
- P0-1: `20260822000007_brand_brain_rls.sql` authored.
- Gateway: extracted `guards.ts`; audit rows now include `resource_type`/`resource_id` (previous inserts violated NOT NULL and silently failed, so no invocation was ever audited and the limiter never counted); rate limiter fails closed; body size checked on bytes read, not `Content-Length`; 500 path no longer echoes internal error text; `audit_write_failed` surfaced in responses.
- Client: `Modal.tsx` (dialog semantics, focus trap, Escape, reduced motion) used by auth, new-workspace, intake, scene-edit, claim-edit dialogs; `workspaceOverview.ts` distinguishes read failure from empty workspace with retry; Source Registry forms surface insert/update errors; Intake and Source Registry error states have Retry; panels code-split with `React.lazy`; Tailwind v4 utilities layer installed so the Twin/Matrix/Doctor panels render styled (see ADR-011).
- Tooling: ESLint flat config, `npm run verify`, GitHub Actions CI, `@types/node`, vitest include covers the Edge Function tests.
- Hygiene: duplicate docs removed, agent scaffolding moved to `docs/archive/`, tracked zip removed, lockfile noise reverted.
- Phase 2: migrations 008 (actor binding) and 009 (composite FKs) authored, PENDING LIVE APPLY, with 21 static assertions.
- Ticket 5.1: design doc `docs/ticket-5.1-claim-grounding-audit.md` and pure validator `supabase/functions/model-gateway/tasks/claimGroundingAudit.ts` (19 tests). Not wired; allowlist unchanged.
- P2-7: `App.tsx` (972 lines) split into `LandingPage.tsx`, `Workspace.tsx`, `AuthModal.tsx`; `App.tsx` is now the 121-line shell. Lint and typecheck clean on first pass; no behavior change.
- Roadmap upgrades A through G built as repository-level code with contracts, tests, migrations 010-015, and per-upgrade reviews (`docs/upgrade-reviews.md`). Runtimes authored and typechecked, none deployed: Edge Function (`supabase/functions/model-gateway`), Node job worker (`services/job-worker`), Python analysis service (`services/analysis-worker`). Shared pure modules in `shared/`. QA-1 suite in `e2e/`. Runbook in `docs/operations-runbook.md`.

## Product build slices (2026-08-23, master prompt Phase B/C)

```
Slice: Workspace shell + Setup and status panel
Why now: navigation had no landmark or current-page semantics; the shell claimed "Supabase RLS active" to signed-out users; nothing showed what the build is wired for.
In scope: <nav aria-label>, aria-current, labelled icon buttons, PANEL_TITLES registry, SetupStatus panel (static config rows + explicit gateway probe), honest Creative Council copy.
Out of scope: gateway deployment.
Data/security effect: none; probe sends workspace id + task name only.
Acceptance checks: configStatus tests (4); typecheck; lint; browser smoke.
Live verification deferred: gateway probe result against a deployed function.
```

```
Slice: Source connectors + Test-window planning panels
Why now: Upgrade F shipped contracts with no UI; publishing intelligence had no surface.
In scope: shared/connectors/providers.ts catalog (matches 014 CHECK list), ConnectorsPanel (flag connectors_panel) with access states and consent-intent request/revoke, PublishingPlanner with the four-step unlock ladder and zero-observation unknown state.
Out of scope: OAuth registration (F-1), observed history store.
Data/security effect: request_connector/revoke_connector RPCs only; no tokens in browser.
Acceptance checks: providers tests (3); typecheck; lint.
Live verification deferred: D-14.
```

```
Slice: Experiments and outcome calibration foundation
Why now: spec Phase C item 3; B-3 open.
In scope: shared/experiments/model.ts (readiness, outcome validation, calibration readiness, transitions; 8 tests), migration 016, src/lib/experiments.ts (typed errors; 2 tests), ExperimentsPanel with create modal, blockers list, status transitions, per-variant observation counts.
Out of scope: outcome import UI (CSV/connector), any reading or winner.
Data/security effect: two new tables, RLS + actor binding, append-only outcomes by policy and trigger, CHECK evidence_class = 'observed'.
Acceptance checks: migration contract tests now 29 tables; typecheck; lint.
Live verification deferred: D-16.
```

```
Slice: Agent workflow foundation + Jobs panel + G-3
Why now: spec Phase C item 4; jobs_panel flag existed with no panel; G-3 open.
In scope: shared/agents/graph.ts (role contracts, DAG validation with arbiter/reviewer invariants, run transitions, retry policy, runtime gate; 7 tests), AgentWorkflowPanel (no run button; unavailable with reasons), JobsPanel (flag jobs_panel), consume_quota('job_enqueue') before enqueue, fail closed.
Out of scope: agent task types on the gateway, worker deployment.
Data/security effect: one extra RPC call per enqueue.
Acceptance checks: tests; typecheck; lint.
Live verification deferred: D-11, D-15.
```

```
Slice: Form accessibility and copy
In scope: Source Registry forms get aria-describedby to their error text and aria-busy; Brand Brain save errors render inline instead of replacing the panel (entries preserved); em dashes removed from UI copy.
Acceptance checks: typecheck; lint; full suite.
```

```
Slice: Outcome import
Why now: experiments could be defined but never populated, so calibration readiness was permanently theoretical.
In scope: shared/experiments/outcomeImport.ts (RFC4180 reader, strict number parse, ambiguous-date flagging, plan builder; 18 tests), migration 016 gains source_citability / date_ambiguous / import_note, importOutcomes client, OutcomeImportModal (source, mapping, reviewed plan, then write).
Out of scope: connector sync, any reading of the result.
Data/security effect: inserts into experiment_outcomes only, actor-bound, append-only; source deletion is RESTRICTed while outcomes cite it.
Acceptance checks: 18 importer tests, 5 new migration contract assertions, typecheck, lint, full suite.
Live verification deferred: D-16.
```

```
Slice: Gateway probe result shared with capability gates
In scope: SetupStatus reports its probe result upward; Workspace holds it; AgentWorkflowPanel consumes it instead of hardcoded "unknown".
Data/security effect: none.
```

```
Slice: Observed posting history
Why now: the test-window planner had no input and could only ever say unknown.
In scope: migration 017 (post_observations, partial unique index on external post id, admin-only delete, immutable rows, posting_history_coverage SECURITY INVOKER), shared/publishing/history.ts (import plan requiring a clock time, dedupe, window derivation excluding unverified-source rows; 5 tests), postHistory client, HistoryImportModal, PublishingPlanner rewritten to derive candidates from real rows.
Out of scope: connector-sourced history, timezone-aware local windows (buckets are UTC and labelled UTC).
Acceptance checks: 4 new migration contract assertions, typecheck, lint, full suite (430).
Live verification deferred: D-17.
```

```
Slice: Decision Room readiness ladder and panel truthfulness
Why now: the guided card stopped at "connect sources" and ignored twins, metrics, experiments, and history; in a demo session the header named a panel while the body silently rendered the Decision Room.
In scope: src/lib/decisionRoom.ts (pure 8-step ladder, one "next", blocked steps name the pending migration; 5 tests), workspaceOverview gains counts with null for absent tables (2 new tests), Decision Room renders the ladder and an honest hero, PanelUnavailable state for panels that need a signed-in workspace, a selected twin, or a flag.
Out of scope: approved-claim count (needs a brand id round trip; the ladder shows 0 rather than guessing).
Data/security effect: five extra head-count queries per overview load.
Acceptance checks: 437 tests, typecheck, lint, build; browser walk-through of Decision Room, Setup and status, Experiments, Test windows with no console errors.
Live verification deferred: counts against a real project (D-16, D-17).
```

## Supabase project (from prior state; unverified this phase)

- Project ref: `ujxrapbhiedkwleccvqw`
- Anon key in local `.env` (ignored by git)
- Storage bucket `workspace-assets` (private)

## Active constraints

- Never fabricate metrics, AI outputs, social data, or source connections.
- No `GROQ_API_KEY` or service-role key in browser code.
- Do not re-apply migrations 001-006. Apply 007-017 only with approval.
- Ask before: pushing, deploying, destructive migrations, paid resources, secrets.

## Next

1. Operator applies 007 through 016 in order with the pre-checks in `docs/supabase-deferred-validation.md` (D-1 to D-17), then regenerates types and removes the `never` casts in `src/lib/jobs.ts`, `connectors.ts`, `retrieval.ts`, `experiments.ts`, `postHistory.ts`.
2. Ticket 5.0 deployment on explicit approval (`docs/model-gateway-deployment-readiness.md`), then `ENABLED_TASKS=claim_grounding_audit` and `VITE_FLAGS=claim_grounding_panel` once D-4 step 8 passes.
3. Worker and analysis service deployment (operator decision: host, service-role key handling, ffprobe availability).
4. Open review items: G-2 (remove quota fallback after D-15), E-3 (embedding provider choice), F-1 (provider OAuth apps), D-2 (thumbnails/frames), B-3 (calibration tables).
5. QA-1 run against a staging project before any external user.

6. Git identity is unset in this clone (`git config user.name` and `user.email` empty). No commit can be made until the user configures it; all work above is uncommitted.
