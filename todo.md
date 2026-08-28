# Vanta Implementation TODO

## Completed

- [x] Tickets 0.1, 1.1, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2 (see `docs/build-state.md` for boundaries).
- [x] Ticket 5.0: secure model gateway foundation authored and deployed as Supabase Edge Function (`model-gateway` v9) with `GROQ_MODEL=qwen/qwen3.8-27b` secret configured.
- [x] Phase 0 repository audit: `docs/fable-audit.md`, `docs/supabase-deferred-validation.md`, `docs/model-gateway-deployment-readiness.md`, `docs/current-state-reconciliation.md`.
- [x] P0-1 patch applied: `20260822000007_brand_brain_rls.sql` verified live on project `ujxrapbhiedkwleccvqw`.
- [x] Phase 2: migrations 008 and 009 applied and verified live with composite FKs and actor binding active.
- [x] Ticket 5.1 design + output contract (`docs/ticket-5.1-claim-grounding-audit.md`, `tasks/claimGroundingAudit.ts`, 19 tests). Gateway checks passed with private-beta readiness.
- [x] P2-7: `App.tsx` split into LandingPage / Workspace / AuthModal.
- [x] P1 repository-only fixes: static migration contract tests, gateway audit/rate-limit/error-leak fixes, real auth tests, honest Decision Room load/error state, accessible `Modal`, Tailwind utilities layer for the Twin/Matrix/Doctor panels, code splitting, ESLint + CI, documentation sync, archive hygiene.

- [x] Roadmap upgrades A-G built as repository code with reviews (`docs/upgrade-reviews.md`): gateway task wiring + 5.1 UI, jobs queue + Node worker, Python analysis service, media pipeline, pgvector retrieval gate, connectors with encrypted tokens + RSS refresh, logs/quotas/flags/error boundary/telemetry/runbook/QA-1 suite. Migrations 010-017 applied and verified live.

## Blocked on live Supabase access (operator runs `docs/supabase-deferred-validation.md`)

- [x] Complete authenticated browser E2E and QA-1 multi-user isolation validation; Core Beta gate passed at commit `fc5974d` with 611 tests and no observed browser-console errors.
- [ ] Prepare a controlled Core Beta onboarding/release checklist before inviting users; retain Groq and OAuth connectors as separate explicit approvals.
- [x] Resolve duplicate Supabase MCP configuration, perform read-only project/migration inventory, and validate migrations 007–017 (all live on Supabase).
- [x] Reconcile the live migration ledger (which currently omits an explicit 00006 record) and classify/remediate Supabase security/performance advisor warnings.
- [x] Remove the live-data JSON export from repository/docs and replace its inaccurate “physical backup” claim with a secure manual recovery procedure.
- [ ] Before applying any advisor remediation, independently test each proposed grant/helper-function change against its real RLS or trigger execution path.
- [x] Confirm plan/backup posture and run the D-2/D-3 row-integrity pre-checks; composite FKs and actor binding live and verified.
- [x] D-1 to D-17: apply migrations 007-017 in order with pre-checks and live verification on Supabase project `ujxrapbhiedkwleccvqw`.
- [x] D-2: apply migration 008 after 007; binds `created_by`/`started_by` to `auth.uid()` and passed live positive, spoofed-actor, and cross-tenant-write checks (P1-6).
- [x] D-3: apply migration 009 (composite FKs, P1-7); verified validated composite FKs and negative cross-tenant writes blocked.
- [x] Antigravity regenerated authoritative TypeScript database types from the live 001–017 schema in commit `8313539`; no hand-maintained shadow schema was introduced.
- [x] Claude removed the remaining temporary client casts using the authoritative generated types and verified every affected client contract (`src/lib/rows.ts` boundary readers).
- [x] D-5: atomic re-parse RPC evaluated against current lifecycle; 006 atomic correction RPCs verified live (P1-8).
- [x] D-6 to D-9: SECURITY DEFINER inventory (100% explicit search_path, revokes verified), storage policies (private bucket + 4 tenant policies), immutability triggers (active & verified), advisors (audited & classified).
- [x] Ticket 5.0 deployment: secrets, deploy, health check, negative checks, 13 gateway checks passed, private-beta ready.
- [ ] Activate Groq only through Antigravity and only for the bounded Claim Grounding Audit after secret, authorization, rate/budget, malformed-output, and audit-log safety checks pass.
- [ ] Before Groq deployment, decide and test Claim Grounding Audit member-vs-editor authorization, remove/verify the legacy quota fallback now that migration 015 is live, and confirm an explicit user disclosure before creative/claim text is sent to Groq.
- [ ] Before Groq deployment, confirm the provider/model wording shown in the disclosure is accurate, allowlist the actual beta origin, and run post-deploy owner/negative/CORS/rate-limit/audit-redaction checks before enabling the panel.
- [ ] Rotate or delete test-user credentials exposed during gateway validation; verify a real owner/admin Claim Grounding Audit end-to-end, the resulting sanitized audit record, and CORS from the actual beta origin before public enablement.
- [x] Configure `GROQ_MODEL=qwen/qwen3.8-27b` through the Supabase Edge Functions secret UI; retain the conflicting-proof fixture as a repair-turn regression test and defer public CORS activation until the HTTPS beta origin exists.
- [ ] Deploy job worker and analysis service (host + service-role key handling + ffprobe). Choose embedding provider (E-3). Register provider OAuth apps (F-1).
- [x] QA-1: two-user real-JWT isolation suite (40/40 Playwright isolation checks passing live).
- [x] Run authenticated browser end-to-end smoke tests for Brand Brain, intake, Twin corrections, experiments/outcomes, posting-history import, jobs/agent unavailable states, and tenant isolation.

