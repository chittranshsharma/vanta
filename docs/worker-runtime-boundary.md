# Vanta Worker Runtime Boundary & Operational Architecture

**Document Version:** 2.0.0  
**Date:** 2026-08-30  
**Services:** `services/job-worker` (Node.js 22+) & `services/analysis-worker` (Python 3.11+ FastAPI)  
**Current Runtime Status:** `private-beta ready with operator-only worker`  
**Public Beta Status:** `public-beta blocked` (Pending persistent worker hosting deployment and automated retention scheduling)

---

## 1. Executive Summary & Runtime Topology

Vanta separates client-facing interactions from background asynchronous compute and media analysis through two dedicated, stateless services operating strictly outside the browser context:

```
[ PostgreSQL / Supabase Remote Database ]
      ▲                               ▲
      │ (claim_next_job SKIP LOCKED)   │ (read / write with service-role key)
      │ (complete_job / fail_job)     │ (consume_quota, release_stale_jobs)
      ▼                               ▼
┌───────────────────────────────────────────┐         Internal HTTP (Bearer Token)         ┌────────────────────────────────────────────┐
│           services/job-worker             │ ───────────────────────────────────────────► │          services/analysis-worker          │
│              (Node.js 22+)                │                                              │             (Python 3.11+ FastAPI)         │
│ - 14 Registered Handlers                  │                                              │ - Stateless Pandas/Numpy Analysis          │
│ - Exponential Retry Backoff ($2^a \cdot 10$)│                                              │ - Campaign CSV Normalization               │
│ - Dead-Letter & Stale Lock Sweep          │                                              │ - Zero DB Access (Receives/Returns JSON)   │
│ - Atomic Quota Pre-Consumption            │                                              │ - Healthz & Operational Metrics            │
└───────────────────────────────────────────┘                                              └────────────────────────────────────────────┘
      │
      ▼ (local child_process execution)
┌───────────────────────────────────────────┐
│              ffprobe / ffmpeg             │ (System binary dependency for media_probe)
└───────────────────────────────────────────┘
```

---

## 2. Comprehensive Handler Runtime Matrix

