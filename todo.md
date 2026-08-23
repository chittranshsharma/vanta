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
- [ ] Connector-sourced outcome sync (waits on F-1).
- [x] Observed posting-history store (migration 017) plus import UI; planner derives candidates from real rows.
- [x] Local-timezone window buckets: `toWindowObservations` buckets by wall-clock hour and weekday in a named IANA zone via `Intl.DateTimeFormat`, honours the offset in force on each date, reports the zone actually used (UTC when a zone name is not recognized), and the planner labels the hours with that zone.
- [ ] Store a per-workspace timezone so windows survive being opened from another device. Today the bucket zone is whatever device the operator is on, which is truthful but not stable. Needs a migration.
- [x] Gateway probe result lifted into the workspace and consumed by the agent runtime gate.
- [x] Accessibility pass on Brand Brain and Source Registry forms (aria-describedby, aria-busy, inline save errors).
- [ ] Give `save_scene_correction_atomic` explicit `DEFAULT NULL` on `p_start_seconds`, `p_end_seconds`, and `p_reading_burden_wpm` so the nullable contract survives type generation; until then `sceneTimingArgs` in `src/lib/creativeTwin.ts` widens once, in one documented place.
