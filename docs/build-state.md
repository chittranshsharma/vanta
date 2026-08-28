# Vanta Build State

## Current status (2026-08-23)

Tickets 2.1, 2.2, 3.1, 3.2, 4.1, 4.2 complete. Ticket 5.0 (model gateway foundation) authored locally, patched during audit, **not deployed**. Phase 0 repository audit complete (`docs/fable-audit.md`).

Verified locally on 2026-08-23:

| Check | Result |
|---|---|
| `npm run lint` | 0 errors, 0 warnings |
| `npm run typecheck` | clean |
| `npm test` | 610 passed / 610, 42 suites |
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

## Test suite (42 files, 610 tests; plus 15 pytest, 30 Playwright authored)

Per-upgrade breakdown lives in `docs/upgrade-reviews.md`. Core suites:

| File | Tests | Covers |
|---|---:|---|
| `src/lib/migrations.test.ts` | 121 | Static SQL contract: every table enables RLS, every policy tenant-scoped, INSERT policies bind the actor column, snapshot tables deny UPDATE/DELETE, SECURITY DEFINER functions set search_path, RPCs revoke PUBLIC/anon, storage policies use the defensive helper, composite FKs present (including 009 upgrades) |
| `src/lib/creativeIntake.test.ts` | 27 | Intake validators, SHA-256, CSV headers, known gaps; an unread asset or twin list is never a workspace that has ingested nothing |
| `supabase/functions/model-gateway/tasks/claimGroundingAudit.test.ts` | 19 | Ticket 5.1 output contract: allowed-ID citation checks, per-verdict rules, fail-closed whole-response rejection, task not yet allowlisted |
| `supabase/functions/model-gateway/guards.test.ts` | 23 | Body size by bytes, field whitelist, UUID/task allowlist, fail-closed rate limit, audit row shape, CORS never wildcard, output schema |
| `src/lib/creativeTwin.test.ts` | 13 | Scene parsing, WPM, claim extraction |
| `src/lib/creativeDoctor.test.ts` | 12 | Diagnostic rules, matrix derivation |
| `src/lib/sourceRegistry.test.ts` | 21 | Citability and freshness; registry, evidence and metric reads report a failure class instead of an empty registry; a refused source lookup is never an unregistered source |
| `src/lib/rows.test.ts` | 41 | Boundary narrowing and jsonb reads; failure classification including the `57014` server-side-abort exclusion; `readRows` keeps a failed read distinct from a genuinely empty one; retry is offered only for `offline` and `failed` |
| `src/lib/workspaceOverview.test.ts` | 12 | Read failures reported, not masked as empty; absent tables become null counts, not errors; approved-claim count distinguishes no brand, observed zero, and unreadable |
| `src/lib/decisionRoom.test.ts` | 11 | Ladder ordering and blocked steps; approved-claim copy never states a count it does not have and never implies performance |
| `src/lib/modelGateway.test.ts` | 9 | Client adapter fail-closed paths |
| `src/lib/postHistory.test.ts` | 9 | Fail-closed reads; batch delete scoped by workspace and batch, zero rows treated as possible permission denial, audit row shape, audit-write failure reported |
| `shared/publishing/batches.test.ts` | 9 | Batch grouping counts only stored rows, orders by instant across offsets, keeps unbatched rows separate |
| `shared/publishing/history.test.ts` | 11 | Import plan requires a clock time and dedupes; window buckets use wall-clock time in a named IANA zone, honour the offset in force on each date, and report the zone actually used |
| `shared/media/artifacts.test.ts` | 18 | Thumbnail and frame-sample `features` contracts (frames require `at_seconds`); probe facts distinguish recorded absence of audio from silence; readiness separates not-applicable, no producer in build, none produced yet, unreadable rows, and ready |
| `shared/connectors/outcomeSync.test.ts` | 16 | Outcome sync reports no sync path for every provider in this build and offers no next input; connector access still resolved so a revoked account stays visible; a metric-free feed is not an outcome source; with a sync path present, setup-required, blocked, stale, and ready are distinguished; connector source state is never `available` while nothing can sync |
| `src/lib/auth.test.ts` | 8 | Unconfigured fail-closed and configured pass-through, mocked client |
| `src/lib/brandBrain.test.ts` | 12 | Codex reads report a failure class instead of an empty codex; a refused read is never an absent brand; an unread claim list is never an empty grounding set; retry is invited only for a request that never arrived |
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