| Job Type | Handler Implementation | Input Contract | Output / State Transition | Dependencies | Retry & Backoff Policy | Quota Gate | Tenant Boundary | Failure Mode |
|---|---|---|---|---|---|---|---|---|
| `model_task` | Supabase Edge Function `model-gateway` v9 | `{ workspace_id, task_type, twin_id }` | Appends `model_task_runs` (`evidence_class = 'inference'`) | `GROQ_API_KEY`, `GROQ_MODEL` | 1 transient retry on 429/500/503 | Pre-consumes `model_call` quota before Groq invocation | RLS on caller JWT; owner/admin only | 429 quota reached, 502 upstream failure |
| `campaign_csv_normalize` | `handlers/campaignCsvNormalize.ts` | `{ csv_text, column_map, source_id }` | Updates `jobs.result` with normalized rows & provenance | `ANALYSIS_SERVICE_URL`, `ANALYSIS_SERVICE_TOKEN` | Transient: 3 max attempts ($2^a \cdot 10\text{s}$) | `job_enqueue` consumed at insert | Composite `(source_id, workspace_id)` check | 422 `no_metric_columns`, dead-letter on 3 attempts |
| `media_probe` | `handlers/mediaProbe.ts` | `{ storage_path, asset_id }` | Writes `derived_artifacts` (`media_metadata`, `features`) | Local `ffprobe` binary | Transient: 3 max attempts | `job_enqueue` consumed | Composite `(asset_id, workspace_id)` check | Missing `ffprobe` binary, corrupted media format |
| `source_refresh` | `handlers/sourceRefresh.ts` | `{ source_id, feed_url }` | Updates `source_registry.health_status` & evidence | Public RSS/Atom feed | 3 max attempts | `job_enqueue` consumed | Workspace-scoped `source_registry` | Feed timeout, malformed XML, blocked citability |
| `embedding_refresh` | `handlers/embeddingRefresh.ts` | `{ entity_type, entity_id }` | Inserts `retrieval_embeddings` | Database client | 3 max attempts | `job_enqueue` consumed | Workspace-scoped entity match | DB write conflict |
| `conversation_import_validate` | `handlers/conversationImportValidate.ts` | `{ batch_id, csv_text, mappings }` | Updates `import_batches` status | Database client | 3 max attempts | `job_enqueue` consumed | Workspace-scoped `import_batches` | Malformed CSV headers, missing required columns |
| `conversation_deduplicate` | `handlers/conversationDeduplicate.ts` | `{ batch_id }` | Flags duplicate `idempotency_key`s | Database client | 3 max attempts | `job_enqueue` consumed | Workspace-scoped observations | Database transaction conflict |
| `conversation_interpretation_proposal` | `handlers/conversationInterpretationProposal.ts` | `{ observation_id, twin_id }` | Inserts `conversation_interpretations` (`unreviewed`) | Groq Gateway / Model Gateway | 3 max attempts | Pre-consumes `model_call` quota | Workspace-scoped observations & twins | Quota exhaustion, inference rejection |
| `conversation_attribution` | `handlers/conversationAttribution.ts` | `{ observation_id, twin_id, claim_id }` | Inserts `conversation_attributions` | Database client | 3 max attempts | `job_enqueue` consumed | Composite `(claim_id, workspace_id)` | Foreign reference mismatch |
| `conversation_aggregate` | `handlers/conversationAggregate.ts` | `{ time_window, metric_key }` | Aggregates volume in `workspaces.timezone` | Database client | 3 max attempts | `job_enqueue` consumed | Workspace-scoped timezone bucketing | Missing baseline sets `baseline_status = 'unknown'` |
| `simulation_validate` | `handlers/simulationHandlers.ts` | `{ simulation_id }` | Transitions `simulation_runs` to `validated` | Mutation validator engine | 3 max attempts | `job_enqueue` consumed | Composite `(simulation_id, workspace_id)` | Boundary constraint violation |
| `simulation_execute` | `handlers/simulationHandlers.ts` | `{ simulation_id }` | Inserts `simulation_results` (`evidence_class = 'simulation'`) | Council Specialist DAG | 3 max attempts | Pre-consumes quota per simulated specialist | Composite `(simulation_id, workspace_id)` | Execution timeout, specialist fallback |
| `simulation_review_ready` | `handlers/simulationHandlers.ts` | `{ simulation_id }` | Sets `review_status = 'pending_review'` | Database client | 3 max attempts | `job_enqueue` consumed | Workspace-scoped simulation | Missing human reviewer assignment |
| `simulation_observed_link` | `handlers/simulationHandlers.ts` | `{ simulation_id, post_observation_id }` | Inserts `simulation_observed_links` (traceability only) | Database client | 3 max attempts | `job_enqueue` consumed | Composite `(source_id, workspace_id)` check | Mismatched metric or variant attribution |

---

## 3. Worker Hosting Decision Matrix

| Hosting Topology | Monthly Infrastructure Cost | Process Persistence | Cold Start Impact | System Binaries (`ffprobe`) | Secret Management | Graceful Shutdown | Production Recommendation |
|---|---|---|---|---|---|---|---|
| **Local Operator Worker** (`npm run worker:dev`) | **$0** | Depends on operator computer remaining awake | 0ms (Immediate) | Local OS installation | Local `.env` (git-ignored) | Native OS signals (`SIGINT`/`SIGTERM`) | **Approved for Private Beta (Operator Only)** |
| **WebDev Reserved / Managed Container** (e.g. Fly.io / Railway / Cloud Run with min-instances=1) | **$5 – $15** | Continuous 24/7 background polling | 0ms (Always warm) | Built into standard multi-stage `Dockerfile` | Platform Environment Secrets | Container SIGTERM trap with 15s drain | **Recommended for Public Beta** |
| **Serverless Autoscale** (min-instances=0) | Variable ($0 – $5) | Process killed when inactive | 2s – 10s cold start breaks polling loop | Supported via container image | Platform Secrets | Hard kill on scale-to-zero | **Not Recommended** (Polling loops require persistent execution) |
| **Dedicated Cloud Computer / VM** | **$20 – $50+** | Continuous 24/7 | 0ms | Manual apt-get provisioning | Server environment / Vault | Systemd service management | **Unnecessary Overhead** (Containerization is strictly superior) |