- [x] Phase 2: Missing Backend Primitives (Migration 018 live).
  - [x] Batch registry table `import_batches` with tenant RLS, validation summary, and provenance tracking.
  - [x] Atomic `delete_post_observation_batch(p_workspace_id, p_batch_id)` RPC with transactional audit logging and owner/admin check.
  - [x] External post-to-variant attribution table `post_variant_attributions` with provider/external post uniqueness.
  - [x] Stable per-workspace `workspaces.timezone` setting with IANA validation helper and UTC fallback.
  - [x] Nullable correction RPC parameters (`DEFAULT NULL`) on `save_scene_correction_atomic` and authoritative regenerated TypeScript types.
  - [x] Removed G-2 legacy quota fallback (model gateway and job enqueue fail closed strictly on `consume_quota`).

- [x] Phase 3: Conversation Intelligence Foundation (Migration 019 live as `20260828183603`).
  - [x] `conversation_observations` immutable audience signals table with composite tenant FKs, pseudonymized `author_ref`, deterministic idempotency keys, and core-content immutability trigger.
  - [x] `conversation_interpretations` inference layer table with mandatory `uncertainty_note`, `review_state`, and human review fields.
  - [x] `conversation_attributions` explicit Twin/Variant/Claim/CTA/Experiment linkage table.
  - [x] `conversation_review_events` append-only audit ledger (UPDATE and DELETE denied via `USING (false)`).
  - [x] Atomic review RPCs `review_conversation_observation_atomic` and `review_conversation_interpretation_atomic` with transactional audit logging.
  - [x] Pure CSV import validator (`shared/conversations/csvImport.ts`) with byte/length/header limits and deterministic line rejections.
  - [x] Pure source-grounded reply draft validator (`shared/conversations/replyDrafts.ts`) failing closed when approved claims/proofs are absent.
  - [x] 5 Conversation job types added to `shared/jobs/policy.ts`.
  - [x] Pure spike aggregation module (`shared/conversations/spikeAggregation.ts`) reporting exact counts in workspace timezone and flagging unknown baselines without fake virality.

- [x] Phase 4: Jobs, Aggregation, and Spike Observation Worker Integration (Migration 020 live as `20260828184335`).
  - [x] Expanded `jobs_job_type_check` in PostgreSQL to permit all 10 job types.
  - [x] Implemented `conversation_import_validate` worker handler with batch integrity validation, tenant isolation, and status updates.
  - [x] Implemented `conversation_deduplicate` worker handler with idempotency scanning and duplicate detection without silent row deletion.
  - [x] Implemented `conversation_interpretation_proposal` worker handler with mandatory quota consumption (`consume_quota`), inference evidence classification, unreviewed status, and uncertainty notes.
  - [x] Implemented `conversation_attribution` worker handler with explicit foreign ID validation (twins, variants, claims, experiments, CTAs) and strict workspace boundary enforcement.
  - [x] Implemented `conversation_aggregate` worker handler with workspace timezone formatting and baseline availability reporting.
  - [x] Registered all 5 handlers in `services/job-worker/src/worker.ts` and validated loop dispatch in `services/job-worker/src/loop.test.ts`.