```
Slice: Connector outcome-sync capability and setup/blocked states
Why now: an experiment could declare `outcome_source = 'connector'`, and the panel then read that source as `available` whenever any analytics connector happened to be connected. Nothing in this build can fetch an outcome, so a connected account produced a readiness claim that was false in the one direction that matters: an experiment appeared able to conclude when no row could ever arrive.
In scope: `shared/connectors/outcomeSync.ts` resolves per-provider sync capability; `src/components/OutcomeSyncStatus.tsx` renders it; `ExperimentsPanel` derives an experiment's connector source state from that capability instead of from mere connection, and shows the same status in the create modal when connector sync is chosen.
Six states, so absence is never one word: `not_applicable` (a public feed carries no performance metrics, so it is not an outcome source at all), `not_implemented` (this build has no sync path), `setup_required` (a path exists and no connection has been established), `blocked` (a connection exists and cannot be used — revoked, errored, expired token, or short of scopes), `stale` (past the freshness window), and `ready`. `OUTCOME_SYNC_PROVIDERS_IN_BUILD` separates the build's own gap from the connector's, and is empty.
`not_implemented` outranks every connector state on purpose, and carries `nextInput: null`. Telling an operator to complete a consent flow that cannot produce a row is asking for work with no result. Connector access is still resolved and reported alongside, so a revoked or expired account stays visible rather than being hidden behind the missing feature.
Four independent absences, named rather than summarised as "not connected": no OAuth application is registered for any provider (F-1); no job type enqueues a sync and no worker handler writes `experiment_outcomes`; `experiment_outcomes.variant_twin_id` is NOT NULL and nothing records which external post carried which variant, so a fetched metric could not be attributed to a variant without inventing the link; and `experiment_outcomes.source_id` is NOT NULL, so a synced row would have nothing to cite. They are listed once per screen, not once per provider, because they are the same four everywhere. Clearing consent alone would still yield zero rows — the variant link is the decisive gap and it needs a migration.
No sync control was added. A button that cannot produce a row is worse than no button, so the panel states the gap and points at CSV import, which does work today.
Reuse over duplication: `describeAccess` still owns scope, expiry, and freshness logic; this module only decides whether the build can act on it, and splits setup from blocked using the connector's own status.
Out of scope: registering OAuth apps, a sync job type or handler, and the external-post-to-variant link table.
Data/security effect: none. No new query, policy, function, column, or migration; the panel already read `connector_accounts_public`, and tokens still never reach the browser.
Acceptance checks: 519 tests (16 new in `shared/connectors/outcomeSync.test.ts`), lint, typecheck, worker typecheck, production build.
Live verification deferred: none required; the module is pure and the connector branches are covered by passing an explicit implemented-provider set. Anything beyond that waits on F-1 and a migration.
```

