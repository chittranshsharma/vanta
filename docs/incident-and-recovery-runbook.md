# Vanta Operational Incident & Recovery Runbook

**Document Version:** 1.0.0  
**Date:** 2026-08-30  
**Target Environment:** Private Beta & Operator Production Staging  
**Core Invariant:** Never recommend broad deletions, never print secrets or PII, and never disable Row Level Security to resolve an operational incident.

---

## 1. Executive Incident Protocol

When an anomaly or failure occurs in Vanta:
1. **Contain:** Prevent cascading quota consumption or data corruption without taking down database RLS.
2. **Inspect:** Examine sanitized structured logs (`correlation_id`, `task_type`, `http_status`, `error_kind`).
3. **Recover:** Apply the scoped remedy defined in the matching runbook section below.
4. **Verify:** Prove tenant boundaries and data integrity using automated verification scripts.
5. **Escalate:** If data integrity or security boundaries are breached, notify the system administrator immediately.

---

## 2. Incident Runbooks

### Runbook 1: Background Node Job Worker Stopped
- **Detection:** Queue depth on `jobs` table increases with `status = 'queued'`; no `job-worker` heartbeat logs emitted.
- **Immediate Containment:** Existing queued jobs remain safely in PostgreSQL; transactions are atomic.
- **Safe Inspection:** Check Node process status: `ps aux | grep job-worker` or container logs.
- **Recovery:** Restart worker: `npm --prefix services/job-worker run start` with valid `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- **Verification:** Confirm worker emits startup logs and claims queued jobs via `claim_next_job`.
- **Escalation:** If worker crashes immediately on boot, check database connectivity and environment variable names.

---

### Runbook 2: Python Analysis Service Unavailable
- **Detection:** `campaign_csv_normalize` jobs transition to `retryable` or `dead` with error `ECONNREFUSED` or HTTP 503.
- **Immediate Containment:** Node worker safely retries with exponential backoff ($2^{\text{attempts}} \times 10\text{s}$).
- **Safe Inspection:** Query `GET http://localhost:8000/healthz`. Check if `ANALYSIS_SERVICE_TOKEN` is set.
- **Recovery:** Restart FastAPI service: `ANALYSIS_SERVICE_TOKEN=<token> uvicorn app.main:app --port 8000`.
- **Verification:** `GET /healthz` returns `{"status": "ok"}`.
- **Escalation:** If Python dependencies fail, verify Python version $\ge 3.11$ and run `pip install -e services/analysis-worker`.

---

### Runbook 3: Upstream Groq Model Inference Failure
- **Detection:** Edge Function returns HTTP 502 (`upstream_provider_error`); `audit_events` logs `validation_status = 'upstream_error'`.
- **Immediate Containment:** Edge function returns 502 with correlation ID; quota is not consumed or is refunded.
- **Safe Inspection:** Inspect `model-gateway` logs for HTTP status (e.g. 429, 503 from `api.groq.com`).
- **Recovery:** Transient errors resolve automatically via built-in single bounded retry. If persistent, check Groq status page.
- **Verification:** Dispatch `gateway_health_check` probe from owner account.
- **Escalation:** If model name was deprecated upstream, update `GROQ_MODEL` secret via Supabase Dashboard.

---

### Runbook 4: Workspace Daily Quota Exhaustion
- **Detection:** Edge function returns HTTP 429 (`rate_limited`); `consume_quota` returns `allowed = false`.
- **Immediate Containment:** Model invocation is blocked before Groq call; zero upstream token spend occurs.
- **Safe Inspection:** Query `SELECT * FROM public.workspace_quotas WHERE workspace_id = '<id>'`.
- **Recovery:** Wait for midnight UTC daily window reset, or an authorized administrator can adjust `daily_limit` via SQL.
- **Verification:** Next quota check returns `allowed = true`.
- **Escalation:** Check if client loop is dispatching unauthorized automated bursts.

---

### Runbook 5: Repeated Job Failure & Dead-Letter Growth
- **Detection:** Jobs table records multiple rows with `status = 'dead'`.
- **Immediate Containment:** Dead-lettered jobs stop retrying, preventing infinite retry loops.
- **Safe Inspection:** Query `SELECT id, job_type, attempts, last_error FROM public.jobs WHERE status = 'dead' AND workspace_id = '<id>'`.
- **Recovery:** Fix underlying root cause (e.g. malformed CSV format), then re-enqueue or reset job status:
  ```sql
  UPDATE public.jobs SET status = 'queued', attempts = 0, run_after = NOW() WHERE id = '<job-id>';
  ```
- **Verification:** Worker claims and processes the reset job to `succeeded`.
- **Escalation:** If multiple workspaces experience dead-letters across the same handler, audit the handler code for bugs.

---