### Hosting Verdict:
- **Private Beta:** Retain **Local Operator Worker** (zero cost, immediate execution for trusted beta testers).
- **Public Beta Transition:** Deploy Node worker and Python analysis service via multi-stage `Dockerfile` to a managed container runtime (e.g. Fly.io / Cloud Run with 1 persistent instance).

---

## 4. Continuous-Runtime Production Gates

Before transitioning to `continuous worker runtime verified` or `public-beta ready`, the following 12 gates must be proven:

1. [x] **Reproducible Build:** `npm run build` and `tsc -p services/job-worker/tsconfig.json` succeed cleanly with 0 errors.
2. [x] **Verified System Dependencies:** `ffprobe` command execution and fallback failure paths unit tested (`ffprobe.test.ts`).
3. [x] **Server-Only Secrets:** `SUPABASE_SERVICE_ROLE_KEY` and `ANALYSIS_SERVICE_TOKEN` isolated from browser bundles.
4. [x] **Healthcheck Endpoints:** Python analysis worker exposes `/healthz`; Node worker reports heartbeat via structured logs.
5. [x] **Automated Recovery & Stale Lock Sweep:** `release_stale_jobs(300)` runs on worker boot and sweeps expired worker locks.
6. [x] **Graceful Shutdown:** `SIGINT`/`SIGTERM` handlers allow in-flight job completion before process exit.
7. [x] **Tenant Fortress:** Cross-workspace job claiming and execution structurally prevented via composite keys and RPC ownership checks.
8. [x] **Sanitized Logging:** Correlation IDs and operational metadata logged; customer text, prompts, and secrets strictly redacted.
9. [ ] **Persistent Process Deployment:** Production container hosting active with automatic restart policy. *(Pending operator deployment)*
10. [ ] **Automated Retention Scheduler:** Scheduled cron executing daily `purge_expired_artifacts(limit)`. *(Pending)*
11. [ ] **Dead-Letter & Alert Telemetry:** Sentry / Datadog alerting for dead-letter spikes ($> 5$ failed jobs/hour). *(Pending)*
12. [ ] **Automated Staging Rollback Drill:** Verified zero-downtime rollback procedure for container images. *(Pending)*

---

## 5. Retention & Scheduled Execution Policy

- **Current Status:** `pending` (No automated cron daemon configured in Supabase Free tier).
- **Safe Manual Operator Runbook:**
  ```sql
  -- Run weekly or after heavy batch testing
  SELECT * FROM public.purge_expired_artifacts(100);
  ```
- **Safety Invariant:** `purge_expired_artifacts` operates strictly on rows where `retention_until < NOW()`, safely preserving active artifacts and leaving other tenants completely unaffected (verified in live tests).

---

## 6. Operational Monitoring & Recovery Design

- **Operational Metrics Logged per Job:**
  - `job_id`, `correlation_id`, `workspace_id`, `job_type`, `worker_id`
  - `latency_ms`, `attempts`, `status` (`running`, `succeeded`, `retryable`, `dead`)
  - `error_kind` (`transient`, `permanent`, `quota_exhausted`, `upstream_error`)
- **Alerting Thresholds (Recommended for Public Beta):**
  - **Dead-Letter Alert:** Trigger when $\ge 3$ jobs transition to `dead` within 15 minutes.
  - **Stale Lock Alert:** Trigger when `release_stale_jobs` releases $> 0$ jobs (indicates worker crash or timeout).
  - **Quota Depletion Alert:** Trigger when $> 10$ jobs fail due to quota exhaustion in a single workspace.
