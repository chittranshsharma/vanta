# Vanta Implementation TODO

## Completed

- [x] Tickets 0.1, 1.1, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2 (see `docs/build-state.md` for boundaries).
- [x] Ticket 5.0: secure model gateway foundation authored locally (`supabase/functions/model-gateway/`). Not deployed.
- [x] Phase 0 repository audit: `docs/fable-audit.md`, `docs/supabase-deferred-validation.md`, `docs/model-gateway-deployment-readiness.md`.
- [x] P0-1 patch authored: `20260822000007_brand_brain_rls.sql` (PENDING LIVE APPLY).
- [x] Phase 2: migrations 008 and 009 authored (PENDING LIVE APPLY) with static contract tests.
- [x] Ticket 5.1 design + output contract (`docs/ticket-5.1-claim-grounding-audit.md`, `tasks/claimGroundingAudit.ts`, 19 tests). Not wired.
- [x] P2-7: `App.tsx` split into LandingPage / Workspace / AuthModal.
- [x] P1 repository-only fixes: static migration contract tests, gateway audit/rate-limit/error-leak fixes, real auth tests, honest Decision Room load/error state, accessible `Modal`, Tailwind utilities layer for the Twin/Matrix/Doctor panels, code splitting, ESLint + CI, documentation sync, archive hygiene.

- [x] Roadmap upgrades A-G built as repository code with reviews (`docs/upgrade-reviews.md`): gateway task wiring + 5.1 UI, jobs queue + Node worker, Python analysis service, media pipeline, pgvector retrieval gate, connectors with encrypted tokens + RSS refresh, logs/quotas/flags/error boundary/telemetry/runbook/QA-1 suite. Migrations 010-015 authored.

## Blocked on live Supabase access (operator runs `docs/supabase-deferred-validation.md`)

- [ ] Resolve duplicate Supabase MCP configuration, perform read-only project/migration inventory, and validate migrations 007–017 only in an isolated branch before any live-project proposal.
- [ ] Reconcile the live migration ledger (which currently omits an explicit 00006 record) and classify/remediate all 17 Supabase security-advisor warnings before approving any migration application.
- [x] Remove the live-data JSON export from repository/docs and replace its inaccurate “physical backup” claim with a secure manual recovery procedure.
- [ ] Before applying any advisor remediation, independently test each proposed grant/helper-function change against its real RLS or trigger execution path.
- [ ] Before any live migration proposal, confirm plan/backup posture and run the D-2/D-3 row-integrity pre-checks; revise migration 009 to be transaction-safe or use `NOT VALID` plus explicit validation so a failed constraint addition cannot leave foreign keys absent.
- [x] D-1 to D-17: apply migrations 007-017 in order with pre-checks and live verification on Supabase project `ujxrapbhiedkwleccvqw`.
- [x] D-2: apply migration 008 after 007; binds `created_by`/`started_by` to `auth.uid()` and passed live positive, spoofed-actor, and cross-tenant-write checks (P1-6).
- [x] D-3: apply migration 009 (composite FKs, P1-7); verified validated composite FKs and negative cross-tenant writes blocked.
- [x] Antigravity regenerated authoritative TypeScript database types from the live 001–017 schema in commit `8313539`; no hand-maintained shadow schema was introduced.
- [x] Claude removed the remaining temporary client casts using the authoritative generated types and verified every affected client contract (`src/lib/rows.ts` boundary readers).
- [ ] D-5: atomic re-parse RPC (P1-8).
- [ ] D-6 to D-9: SECURITY DEFINER inventory, storage policies, immutability trigger, advisors.
- [ ] Ticket 5.0 deployment: secrets, deploy, one owner/admin health check, negative checks (needs explicit approval). Then enable `claim_grounding_audit` (server) and `claim_grounding_panel` (client).
- [ ] Deploy job worker and analysis service (host + service-role key handling + ffprobe). Choose embedding provider (E-3). Register provider OAuth apps (F-1).
- [ ] QA-1: two-user real-JWT isolation suite.
- [ ] Run authenticated browser end-to-end smoke tests for Brand Brain, intake, Twin corrections, experiments/outcomes, posting-history import, jobs/agent unavailable states, and tenant isolation.

