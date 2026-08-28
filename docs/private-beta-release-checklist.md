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

## 4. Controlled 20-Step E2E Workflow Results

1. **Brand Brain & Codex:** Verified approved/unapproved claim validation and proof citability checking.
2. **Deterministic Creative Twin:** Script parsed deterministically into scenes with exact reading burden metrics.
3. **Hardened Scene Correction:** Atomic correction snapshotting immutable versions and audit events.
4. **Governance vs Performance:** Decision Room approved claim counts accurately represent policy state.
5. **Post-Variant Attribution:** Explicit foreign ID validation; cross-tenant references rejected.
6. **Synthetic Import Batching:** Deterministic accepted/rejected counts with author pseudonymization (`anon_<sha256>`).
7. **Worker Import Validation:** Batch validation handler updates batch status (`completed`/`partial`/`failed`).
8. **Deduplication:** Duplicate detection without silent observation row deletion or mutation.
9. **Attribution Linking:** Foreign reference verification against same workspace.
10. **Interpretation Proposals:** Quota-gated (`consume_quota`), `evidence_class = 'inference'`, `review_state = 'unreviewed'`, mandatory uncertainty note.
11. **Human Review RPC:** Atomic review state transition with append-only audit event logging.
12. **Draft Reply Validator:** Fails closed if Brand Codex claims are missing or expired.
13. **Spike Aggregation:** Exact observed counts in workspace timezone with truthful `baseline_status = 'unknown'`.
14. **Baseline Comparison:** Relative volume increase reported against stored rows without virality claims.
15. **Error & Retry Policy:** Transient exponential backoff, permanent dead-lettering, and idempotency key uniqueness.
16. **Fail-Closed Quotas:** Quota exhaustion immediately blocks execution without calling Groq.
17. **Role Isolation:** Viewer role prevented from executing mutations or administrative reviews.
18. **Tenant Fortress:** Cross-workspace reads/writes blocked at database and application layers.
19. **Log Redaction:** Zero customer text, prompts, completions, tokens, or secrets in logged output.
20. **Scoped Cleanup:** Verified full cascade cleanup of test data without leaving orphaned rows.

---

## 5. Operational Runbook & Scoped Test Cleanup

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

