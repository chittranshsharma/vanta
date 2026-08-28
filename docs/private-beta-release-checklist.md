# Vanta Private Beta Release Checklist & Operator Gate

**Status:** Phase 5A Release Verification  
**Date:** 2026-08-29  
**Target Environment:** Private Localhost / Staging Beta (Trusted Operators Only)

---

## 1. Security & Access Boundaries

- [x] **Database Isolation:** All 36 public PostgreSQL tables have Row Level Security enabled (`rls_enabled = true`).
- [x] **Auth Guardrails:** Anonymous or unauthenticated access is rejected at database and API layers.
- [x] **Service Role Protection:** `SUPABASE_SERVICE_ROLE_KEY` is restricted strictly to backend Node worker environment and never bundled in client code.
- [x] **Public CORS Disabled:** Public wildcard CORS is disabled; restricted to local development origin until official HTTPS production domain is configured.
- [x] **No Secret Leaks:** Client code, worker logs, and audit event tables contain zero plain-text API keys, OAuth secrets, or customer PII.

---

## 2. Evidence Gating & Intelligence Integrity

- [x] **Claim Grounding Audit:** Operational on Groq Model Gateway v9 with strict JSON schema validation, cryptographic nonce checking, and fail-closed fallbacks.
- [x] **Evidence Classes:** Strictly restricted to `observed`, `sourced`, `inference`, `simulation`, and `unknown`.
- [x] **Interpretations Gated:** All algorithmic observations are categorized as `evidence_class = 'inference'` and `review_state = 'unreviewed'` with mandatory uncertainty notes.
- [x] **Source Attribution:** Creative Twins and claim corrections require verified Brand Codex citations. Missing evidence prevents publishing approval.
- [x] **No Fake Data:** System contains zero synthetic virality scores, fabricated testimonials, or simulated customer reactions.

---

## 3. Worker & Ingestion Capabilities

- [x] **Manual & CSV Import Only:** Conversation observations are imported strictly via validated CSV upload (`conversation_import_validate`).
- [x] **Author Anonymization:** Author identifiers are hashed (`anon_<sha256>`) at ingestion time.
- [x] **Timezone Truthfulness:** Aggregation buckets posts in configured workspace timezone (`workspaces.timezone`) and marks missing comparison baselines as `baseline_status = 'unknown'`.
- [x] **Deduplication & Idempotency:** Duplicate observation keys are identified without destructive row mutation.
- [x] **Draft-Only Replies:** Reply drafts fail closed without approved brand claims and are never sent automatically.

---

## 4. Operational Runbook & Scoped Test Cleanup

### Smoke Test Execution:
```bash
# 1. Run complete automated verification suite
npm run verify

# 2. Run Python analysis worker unit tests
python -m pytest services/analysis-worker/tests

# 3. Start local Node job worker
SUPABASE_URL="https://<project-ref>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="<service-role-key>" npm --prefix services/job-worker start
```

### Scoped Test-Data Cleanup Policy:
- Test workspaces and disposable batch rows must be cleaned up via tenant-isolated CASCADE deletes (`DELETE FROM public.workspaces WHERE id = '<test-id>'`).
- Never run blanket truncate or non-isolated SQL queries in production environments.
