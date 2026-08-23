# Vanta Build State

## Current status (2026-08-23)

Tickets 2.1, 2.2, 3.1, 3.2, 4.1, 4.2 complete. Ticket 5.0 (model gateway foundation) authored locally, patched during audit, **not deployed**. Phase 0 repository audit complete (`docs/fable-audit.md`).

Verified locally on 2026-08-23:

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | clean |
| `npm test` | 503 passed / 503, 37 suites |
| `pytest` (services/analysis-worker) | 15 passed |
| `npm run test:e2e` | 30 skipped with reason (no staging credentials); suite authored for QA-1 |
| `npm run typecheck:worker` | clean |
| `npm run build` | clean; largest chunk 249 kB (78 kB gzip), panels code-split |
| Browser smoke (dev server) | landing renders; auth dialog exposes `role="dialog"`, labelled close, Escape closes; workspace shell walked in demo mode (Decision Room ladder, Setup and status, Experiments, Test windows) with no console errors |

Access boundary this phase: **Read-only live inspection completed on 2026-08-23**. Verified: PostgreSQL 17.6, Plan: Free (no PITR / automated backups), 21 public tables with RLS enabled, 0 actor binding violations, 0 cross-tenant FK violations.

## Migration state

| Migration | Repository | Live (Verified 2026-08-23) | Notes |
|---|---|---|---|
| `20260822000001_auth_workspaces` | committed | **Applied** | Profiles, workspaces, members, audit events (RLS on) |
| `20260822000002_brand_brain` | committed | **Applied** | 8 Brand Brain tables (RLS verified on live) |
| `20260822000003_evidence_layer` | committed | **Applied** | Source registry, evidence items, metric definitions |
| `20260822000004_creative_intake` | committed | **Applied** | Assets, ingestion runs, twins, storage policies |
| `20260822000005_creative_twin_expansion` | committed | **Applied** | Scenes, claims, twin versions, immutability trigger |
| `20260822000006_secure_twin_correction_rpcs` | committed | **Applied (SQL live)** | Hardened RPCs verified in `pg_proc` (auth.uid(), search_path, revokes active). Not in `schema_migrations` table ledger as applied via SQL editor directly. |
| `20260822000007_brand_brain_rls` | committed | **Applied** | RLS + 32 policies + 7 indexes for Brand Brain tables. Verified live 2026-08-23. |
| `20260822000008_bind_created_by` | committed | **Applied** | Enforces `created_by = auth.uid()` on 15 tables (`started_by` on `ingestion_runs`). Verified live 2026-08-23. |
| `20260822000009_composite_tenant_fks` | committed | **Applied** | Composite FKs for `creative_twins`, `ingestion_runs`, `metric_definitions`. Verified live 2026-08-23. |
| `20260822000010_model_task_runs` | committed | **Applied** | Append-only model run records (Upgrade A / Ticket 5.1). Verified live 2026-08-23. |
| `20260822000011_jobs` | committed | **Applied** | Durable job records + worker/member RPCs (Upgrade C). Verified live 2026-08-23. |
| `20260822000012_derived_artifacts` | committed | **Applied** | Asset -> artifact lineage, retention sweeper (Upgrade D). Verified live 2026-08-23. |
| `20260822000013_embeddings` | committed | **Applied** | pgvector store, SECURITY INVOKER candidate search (Upgrade E). Verified live 2026-08-23. |
| `20260822000014_connector_accounts` | committed | **Applied** | Consent model, encrypted tokens, public view (Upgrade F). Verified live 2026-08-23. |
| `20260822000015_workspace_quotas` | committed | **Applied** | Atomic daily quotas, audit summary (Upgrade G). Verified live 2026-08-23. |
| `20260822000016_experiments` | committed | **Applied** | Experiments + append-only observed outcomes. Verified live 2026-08-23. |
| `20260822000017_post_observations` | committed | **Applied** | Observed posting history, partial unique index. Verified live 2026-08-23. |

All migrations 001–017 applied and verified live on Supabase project `ujxrapbhiedkwleccvqw`.