- [x] Configure git identity (user.name / user.email) so slices can be committed locally.

## Next repository-only work

- [x] Plan a restrained ReactBits enhancement pass for the Vanta landing page without compromising its Apple-inspired visual direction.
- [ ] Generate an Apple-inspired Vanta landing-page visual concept from the supplied design system for presentation/reference use.
- [ ] Regenerate the landing-page visual in 16:9 with Vanta-relevant workspace components and no physical-product advertising hero.
- [ ] Generate a final 16:9 visual concept that expresses restrained ReactBits-style landing-page motion without adding AI-slap visual effects.
- [ ] Deliver the first live usable beta before the final cinematic UI/UX pass: finish functional contracts, live QA, and one bounded evidence-gated intelligence task first.
- [ ] Use Claude for repository implementation, tests, refactors, and documentation; reserve Antigravity for live Supabase operations and browser-only authenticated validation.
- [x] Approved-claim count in the Decision Room ladder: brand-scoped head count on `brand_claims` requiring both `claim_type = 'approved'` and `review_status = 'approved'`; loading, no-brand, unreadable, and observed-count states are distinct, and the copy names approval as governance, not performance.
- [x] Batch view and admin delete for posting-history import batches: `groupImportBatches` summarises stored rows only, and `deleteImportBatch` scopes the DELETE by workspace and batch, treats zero removed rows as a possible permission denial, and audits the removal.
- [ ] Add a batch registry table so an import that stores no rows is still recorded. Today a failed or fully-rejected import leaves no trace, and its rejected-row reasons and file name are never persisted, so the batch list cannot show a failed batch or an expected-versus-stored comparison. Needs a migration.
- [ ] Add an atomic `delete_post_observation_batch(p_workspace_id, p_batch_id)` RPC so a batch delete and its audit row share one transaction. Today they are two statements and the UI has to report an unwritten audit entry after a completed delete. Needs a migration.
- [x] G-3: `enqueueJob` consumes `job_enqueue` quota first, fails closed.
- [ ] G-2: remove gateway quota fallback after D-15.
- [x] B-3: experiments + observed outcomes (migration 016, `shared/experiments`, Experiments panel).
- [x] D-2: thumbnail and frame-sample artifacts — contract, reader, and readiness UI. `shared/media/artifacts.ts` states the per-kind `features` contract (image bytes plus pixel dimensions; frames additionally require `at_seconds`), `src/lib/artifacts.ts` reads `derived_artifacts` at the boundary, and `MediaReadiness` in Creative Intake reports not-applicable, no-producer-in-build, none-produced-yet, unreadable, and ready as five distinct states. No placeholder image is ever rendered.
- [ ] Write a real thumbnail producer. `thumbnail` and `frame_sample` are legal `artifact_kind` values and nothing in this build writes either, so the UI honestly reports a missing capability. Needs an image encoder in the job worker, a `workspace-assets` write path, and a new job type in `shared/jobs/policy.ts`; frame sampling additionally waits on video byte intake (`VIDEO_INTAKE_ENABLED`).
- [x] Outcome import UI (CSV against a registered source) feeding `experiment_outcomes` with per-row provenance.
- [x] Connector outcome-sync interfaces: `shared/connectors/outcomeSync.ts` resolves per-provider capability (not applicable, not implemented, setup required, blocked, stale, ready), and `OutcomeSyncStatus` reports it in the experiments panel and the create modal. An experiment's connector source state is now derived from whether a sync could run, not from whether an account is connected, so a live token no longer implies an experiment can conclude.
- [ ] Connector-sourced outcome sync itself (waits on F-1 and on the variant link below). Needs an OAuth app registration, a sync job type in `shared/jobs/policy.ts` with a worker handler, and a registered source row per connector for `experiment_outcomes.source_id`.
- [ ] Add a table linking an external post id to the variant twin that produced it. `experiment_outcomes.variant_twin_id` is NOT NULL and nothing records which post carried which variant, so even an authorized connector could not attribute a fetched metric to a variant without inventing the link. This is the decisive blocker for connector sync, ahead of OAuth. Needs a migration.
- [x] Observed posting-history store (migration 017) plus import UI; planner derives candidates from real rows.
- [x] Local-timezone window buckets: `toWindowObservations` buckets by wall-clock hour and weekday in a named IANA zone via `Intl.DateTimeFormat`, honours the offset in force on each date, reports the zone actually used (UTC when a zone name is not recognized), and the planner labels the hours with that zone.
- [x] Operational-state audit of the model-run, jobs, retrieval, and quota clients: `classifyReadError` in `src/lib/rows.ts` separates an absent relation, an authorization refusal, and a read failure; `src/lib/quotas.ts` reports a daily budget without spending it (including a stale `window_date` as `reset_pending`, compared against the UTC date Postgres uses); `src/lib/modelRuns.ts` replaces the agent panel's unread "no run has ever happened" assertion with a head count that reports a withheld count as unknown rather than zero; `src/lib/retrieval.ts` names three independent reasons nothing is indexed instead of showing a bare coverage figure; and `Codex retrieval` is a static readiness row. Copy that claimed migrations 010–017 were pending was corrected against the live ledger.
- [x] Job status drift contract in `shared/jobs/policy.test.ts`: a frozen second copy of the permitted edge set fails if a status gains no transition behaviour, if an illegal transition is accepted by the table or by `canTransition`, or if a terminal status becomes transitionable. Verified by injecting all three drift cases into `policy.ts`.
- [ ] Store a per-workspace timezone so windows survive being opened from another device. Today the bucket zone is whatever device the operator is on, which is truthful but not stable. Needs a migration.
- [x] Gateway probe result lifted into the workspace and consumed by the agent runtime gate.
- [x] Accessibility pass on Brand Brain and Source Registry forms (aria-describedby, aria-busy, inline save errors).
- [ ] Give `save_scene_correction_atomic` explicit `DEFAULT NULL` on `p_start_seconds`, `p_end_seconds`, and `p_reading_burden_wpm` so the nullable contract survives type generation; until then `sceneTimingArgs` in `src/lib/creativeTwin.ts` widens once, in one documented place.
- [x] Error and recovery states across the Brand Brain read path: all seven codex fetchers in `src/lib/brandBrain.ts` return a `BrandRead<T>` carrying the failure class instead of logging and returning `null` or `[]`, so a refused read is no longer rendered as an absent brand with a create button that would fail, and an unread claim list is no longer rendered as a brand that claims nothing. `BrandBrain.tsx`'s error branch was dead code (`setError` was only ever called with `null`) and is now live; `CreativeTwinEditor.tsx` and `Workspace.tsx` report the same failure rather than an empty grounding set.
- [x] Retryability contract in `src/lib/rows.ts`: `isTransientReadError` and an `offline` member of `ReadFailure` identify a request that never reached Postgres, and `isRetryable` invites a retry only for `offline` and `failed`. Denied and absent states name the recovery that applies instead of offering an attempt guaranteed to fail the same way. A server-side statement timeout (`57014`) is deliberately not `offline`, since the offline copy asserts nothing was attempted.
- [ ] Decide whether `quotas.ts`, `modelRuns.ts` and `retrieval.ts` should gain explicit `offline` branches. Each already has an unreadable fallthrough that carries the platform message, so the state is reported truthfully today; the gain would be inviting retry where it can succeed, at the cost of three new state unions and their test matrices.
- [ ] Four near-identical local `Result<T>` types now exist (`artifacts.ts`, `connectors.ts`, `experiments.ts`, `jobs.ts` as `JobsResult`, plus `BrandRead` in `brandBrain.ts`). Worth one shared export once a fifth appears or one of them needs to change shape; not worth a cross-file refactor before then.
- [ ] Surface the per-kind quota budgets that have a UI consumer beyond `job_enqueue` (`model_call` on the gateway probe path, `media_probe` in Creative Intake). `fetchQuotas` already returns every kind; only the jobs panel reads one today.
- [ ] Decide whether retrieval coverage deserves a live read. `fetchRetrievalCoverage` now resolves six states and nothing calls it, because no feature is grounded by a vector search — the honest static readiness row covers the current truth. Wire it when E-3 picks a provider and something indexes.