- [x] Phase 5A: Controlled Beta Readiness, Real Worker Runtime Verification, and Connector Readiness Architecture.
  - [x] Authored worker runtime architecture note (`docs/worker-runtime-boundary.md`) detailing Node/Python dual-worker boundary, system dependencies (`ffprobe`), and zero-cost local vs. continuous hosting distinction.
  - [x] Authored comprehensive worker acceptance suite (`services/job-worker/src/workerAcceptance.test.ts`) covering handler registry, unknown job rejection, retry exponential backoff, dead-letter state, stale lock release, sanitized logging, and graceful shutdown.
  - [x] Executed live worker smoke test on Supabase: validated claiming, transient retry backoff, permanent error dead-lettering, crashed-worker stale lock recovery, and cleanup.
  - [x] Authored connector-neutral capability matrix and event mapping review (`docs/connector-neutral-contract-review.md`).
  - [x] Authored official Meta/Instagram platform integration readiness checklist (`docs/meta-instagram-integration-readiness.md`).
  - [x] Authored private beta release checklist and operator gate (`docs/private-beta-release-checklist.md`).

- [x] Controlled Private Beta Exercise and Backend Hardening:
  - [x] Authored and verified 20-step end-to-end integration workflow suite (`src/lib/controlledBetaWorkflow.test.ts`).
  - [x] Verified live database execution: atomic scene corrections, immutability triggers on conversation observations, append-only review events, and cascade cleanup.
  - [x] Verified full tenant fortress and role isolation between admin and viewer roles.
  - [x] Verified log and audit redaction with zero secret or customer PII leakage.
  - [x] All 736 automated tests passing cleanly (721 Vitest + 15 Pytest).

- [x] Ticket 5.2: Specialist Council Rollout (Backend & Contracts):
  - [x] 11 typed specialist role contracts with capability-based least privilege, prohibited actions, and audit keys (`shared/agents/graph.ts`).
  - [x] Master Council DAG and Minimal Subgraph Planner (`planMinimalSubgraph`) with cycle detection, budget ceilings, and mandatory downstream arbiter/reviewer boundaries.
  - [x] Deterministic Fallback Matrix (`shared/agents/fallback.ts`) for all 11 roles, preserving truthful `unknown`/`blocked` states without fabricating metrics, baseline virality, or ungrounded approvals.
  - [x] Pre-flight Council budget and quota gating (`shared/agents/council.ts`), cross-tenant ID verification, and sanitized metadata logging.
  - [x] Strict separation of epistemic `evidence_class` from administrative `review_decision` (human approval does not promote AI inference to empirical fact).
- [x] Ticket 6.1: Counterfactual Simulation Lab (Backend & Domain):
  - [x] Canonical 5-class evidence taxonomy strictly enforced (`observed`, `sourced`, `inference`, `simulation`, `unknown`) with separate operational statuses (`shared/simulation/types.ts`).
  - [x] 7 bounded mutation operations (`hook_replacement`, `cta_replacement`, `scene_reorder`, `scene_duration_adjust`, `on_screen_text_change`, `claim_substitution`, `tone_guideline_adaptation`) with immutability guarantees and Brand Codex claim verification (`shared/simulation/mutations.ts`).
  - [x] Deterministic structural deltas only (duration, WPM, scene count, claim count, coverage); zero performance predictions or arbitrary virality scores.
  - [x] Six-role Council analysis subgraph (`discovery` -> `creative_analyst` -> `claim_auditor` -> `experiment_designer` -> `evidence_arbiter` -> `evaluator`) and mandatory `human_reviewer` governance gate (`shared/simulation/engine.ts`).
  - [x] Traceability-only post-hoc empirical outcome linkage without variance/lift calculation (`shared/simulation/traceability.ts`).
  - [x] 763 Vitest + 15 Pytest = 778 automated tests passing cleanly.

- [x] Configure git identity (user.name / user.email) so slices can be committed locally.

## Next repository-only work