```
Slice: Operational-state audit of the model-run, jobs, retrieval, and quota clients
Why now: four reads could not express the states an operator needs to act on. `fetchRetrievalCoverage` was dead code, so the product never said whether retrieval exists. No quota reader existed at all, so the only way to learn a daily limit was to hit it: an enqueue failed and named a budget nobody had been shown. `AgentWorkflowPanel` asserted "No run has ever happened in this workspace" without reading anything — an assertion about stored data presented as an observation. And permission-denied was absent from the vocabulary: `isMissingRelationError` existed, and nothing classified `42501`, `PGRST301`, or the `Access denied: not a workspace member` text the SECURITY DEFINER RPCs raise.
In scope: `src/lib/rows.ts` (`isPermissionDeniedError`, `classifyReadError`), new `src/lib/quotas.ts` and `src/lib/modelRuns.ts`, a rewritten `src/lib/retrieval.ts`, one static readiness row in `src/lib/configStatus.ts`, and the two panels that consume them (`JobsPanel`, `AgentWorkflowPanel`).
One shared classifier rather than four ad-hoc branches: `classifyReadError` returns `absent | denied | failed`, and it lives in the module that already owns boundary reads. "No rows" and "not allowed to see rows" must never render as the same thing, and a pending migration must never render as either. `denied` is checked before `absent` so an error naming both is not reported as a migration an operator should go and apply.
Quotas are read without being spent. `workspace_quotas` grants members SELECT, so the budget an enqueue would consume is now shown before the action. The default limits are not copied into TypeScript: a missing row reports `never_consumed` ("the limit is set on first use") because the numbers live in migration 015 and a copy would drift the moment an operator changed one. Seven states: `not_applied`, `denied`, `unreadable`, `never_consumed`, `reset_pending`, `available`, `exhausted`.
`reset_pending` is a real staleness boundary. A row whose `window_date` is an earlier day holds a counter that is not today's, and an exhausted yesterday must not read as an exhausted today. The comparison uses the UTC date because `consume_quota` compares against Postgres `CURRENT_DATE`; using the operator's local date would report a reset that has not happened.
A withheld count is not zero. `countModelRuns` uses a head count, so no model output reaches the browser, and a response with no error and no number reports `unreadable` rather than inventing the absence the panel exists to report. The panel now shows what was read, or says run history is unknown and why.
Retrieval states its absence instead of implying progress. "0 of 40 indexed" reads as an import under way, so `MISSING_RETRIEVAL_PIECES` names three independent gaps — no embedding provider is chosen (E-3), no job type or worker indexes anything, and nothing in the product reads a vector search — and `nothing_indexed` is distinct from nothing being indexable. The `Codex retrieval` readiness row is static, keeping `SetupStatus`'s promise that a row never turns green because a page loaded.
Copy corrected against the live ledger: migrations 010–017 are applied, so an absent relation means this environment is not the one they were applied to, and the affected strings now say that instead of "pending live apply". An unreachable quota table is not an unlimited one — `enqueueJob` consumes the budget first and fails closed — and the summary says so.
A refused job transition is reported as authorization, not as a broken read: the approve and cancel buttons are already role-gated, so a server refusal means the browser was wrong about the caller, and the message says only an owner or admin may approve.
Job status drift contract (`shared/jobs/policy.test.ts`): a frozen second copy of the permitted edge set, deliberately not derived from `TRANSITIONS`, since a test that reads the table it checks proves only that the table equals itself. It fails if a status gains no transition behaviour, if an illegal transition is accepted by either the table or `canTransition`, or if a terminal status becomes transitionable. Verified by mutation: all three drift cases were injected into `policy.ts` and each failed the suite.
Out of scope: a retrieval coverage widget (nothing consumes retrieval, so a live number would be speculative), a model-run history list (zero rows by construction, no consumer), any quota write, and any queue redesign.
Data/security effect: two new read queries (`workspace_quotas` and a `model_task_runs` head count, both scoped by `workspace_id`) and one existing SECURITY INVOKER RPC now actually called. No policy, function, column, or migration changed, and no write path was added.
Acceptance checks: 567 tests (48 new across `rows`, `quotas`, `modelRuns`, `retrieval`, `configStatus`, and the job policy contract), lint, typecheck, worker typecheck, production build.
Live verification deferred: the `denied` and `reset_pending` branches against a real non-member session and a counter left overnight, plus a real `retrieval_coverage` response — all need an authenticated browser session (Antigravity).
```

