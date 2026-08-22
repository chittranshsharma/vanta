# Vanta Job Worker (Upgrade C)

Status: authored, not deployed.

Polls `public.jobs` through the service-role RPCs from migration 011 (`claim_next_job`, `complete_job`, `fail_job`, `release_stale_jobs`). Retry and dead-letter policy is shared with the browser in `shared/jobs/policy.ts`.

## Run locally

```bash
cd services/job-worker
npm install
SUPABASE_URL=https://<ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service role key, never committed> \
ANALYSIS_SERVICE_URL=http://localhost:8000 \
ANALYSIS_SERVICE_TOKEN=<shared secret> \
npm run build && npm start
```

The service-role key lives only in this process's environment. The browser never sees it.

## Guarantees

- One claim per job at a time (`FOR UPDATE SKIP LOCKED`).
- Every attempt is logged in `jobs.step_log`.
- Transient failures requeue with jittered exponential backoff up to `max_attempts`; then `dead`.
- Permanent failures go `dead` immediately.
- Orphaned `running` jobs older than 15 minutes are released on worker start.
- Jobs with `requires_approval` wait in `awaiting_approval` until an admin calls `approve_job`.

## Handlers

| job_type | Handler | Status |
|---|---|---|
| `campaign_csv_normalize` | forwards to the Python analysis service (Upgrade B) | authored; fails permanently with `analysis_unconfigured` when the service URL is unset |
| others | none registered; never claimed | |
