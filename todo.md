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

- [ ] D-1 to D-17: apply migrations 007-017 in order with pre-checks; regenerate types; drop `never` casts in jobs/connectors/retrieval clients.
- [ ] D-2: apply migration 008 (authored) after 007; binds `created_by` to `auth.uid()` (P1-6).
- [ ] D-3: pre-check then apply migration 009 (authored); composite FKs (P1-7).
- [ ] D-5: atomic re-parse RPC (P1-8).
- [ ] D-6 to D-9: SECURITY DEFINER inventory, storage policies, immutability trigger, advisors.
- [ ] Ticket 5.0 deployment: secrets, deploy, one owner/admin health check, negative checks (needs explicit approval). Then enable `claim_grounding_audit` (server) and `claim_grounding_panel` (client).
- [ ] Deploy job worker and analysis service (host + service-role key handling + ffprobe). Choose embedding provider (E-3). Register provider OAuth apps (F-1).
- [ ] QA-1: two-user real-JWT isolation suite.

- [ ] Configure git identity (user.name / user.email) so slices can be committed locally.

## Next repository-only work

- [ ] Approved-claim count in the Decision Room ladder (needs a brand-scoped read; currently shown as 0, never guessed).
- [ ] Batch view and admin delete for posting-history import batches.

- [x] G-3: `enqueueJob` consumes `job_enqueue` quota first, fails closed.
- [ ] G-2: remove gateway quota fallback after D-15.
- [x] B-3: experiments + observed outcomes (migration 016, `shared/experiments`, Experiments panel).
- [ ] D-2: thumbnail and frame-sample artifacts.
- [x] Outcome import UI (CSV against a registered source) feeding `experiment_outcomes` with per-row provenance.
- [ ] Connector-sourced outcome sync (waits on F-1).
- [x] Observed posting-history store (migration 017) plus import UI; planner derives candidates from real rows.
- [ ] Local-timezone window buckets (current buckets are UTC and labelled UTC).
- [x] Gateway probe result lifted into the workspace and consumed by the agent runtime gate.
- [x] Accessibility pass on Brand Brain and Source Registry forms (aria-describedby, aria-busy, inline save errors).