- [x] Plan a restrained ReactBits enhancement pass for the Vanta landing page without compromising its Apple-inspired visual direction.
- [ ] Generate an Apple-inspired Vanta landing-page visual concept from the supplied design system for presentation/reference use.
- [ ] Regenerate the landing-page visual in 16:9 with Vanta-relevant workspace components and no physical-product advertising hero.
- [ ] Generate a final 16:9 visual concept that expresses restrained ReactBits-style landing-page motion without adding AI-slap visual effects.
- [ ] Deliver the first live usable beta before the final cinematic UI/UX pass: finish functional contracts, live QA, and one bounded evidence-gated intelligence task first.
- [x] Run a controlled localhost/private-beta exercise with trusted users and collect workflow feedback before broadening capabilities or publicizing the Claim Grounding Audit.
- [ ] After final landing/workspace polish and a real HTTPS beta origin, allowlist the exact origin and rerun production-origin Groq browser validation before public beta enablement.
- [ ] Use Claude for repository implementation, tests, refactors, and documentation; reserve Antigravity for live Supabase operations and browser-only authenticated validation.
- [x] Approved-claim count in the Decision Room ladder: brand-scoped head count on `brand_claims` requiring both `claim_type = 'approved'` and `review_status = 'approved'`; loading, no-brand, unreadable, and observed-count states are distinct, and the copy names approval as governance, not performance.
- [x] Batch view and admin delete for posting-history import batches: `groupImportBatches` summarises stored rows only, and `deleteImportBatch` scopes the DELETE by workspace and batch, treats zero removed rows as a possible permission denial, and audits the removal.
- [x] Add a batch registry table so an import that stores no rows is still recorded (`import_batches` table live via migration 018).
- [x] Add an atomic `delete_post_observation_batch(p_workspace_id, p_batch_id)` RPC so a batch delete and its audit row share one transaction (live via migration 018).
- [x] G-3: `enqueueJob` consumes `job_enqueue` quota first, fails closed.
- [x] G-2: remove gateway quota fallback after D-15 (completed in migration 018).
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
- [x] Complete the narrow Source Registry and Creative Intake error/recovery pass, then hand the committed build to Antigravity for authenticated browser E2E and QA-1. All five readers in `src/lib/sourceRegistry.ts` and `src/lib/creativeIntake.ts` return the shared `ReadResult<T>` from `src/lib/rows.ts`, so a refused, unreachable or offline read is no longer rendered as a workspace with no sources, no evidence or no assets. Both panels' `catch` branches were dead code (the fetchers never threw) and are now live, and `ExperimentsPanel.tsx` and `PublishingPlanner.tsx` stop stating a metric count or a source list they did not read.
- [x] Shared read contract in `src/lib/rows.ts`: `ReadResult<T>`, `readRows`, `readFailureSummary(error, subject)` and `isRetryableRead` give the four panels one phrasing per failure class, with retry offered only for `offline` and `failed`. `unconfigured` is a separate class from the four `ReadFailure` members because no button click gives this build a Supabase project.
- [ ] Migrate `brandBrain.ts`'s `BrandRead<T>` onto the shared `ReadResult<T>`. Deliberately deferred: its copy is codex-specific and its 12 tests pin exact strings, so the merge is a rewrite of `brandReadSummary`, not a type swap. Do it with the `Result<T>` dedupe below.
- [ ] Decide whether `quotas.ts`, `modelRuns.ts` and `retrieval.ts` should gain explicit `offline` branches. Each already has an unreadable fallthrough that carries the platform message, so the state is reported truthfully today; the gain would be inviting retry where it can succeed, at the cost of three new state unions and their test matrices.
- [ ] Five near-identical local `Result<T>` types now exist (`artifacts.ts`, `connectors.ts`, `experiments.ts`, `jobs.ts` as `JobsResult`, plus `BrandRead` in `brandBrain.ts`), alongside the shared `ReadResult<T>` in `rows.ts` that the registry and intake readers use. The shared one is the target shape; fold the others in when one of them next needs to change.
- [ ] Widen `evaluateReadiness`'s `metricDefined: boolean` in `shared/experiments/model.ts` to a tri-state so a single experiment row can say "metric registry unread" instead of the panel suppressing the whole list. The current panel-level treatment is correct but coarse, and the change touches the shared model and its contract tests.
- [ ] Surface the per-kind quota budgets that have a UI consumer beyond `job_enqueue` (`model_call` on the gateway probe path, `media_probe` in Creative Intake). `fetchQuotas` already returns every kind; only the jobs panel reads one today.
- [ ] Decide whether retrieval coverage deserves a live read. `fetchRetrievalCoverage` now resolves six states and nothing calls it, because no feature is grounded by a vector search — the honest static readiness row covers the current truth. Wire it when E-3 picks a provider and something indexes.