### Runbook 6: Stale Locks from Worker Crash
- **Detection:** Jobs remain stuck in `status = 'running'` with `locked_at < NOW() - INTERVAL '5 minutes'`.
- **Immediate Containment:** Worker startup automatically runs `release_stale_jobs(300)`.
- **Safe Inspection:** Check `SELECT COUNT(*) FROM public.jobs WHERE status = 'running' AND locked_at < NOW() - INTERVAL '5 minutes'`.
- **Recovery:** Manually invoke release routine:
  ```sql
  SELECT public.release_stale_jobs(300);
  ```
- **Verification:** Stuck jobs transition back to `status = 'queued'`.
- **Escalation:** Inspect worker process crash logs for unhandled exceptions or OOM errors.

---

### Runbook 7: Retention Purge Failure
- **Detection:** Expired derived artifacts remain in storage after scheduled purge timestamp.
- **Immediate Containment:** Expired records are non-destructive and hidden from standard user queries.
- **Safe Inspection:** Query `SELECT COUNT(*) FROM public.derived_artifacts WHERE retention_until < NOW()`.
- **Recovery:** Execute manual scoped purge routine:
  ```sql
  SELECT * FROM public.purge_expired_artifacts(100);
  ```
- **Verification:** Count of expired artifacts drops to zero.
- **Escalation:** If purge RPC fails with foreign key restriction, inspect parent/child artifact dependencies.

---

### Runbook 8: Secret Compromise / Leaked Token
- **Detection:** Operator suspects `GROQ_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, or `ANALYSIS_SERVICE_TOKEN` exposure.
- **Immediate Containment:** Immediately revoke the compromised key at the provider dashboard.
- **Safe Inspection:** Inspect provider access logs for unauthorized IP addresses.
- **Recovery:** Generate a new key and update secrets in Supabase Dashboard -> Edge Function Secrets.
- **Verification:** Run `gateway_health_check` and worker smoke test with new secret.
- **Escalation:** Audit `audit_events` for unauthorized workspace invocations during the exposure window.

---

### Runbook 9: Social Provider Token Revocation (Ticket 8.2)
- **Detection:** Provider sync job returns OAuth token error (`invalid_grant`, `token_revoked`).
- **Immediate Containment:** Background sync job sets `connector_accounts.status = 'expired'`.
- **Safe Inspection:** Query `SELECT id, provider, status, last_error FROM public.connector_accounts_public WHERE workspace_id = '<id>'`.
- **Recovery:** Prompt user in UI to re-authenticate and grant consent via OAuth connect button.
- **Verification:** `connector_accounts_public.status` returns to `'connected'`.
- **Escalation:** If provider revoked all app tokens, inspect developer console for app status violations.

---

### Runbook 10: Database Schema / RPC Version Mismatch
- **Detection:** Client or worker throws PostgreSQL error: `function does not exist` or `column does not exist`.
- **Immediate Containment:** Worker fails closed and marks job `failed`.
- **Safe Inspection:** Check `supabase_migrations.schema_migrations` against the migration ledger (Migrations 001–022).
- **Recovery:** Re-generate database types (`npm run typecheck`) and deploy the matching code bundle.
- **Verification:** `npm run verify` passes cleanly with 0 type errors.
- **Escalation:** Ensure migrations are applied strictly through the canonical migration runner.

---

### Runbook 11: Cross-Tenant Access Suspicion
- **Detection:** Audit logs show query attempts referencing unassociated `workspace_id`.
- **Immediate Containment:** RLS policies automatically reject cross-tenant reads (0 rows) and writes (policy error).
- **Safe Inspection:** Query `SELECT * FROM public.audit_events WHERE action LIKE '%access_denied%' ORDER BY created_at DESC LIMIT 50`.
- **Recovery:** Run the Playwright QA-1 isolation suite (`npx playwright test`) to confirm RLS integrity.
- **Verification:** 47/47 tests pass cleanly.
- **Escalation:** If any test fails, immediately freeze non-owner permissions and review PostgreSQL policy definitions.

---

### Runbook 12: Media Probe Binary Missing (`ffprobe`)
- **Detection:** `media_probe` jobs fail with `ENOENT: ffprobe not found`.
- **Immediate Containment:** Media probe job marks `derived_artifacts` as unreadable without crashing the worker.
- **Safe Inspection:** Run `ffprobe -version` in terminal.
- **Recovery:** Install `ffmpeg` / `ffprobe` on host OS (e.g. `winget install Gyan.FFmpeg` or `apt-get install ffmpeg`).
- **Verification:** Run `npx vitest run services/job-worker/src/handlers/ffprobe.test.ts`.
- **Escalation:** If containerized, verify `Dockerfile` includes `apt-get install -y ffmpeg`.
