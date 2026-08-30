# Vanta Private Beta Release Checklist & Operator Gate

**Release Label:** `private-beta ready with operator-only worker`  
**Date:** 2026-08-30  
**Target Environment:** Private Localhost / Controlled Beta (Trusted Operators Only)  
**Public Beta Status:** `public-beta blocked` (Pending persistent worker hosting, production HTTPS domain/CORS, automated retention scheduling, and Ticket 6.2 UI integration)

---

## 1. Security & Access Boundaries

- [x] **Database Isolation:** All 43 public PostgreSQL tables have Row Level Security enabled (`rls_enabled = true`). Migrations 001–022 live.
- [x] **Auth Guardrails:** Anonymous or unauthenticated access is rejected at database and API layers.
- [x] **Service Role Protection:** `SUPABASE_SERVICE_ROLE_KEY` is restricted strictly to backend Node worker environment and never bundled in client code.
- [x] **Public CORS Disabled:** Public wildcard CORS is disabled; restricted to local development origins (`http://localhost:5173`) until official HTTPS production domain is configured.
- [x] **No Secret Leaks:** Client code, worker logs, and audit event tables contain zero plain-text API keys, OAuth secrets, or customer PII.
- [x] **QA-1 Isolation Verified:** 47/47 Playwright real-JWT multi-tenant isolation tests pass live against Supabase.

---

## 2. Evidence Gating & Intelligence Integrity

- [x] **Claim Grounding Audit:** Operational on Groq Model Gateway v9 (`qwen/qwen3.8-27b`) with strict JSON schema validation, cryptographic nonce checking, and fail-closed fallbacks.
- [x] **Model Disclosure:** UI explicitly discloses that extracted claim text and active Brand Codex proof points are sent to Groq (`qwen/qwen3.8-27b`) for structured verification; raw media files are never transmitted.
- [x] **Authorization Gate:** Model gateway tasks restricted strictly to workspace `owner` and `admin` roles during beta.
- [x] **Quota Pre-Consumption:** `consume_quota` executes atomically *before* upstream inference call; quota exhaustion fails closed immediately with 429.
- [x] **Evidence Classes:** Strictly restricted to `observed`, `sourced`, `inference`, `simulation`, and `unknown`.
- [x] **Interpretations Gated:** All algorithmic observations are categorized as `evidence_class = 'inference'` and `review_state = 'unreviewed'` with mandatory uncertainty notes.
- [x] **Source Attribution:** Creative Twins and claim corrections require verified Brand Codex citations. Missing evidence prevents publishing approval.
- [x] **No Fake Data:** System contains zero synthetic virality scores, fabricated testimonials, or simulated customer reactions.

---

## 3. Supported vs. Unsupported Workflows

### Supported Workflows in Private Beta:
1. **Brand Brain & Codex Management:** Claims, Proof Points, Audiences, Competitors, Tone, and Compliance Boundaries with role-scoped editing.
2. **Deterministic Creative Intake & Twin Decomposition:** Script and text parsing, scene timing, WPM burden metrics, and immutable versioned snapshots.
3. **Atomic Scene/Claim Corrections:** Audited correction RPCs with automated versioning and rollback preservation.
4. **Claim Grounding Audit:** Evidence-gated LLM audit against Brand Codex via Groq model gateway v9.
5. **Specialist Council DAG Subgraph:** 11 typed specialist roles with capability-based least privilege and deterministic fallback matrix.
6. **Counterfactual Simulation Lab Engine:** 7 bounded mutations with mandatory human review gates and traceability links.
7. **Source Cohorts & Watchlists:** Workspace-scoped creator cohorts with composite foreign keys and citable source memberships (Migration 022).
8. **Cohort Outlier Analysis:** Pure deterministic descriptive median/IQR analysis (`shared/cohorts/outlierAnalysis.ts`).
9. **Publishing Schedule Optimizer:** Pure deterministic observed-history summarizer in workspace timezone with full IANA DST awareness (`shared/publishing/scheduleOptimizer.ts`).
10. **Outcome Calibration Batches:** CSV posting history import with batch registry, pseudonymized authors (`anon_<sha256>`), and same-workspace post-variant attribution.

### Unsupported / Prohibited Workflows:
- **No Outbound Mass Messaging / Auto-DMs:** Automated direct messaging and bot outreach are strictly prohibited.
- **No Web Scraping:** Bypassing platform login walls or unofficial scraping is prohibited.
- **No Algorithmic "Best Time" Guarantees:** Schedule optimizer reports descriptive historical medians only; never asserts universal algorithm preferences or viral forecasts.
- **No Auto-Publishing:** Direct API dispatch to social platforms is deferred.

---

## 4. Worker & Runtime Boundary (Private Beta)

- **Local Worker Execution:** The background job worker runs as a local Node daemon on the operator's workstation (`npm run worker:dev`).
- **Python Media Worker:** FastAPI service with `ffprobe`/`ffmpeg` runs locally for media analysis.
- **Operator Requirement:** The operator's machine must remain online for asynchronous job execution during private beta.

---

## 5. Retention Policy & Manual Operator Routine

- **Automated Retention Status:** `pending` (Automated cron scheduling is deferred until continuous worker hosting is established).
- **Live Verification:** Verified via live Supabase tests that `purge_expired_artifacts(limit)` removes strictly expired records without affecting non-expired or cross-tenant data.
- **Manual Operator Retention Routine:**
  Operators may trigger the retention purge on demand via SQL Editor or CLI:
  ```sql
  SELECT * FROM public.purge_expired_artifacts(100);
  ```

---

## 6. Public Beta Blockers

The following items must be resolved before transitioning from `private-beta ready` to `public-beta ready`:
1. **Persistent Worker Hosting:** Production containerization (Docker / Fly.io / Cloud Run) for 24/7 Node and Python worker availability.
2. **Production Domain & Exact CORS:** HTTPS custom domain allowlisted on Supabase Edge Function environment.
3. **Automated Retention Sweeper:** Scheduled cron job executing daily retention purges.
4. **Production Telemetry & Alerts:** Sentry / Datadog instrumentation for dead-letter spikes and unhandled exceptions.
5. **Ticket 6.2 UI Integration:** Connecting Specialist Council and Simulation Lab to the user interface, followed by QA-2 authenticated browser validation.

---

## 7. Operational Smoke Test Runbook

```bash
# 1. Run full verification suite (lint, typecheck, worker typecheck, tests, build)
npm run verify

# 2. Run Python analysis worker unit tests
pytest

# 3. Run Playwright real-JWT multi-tenant isolation suite
npx playwright test

# 4. Start local Node job worker for private beta
npm --prefix services/job-worker run dev
```