```
Slice: Error and recovery states across the Brand Brain read path
Why now: every Brand Brain read swallowed its error. `fetchBrandForWorkspace` logged and returned `null`, and the six list readers logged and returned `[]`, so a refused read, a dropped connection and an unwritten codex were indistinguishable. Two user-visible consequences followed. The panel rendered "No brand defined yet for this workspace" and offered to create a brand that may already exist, so the create would then fail on a uniqueness or policy check. And a failed claims read rendered as an empty grounding set, which is not an absence of information but a positive statement — "this brand claims nothing" — that changes what a variant is allowed to say. `BrandBrain.tsx` already had an error branch and a `bb-error-state` style for it; `setError` was only ever called with `null`, so the branch was dead code.
In scope: `src/lib/rows.ts` gains `isTransientReadError`, an `offline` member of `ReadFailure`, and `isRetryable`; `src/lib/brandBrain.ts` converts all seven fetchers to a `BrandRead<T>` result and adds `brandReadSummary`; `BrandBrain.tsx`, `CreativeTwinEditor.tsx` and `Workspace.tsx` report the failure instead of rendering an empty codex.
One helper at the boundary rather than seven call sites: `read()` turns a single PostgREST response into a `BrandRead`, keeping the failure class from `classifyReadError`. Converting all seven fetchers cost nothing in ripple — `fetchBrandCompetitors`, `fetchBrandTone` and `fetchBrandCompliance` have no callers outside the module, and `snapshotBrandCodex` does not call the fetchers internally.
Retryability is a contract, not a button that is always shown. `isRetryable` is true only for `offline` and `failed`. A denied read will be denied again and an absent relation stays absent, so offering "try again" for those spends the user's one action on an attempt guaranteed to fail the same way; the denied copy names the recovery that does apply ("ask an admin for access rather than retrying"). `unconfigured` is not retryable either, since no configuration changes from a button click.
`offline` is deliberately narrow. A bare `/timeout/` in the pattern classified `canceling statement due to statement timeout` (SQLSTATE `57014`) as offline, and the offline copy asserts "the request did not arrive, so nothing was changed" — false for a server-side abort, where Postgres received the query and did work. A test caught this during the slice; the pattern now matches only network-phase timeouts and a regression test pins `57014` as not transient. `denied` still outranks `offline`, so an expired JWT whose message happens to contain "failed to fetch" is reported as a session problem rather than a network one.
The codex fails as one object. Showing positioning while the claims are unknown would invite an approval decision on evidence that was never read, so one failed part fails the panel. Each of the three parallel reads is checked separately rather than through an aliased `??` chain, because narrowing does not propagate through an alias across three variables.
A written-but-unread outcome is reported as itself. When a manual snapshot succeeds and the version reread fails, the panel says "Snapshot saved, but the version list could not be reloaded" rather than presenting the whole action as failed — the user must not retry a write that already landed.
The Decision Matrix keeps its props. `Workspace.tsx` surfaces the grounding-claim read failure above the matrix and offers retry there, so claim coverage reads as unknown rather than absent without changing `DecisionMatrix`'s interface.
Out of scope: explicit `offline` branches in `quotas.ts`, `modelRuns.ts` and `retrieval.ts` — each already has an unreadable fallthrough that carries the platform message, and three new state unions would have grown three test matrices for no user-visible gain in this slice. Deduping the four local `Result<T>` types was also left alone; a local type in `brandBrain.ts` matches surrounding code rather than starting a cross-file refactor mid-slice.
Data/security effect: none. No new query, policy, function, column, or migration; the same seven reads run with the same workspace and brand scoping, and error text reaching the browser is the platform message that was already being written to the console.
Acceptance checks: 586 tests (19 new: 12 in `src/lib/brandBrain.test.ts`, 7 in `src/lib/rows.test.ts`), lint, typecheck, worker typecheck, production build.
Live verification deferred: the `denied` branch against a real non-member session and the `offline` branch against a genuinely dropped connection, both of which need an authenticated browser session (Antigravity). The classification itself is pure and covered by unit tests.
```