## Test suite (37 files, 503 tests; plus 15 pytest, 30 Playwright authored)

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
| `src/lib/workspaceOverview.test.ts` | 12 | Read failures reported, not masked as empty; absent tables become null counts, not errors; approved-claim count distinguishes no brand, observed zero, and unreadable |
| `src/lib/decisionRoom.test.ts` | 11 | Ladder ordering and blocked steps; approved-claim copy never states a count it does not have and never implies performance |
| `src/lib/modelGateway.test.ts` | 9 | Client adapter fail-closed paths |
| `src/lib/postHistory.test.ts` | 9 | Fail-closed reads; batch delete scoped by workspace and batch, zero rows treated as possible permission denial, audit row shape, audit-write failure reported |
| `shared/publishing/batches.test.ts` | 9 | Batch grouping counts only stored rows, orders by instant across offsets, keeps unbatched rows separate |
| `shared/publishing/history.test.ts` | 11 | Import plan requires a clock time and dedupes; window buckets use wall-clock time in a named IANA zone, honour the offset in force on each date, and report the zone actually used |
| `shared/media/artifacts.test.ts` | 18 | Thumbnail and frame-sample `features` contracts (frames require `at_seconds`); probe facts distinguish recorded absence of audio from silence; readiness separates not-applicable, no producer in build, none produced yet, unreadable rows, and ready |
| `src/lib/auth.test.ts` | 8 | Unconfigured fail-closed and configured pass-through, mocked client |
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
Out of scope: connector-sourced history, timezone-aware local windows (buckets are UTC and labelled UTC). Superseded by the local-timezone bucket slice below.
Acceptance checks: 4 new migration contract assertions, typecheck, lint, full suite (430).
Live verification deferred: D-17.
```

```
Slice: Decision Room readiness ladder and panel truthfulness
Why now: the guided card stopped at "connect sources" and ignored twins, metrics, experiments, and history; in a demo session the header named a panel while the body silently rendered the Decision Room.
In scope: src/lib/decisionRoom.ts (pure 8-step ladder, one "next", blocked steps name the pending migration; 5 tests), workspaceOverview gains counts with null for absent tables (2 new tests), Decision Room renders the ladder and an honest hero, PanelUnavailable state for panels that need a signed-in workspace, a selected twin, or a flag.
Out of scope: approved-claim count (needs a brand id round trip; the ladder shows 0 rather than guessing). Superseded by the approved-claim slice below.
Data/security effect: five extra head-count queries per overview load.
Acceptance checks: 437 tests, typecheck, lint, build; browser walk-through of Decision Room, Setup and status, Experiments, Test windows with no console errors.
Live verification deferred: counts against a real project (D-16, D-17).
```

```
Slice: Typed client cleanup against the generated schema
Why now: the clients reached the live schema through `as unknown as` casts written while the types were stale, so every read asserted a shape nothing had checked.
In scope: src/lib/rows.ts (narrow / jsonObject / jsonObjectArray / isMissingRelationError, JsonObject for jsonb writes; 13 tests), runtime value lists beside the domain unions in shared/jobs/policy.ts, shared/experiments/{model,outcomeImport}.ts and shared/connectors/access.ts, and per-client boundary readers in jobs.ts, experiments.ts, postHistory.ts, connectors.ts, retrieval.ts, auth.ts, creativeTwin.ts, workspaceOverview.ts.
Out of scope: test doubles in modelGateway.test.ts and telemetry.test.ts (fetch and Error fakes, not schema escapes).
Why runtime checks and not types: generated types cannot express CHECK constraints, so every constrained column arrives as `string` and `Enums` is empty. Each client now narrows against the shared runtime list and returns the reason a row could not be read, which surfaces as "the database schema is ahead of this build" instead of a nearby value the client happens to understand.
Correctness fixed, not just tidied: `connector_accounts_public` is a view, so Postgres reports every column nullable. The old cast claimed id, status and granted_scopes were present; a row missing identity is now rejected and absent scope arrays default to empty, which makes `describeAccess` report missing consent rather than render a working connection.
One documented widening remains: `sceneTimingArgs`, because migration 20260822000006 declares the three scene timings NUMERIC/NUMERIC/INT and SQL parameters accept NULL while codegen reports them non-null.
Data/security effect: none. No query, policy or payload changed.
Acceptance checks: 450 tests, lint, typecheck, worker typecheck, production build.
Live verification deferred: authenticated browser walk-through of the affected panels (Antigravity).
```

```
Slice: Approved Brand Codex claim count in the Decision Room ladder
Why now: the ladder printed 0 approved claims regardless of the codex, which is a statement about the data rather than a placeholder a reader can tell apart from a real zero.
In scope: `ApprovedClaimCount` union and `describeApprovedClaims` in src/lib/decisionRoom.ts (loading / no_brand / unreadable / counted; 6 new tests), a brand-scoped head count in workspaceOverview.ts (6 new tests), Workspace.tsx passes `loading` while the overview is in flight instead of a stale number.
What counts as approved: both approval axes must agree. `claim_type = 'approved'` says the brand permits the claim and `review_status = 'approved'` says the review finished; a claim that is one but not the other is still in progress and is not counted. Both columns collapse to `string` in the generated types, so the filter is the contract.
Out of scope: per-claim drill-down, and any statement about how an approved claim performs. The copy names approval as a governance decision and says it is not proof of performance.
Data/security effect: one extra head-count query on `brand_claims` per overview load, filtered by `workspace_id` and `brand_id` together so a relaxed policy alone could not widen it. No writes. A missing relation stays out of the error banner (pending migration); a permission denial is reported once, as unreadable, never as zero.
Acceptance checks: 462 tests, lint, typecheck, worker typecheck, production build.
Live verification deferred: the count against a real codex with mixed review states (Antigravity).
```

```
Slice: Posting-history import-batch management
Why now: imported observations were only visible as an aggregate count, so an operator who imported the wrong file had no way to see what landed and no way to remove it, while migration 017 already anticipated batch deletion in its immutability trigger message.
In scope: shared/publishing/batches.ts (`groupImportBatches`, pure, newest import first; 9 tests), `import_batch_id` and `created_at` on `PostObservationRow`, `deleteImportBatch` in src/lib/postHistory.ts (8 tests), a batch list plus a confirmation dialog in PublishingPlanner.tsx, which now takes `isAdmin`, and a `.destructive` button style.
Why deletion is safe to offer: nothing in the schema references `post_observations` — no migration declares a foreign key to it and the generated types list no inbound relationship — so removing a batch cascades to no other evidence. Authority is the database's: migration 017 grants DELETE only through `public.is_workspace_admin_or_owner(workspace_id)`, and the client scopes the statement by `workspace_id` and `import_batch_id` together.
Zero rows is not success: when an RLS policy's USING clause is false Postgres removes zero rows and returns no error, so an empty result is reported as "already gone, or restricted to owners and admins" rather than as a completed deletion. The removal is written to the append-only `audit_events` log with the batch id and the count the database confirmed; when that insert fails the UI says the rows were removed and the audit entry was not written, instead of reporting a clean success.
Missing contracts, documented rather than invented:
- There is no batch registry table. A batch exists only as the id stamped on rows that were inserted, so an import that stored nothing leaves no trace and a failed or fully-rejected import cannot be listed. The UI states this instead of showing a "failed" batch it cannot substantiate.
- The client-side validation summary (rejected line numbers and reasons), the file name, and the row count the file was believed to contain are never persisted. Only rows still present can be counted, so no batch shows an expected-versus-stored comparison.
- There is no atomic `delete_post_observation_batch(p_workspace_id, p_batch_id)` RPC, so the delete and its audit row are two statements and cannot share a transaction. Closing any of these three gaps needs a new migration and is out of scope for a repository-only slice.
Out of scope: restoring a deleted batch, per-row deletion, and connector-sourced history.
Data/security effect: one scoped DELETE on `post_observations` behind the existing admin-only policy, plus one append-only audit insert. No policy, function, or migration changed.
Acceptance checks: 479 tests, lint, typecheck, worker typecheck, production build.
Live verification deferred: a real admin-versus-member delete attempt and the resulting audit row (Antigravity, alongside D-17).
```

```
Slice: Local-timezone test-window buckets
Why now: the planner bucketed posts by UTC hour and labelled the result "09:00 UTC". Nobody publishes on a UTC clock, so the one number an operator would act on named a time they never posted at, and any bucket straddling a UTC day boundary was also filed under the wrong weekday.
In scope: `WindowObservation` carries `hour` (wall-clock) instead of `hour_utc`; `toWindowObservations(rows, timeZone?)` buckets in a named IANA zone and returns the zone it actually used; `runtimeTimeZone()` reads the device zone; `describeWindow(w, timeZone)` names the zone as part of the claim; `suggestTestWindows` keeps the same ranking but is now explicitly zone-agnostic, since the zone is resolved before it is called.
How the wall clock is derived: `Intl.DateTimeFormat` with an explicit `timeZone` and `hourCycle: "h23"`, read through `formatToParts` numerically. The weekday comes from the local calendar date rather than a formatted day name, so no locale's spelling or ordering can move a bucket, and a zone that observes daylight saving buckets by the offset in force on each individual date rather than by one offset applied to the whole history.
Unrecognized zone names fail loudly rather than silently: `Intl` throws on a bad zone, so the formatter is built once inside a try, falls back to UTC, and the fallback is reported through the returned `timeZone`, which is what the UI labels the hours with. A label can therefore never name a zone the numbers are not in.
UI honesty: the panel states which zone the hours are in, that each post was placed in the hour its own clock read, that a DST-observing zone makes the same bucket a different absolute time across the year, and that viewing from another zone regroups the buckets — so a window is a claim about the operator's posting clock, not about an audience's local time.
Out of scope: a per-workspace stored timezone (there is no column for one, so the device zone is the only zone the repository can truthfully use), audience-local windows (no audience-location evidence exists), and connector-sourced history.
Data/security effect: none. Read-side derivation only; no query, policy, or column changed.
Acceptance checks: 485 tests (6 new in `shared/publishing/history.test.ts`), lint, typecheck, worker typecheck, production build.
Live verification deferred: none required; the derivation is pure and covered by fixed-instant tests across UTC, Asia/Kolkata, and America/New_York in both DST phases.
```

```
Slice: Thumbnail and frame-sample contract with honest media readiness
Why now: `thumbnail` and `frame_sample` are legal `artifact_kind` values in migration 012, but nothing in this repository produces or reads either, and Creative Intake said nothing about it. An asset detail screen that silently omits a preview reads as "this asset has no thumbnail" when the truth is "this build cannot make one".
In scope: `shared/media/artifacts.ts` states the per-kind `features` contract and resolves per-capability readiness; `src/lib/artifacts.ts` reads `derived_artifacts` rows at the boundary; `src/components/MediaReadiness.tsx` renders the result inside the Creative Intake asset detail column.
Contract, so a future producer has something to satisfy: a thumbnail is stored image bytes (`storage_bucket`, `storage_path`, a displayable `mime_type`) plus `features.width` and `features.height` in pixels — a producer that does not record what it rendered has not recorded enough to cite. A frame sample is all of that plus `features.at_seconds`, because an image with no timestamp cannot be attributed to a moment in the source; `features.frame_index` is optional. `media_metadata` matches what the worker's ffprobe parser already writes.
Five distinct absence states, not one "no data": `not_applicable` (a text-only asset holds no bytes to probe, so nothing is missing), `no_producer` (nothing in this build writes the kind, so no queue will ever fill it — a missing capability), `none_produced` (a producer exists and has not run for this asset — pending), `unreadable` (rows exist and none satisfies the contract, listing every reason), and `ready`. `PRODUCERS_IN_BUILD` is what separates the first two: `media_metadata` maps to `media_worker`, every other kind maps to an empty list.
No producer exists and none was invented. There is no `media_thumbnail` or `frame_sample` job type in `shared/jobs/policy.ts`, and adding a real producer needs an image encoder in the worker plus a bucket write path; that is a separate slice, recorded in `todo.md` rather than faked.
Never a placeholder image: an `<img>` renders only where a stored row proved bytes and pixel dimensions, its link is signed for `workspace-assets` and expires, and a row recorded in any other bucket is reported instead of fetched. Frame samples are listed by the second they were taken from rather than each fetching bytes, since signing N URLs for a capability with no producer is speculative work.
Client posture: read-only. Migration 012 restricts member INSERT to `producer = 'deterministic'`, forbids UPDATE, and limits DELETE to owners and admins, so there is nothing here for the browser to write and no writer was added. A missing `derived_artifacts` relation is reported as migration 012 not being applied, separately from a read failure.
Out of scope: a thumbnail or frame producer, video byte intake (`VIDEO_INTAKE_ENABLED` is false, which is why frames report `not_applicable` today), and transcripts.
Data/security effect: one new read query scoped by both `workspace_id` and `asset_id`. No policy, function, column, or migration changed.
Acceptance checks: 503 tests (18 new in `shared/media/artifacts.test.ts`), lint, typecheck, worker typecheck, production build.
Live verification deferred: rendering a real signed thumbnail end to end, which needs a producer that does not exist yet and an authenticated browser session (Antigravity).
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

1. Migrations 007 through 017 are applied and the types are regenerated from the live schema (commit `8313539`); the temporary `never` casts in `src/lib/jobs.ts`, `connectors.ts`, `retrieval.ts`, `experiments.ts` and `postHistory.ts` are gone. Remaining pre-checks live in `docs/supabase-deferred-validation.md` (D-5 to D-9).
2. Ticket 5.0 deployment on explicit approval (`docs/model-gateway-deployment-readiness.md`), then `ENABLED_TASKS=claim_grounding_audit` and `VITE_FLAGS=claim_grounding_panel` once D-4 step 8 passes.
3. Worker and analysis service deployment (operator decision: host, service-role key handling, ffprobe availability).
4. Open review items: G-2 (remove quota fallback after D-15), E-3 (embedding provider choice), F-1 (provider OAuth apps), D-2 (thumbnails/frames), B-3 (calibration tables).
5. QA-1 run against a staging project before any external user.

6. Git identity is configured in this clone and slices are committed locally. Nothing is pushed.