```
Slice: Fail-closed reads across Source Registry and Creative Intake
Why now: the same defect Brand Brain had, in the two panels that define what a workspace may cite and what it has ingested. All five readers — `fetchSourcesForWorkspace`, `fetchEvidenceItems`, `fetchMetricDefinitions`, `fetchWorkspaceAssets`, `fetchWorkspaceTwins` — logged their error to the console and returned `[]`. Both panels wrapped the calls in `try/catch`, but since the fetchers never threw, both error branches were dead code: a denied read, a dropped connection and an unwritten workspace all rendered as "0 sources · 0 evidence assertions" or as a workspace with no assets. Neither is a cosmetic difference. An empty evidence layer is a positive claim about what may be cited, and an empty asset list invites a re-upload of material that is already stored.
In scope: `src/lib/rows.ts` gains a shared `ReadResult<T>` (`ReadError`, `UNCONFIGURED_READ`, `readRows`, `readFailureSummary`, `isRetryableRead`); `sourceRegistry.ts` and `creativeIntake.ts` convert their five readers; `SourceRegistry.tsx`, `CreativeIntake.tsx`, `ExperimentsPanel.tsx` and `PublishingPlanner.tsx` report the failure class. Write paths, validators, ingest paths and both audit inserts are untouched.
One helper at the boundary, in the module that already owns the classifier. `readRows` turns a PostgREST response into a `ReadResult`, keeping the class from `classifyReadError`; `readFailureSummary(error, subject)` writes the one sentence, so the same five states are not phrased differently on each of the four screens. `subject` is a mid-sentence noun phrase, so no branch produces a sentence that starts lowercase. `isRetryableRead` exists separately from `isRetryable` because `unconfigured` is not a `ReadFailure` and is never retryable.
`brandBrain.ts` was deliberately not migrated onto the shared type. Its copy is codex-specific and its tests pin exact strings; the duplication is already filed in `todo.md` and folding it in mid-slice would have been a cross-file refactor for no user-visible gain.
Each panel fails as one posture, with a stated reason. Source Registry: showing sources while the evidence read failed would put a citability decision in front of the user on coverage that was never read. Creative Intake: a twin is the grounded manifest of an asset, so listing assets while the twin read failed would show every one of them as never decomposed. Each read is checked directly rather than through an aliased `??` chain, because narrowing does not propagate through an alias across separate results.
Experiments and the planner consume the same registries, so their claims were false in the same way. A failed metric read made `metricDefined: false` for every experiment — unknown reported as a definite blocker — and the empty state stated a metric count it did not have. Both the list and the empty state are now suppressed behind one notice, and "New experiment" is disabled while the metric registry is unread. A failed source read disables outcome import in both panels, which it already did in the planner, but silently; the reason is now stated, and the planner still distinguishes a registry that is genuinely empty ("add one in Source registry first") from one that was not read.
Retry is offered only where another attempt can succeed: `offline` and `failed`. `denied` names the recovery that applies, `absent` names the unreachable relation, `unconfigured` says this build has no project to read from. `sourceLabel` in the planner already degraded honestly to a truncated id and was left alone.
Copy corrected against the live ledger while in these files: two strings still claimed migrations 016 and 017 were "authored in the repository but pending live apply". All migrations 001–017 are applied, so an absent relation means this environment is not the one they were applied to, and both strings now say that.
Data/security effect: none. The same five queries run with the same `workspace_id` scoping; no policy, function, column, or migration changed, and no write path was added. Error text reaching the browser is the platform message that was already being written to the console. Private-intake privacy guarantees, source provenance on imported rows, and the known-gaps derivation are unchanged.
Acceptance checks: 610 tests (24 new: 11 in `src/lib/rows.test.ts`, 9 in `src/lib/sourceRegistry.test.ts`, 4 in `src/lib/creativeIntake.test.ts`), lint, typecheck, worker typecheck, production build.
Live verification deferred: the `denied` branch against a real non-member session and the `offline` branch against a genuinely dropped connection, on all four panels — both need an authenticated browser session (Antigravity). The classification and the copy selection are pure and covered by unit tests.
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

1. Phase 1 validation (D-5 through D-9) complete:
   - D-5: Atomic re-parse RPC evaluated; current product uses initial intake decomposition + hardened 006 atomic correction RPCs; no unused RPC added.
   - D-6: Audited all 24 `SECURITY DEFINER` functions; 100% have explicit `search_path`; public/anon execute properly revoked from sensitive RPCs.
   - D-7: Storage bucket `workspace-assets` confirmed private (`public: false`) with 4 tenant-scoped policies active.
   - D-8: Immutability triggers verified active on `creative_twin_versions`, `model_task_runs`, `experiment_outcomes`, `post_observations`.
   - D-9: Supabase Security and Performance Advisors audited, analyzed, and classified without blind code execution.
2. Full automated test baseline passing: 611 Vitest tests, 15 Python tests, lint clean, typechecks clean, production build clean.
3. Browser walkthrough and live model gateway health probe verified in authenticated workspace.
4. Next: Phase 2 missing backend primitives (persisted batch registry, atomic batch delete RPC, variant link table, workspace timezone, nullable correction RPC params, gateway quota fallback removal).

