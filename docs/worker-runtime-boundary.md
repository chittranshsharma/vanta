# Vanta Worker Runtime Boundary & Architecture

**Status:** Phase 5A Verified Specification  
**Date:** 2026-08-29  
**Services:** `services/job-worker` (Node.js) & `services/analysis-worker` (Python FastAPI)

---

## 1. Executive Summary & Runtime Topology

Vanta utilizes a dual-worker backend design operating outside the browser context:

```
[ PostgreSQL / Supabase ]
      ▲           ▲
      │ (claim /  │ (read / write)
      │ complete) │
      ▼           ▼
┌───────────────────────────┐         HTTP (Shared Bearer Token)        ┌────────────────────────────┐
│   services/job-worker     │ ────────────────────────────────────────► │  services/analysis-worker  │
│      (Node.js 22+)        │                                           │     (Python 3.11+ FastAPI) │
│ - claim_next_job (RPC)    │                                           │ - Pure algorithmic compute │
│ - release_stale_jobs      │                                           │ - Pandas/Numpy CSV parser  │
│ - complete_job / fail_job │                                           │ - No DB access / stateless │
└───────────────────────────┘                                           └────────────────────────────┘
      │
      ▼ (local child_process)
┌───────────────────────────┐
│     ffprobe / ffmpeg      │ (System binary dependency for media_probe)
└───────────────────────────┘
```

---

## 2. Job Handlers and Producer Map

| Job Type | Handler Location | Execution Environment | Binary / Network Dependencies | Producer / Trigger Surface |
|---|---|---|---|---|
| `model_task` | Model Gateway Edge Function | Supabase Edge Runtime / Groq API | HTTPS to Groq API | Decision Room / Claim Grounding Audit UI |
| `campaign_csv_normalize` | `services/job-worker` -> `services/analysis-worker` | Node.js Worker forwards to Python FastAPI | `ANALYSIS_SERVICE_URL`, `ANALYSIS_SERVICE_TOKEN` | Outcome Import UI / Campaign Batch Ingest |
| `media_probe` | `services/job-worker` | Node.js Worker (`child_process.execFile`) | `ffprobe` (system binary in PATH) | Creative Intake Asset Ingestion |
| `source_refresh` | `services/job-worker` | Node.js Worker | Outbound HTTPS (Public RSS/Atom feeds only) | Source Registry Refresh (Admin Approval Required) |
| `embedding_refresh` | `services/job-worker` | Node.js Worker | Supabase PostgreSQL client | Brand Brain / Evidence Item Updates |
| `conversation_import_validate` | `services/job-worker` | Node.js Worker | Supabase PostgreSQL client | Conversation CSV Import Client |
| `conversation_deduplicate` | `services/job-worker` | Node.js Worker | Supabase PostgreSQL client | Conversation Deduplication Trigger |
| `conversation_interpretation_proposal` | `services/job-worker` | Node.js Worker | Supabase RPC (`consume_quota`) + DB client | Conversation Intelligence Proposal Runner |
| `conversation_attribution` | `services/job-worker` | Node.js Worker | Supabase PostgreSQL client | Operator Conversation Attribution Action |
| `conversation_aggregate` | `services/job-worker` | Node.js Worker | Supabase PostgreSQL client | Conversation Spike & Volume Aggregator |

---

## 3. Environment & Security Invariants

### 3.1 Node Job Worker (`services/job-worker`)
- **Required Environment Variables:**
  - `SUPABASE_URL`: HTTPS URL of Supabase project.
  - `SUPABASE_SERVICE_ROLE_KEY`: Service role key (strictly backend-only; never exposed to browser or client code).
  - `ANALYSIS_SERVICE_URL` (optional, required for `campaign_csv_normalize`): `http://localhost:8000`.
  - `ANALYSIS_SERVICE_TOKEN` (optional, required for `campaign_csv_normalize`): Shared secret bearer token.
- **Worker Identity:** Hostname + random UUID slice (e.g. `hostname-a1b2c3d4`).
- **Claim Mechanism:** `claim_next_job(p_worker_id, p_job_types)` using PostgreSQL `FOR UPDATE SKIP LOCKED`.
- **Stale Lock Recovery:** `release_stale_jobs(p_older_than_seconds: 300)` executed automatically on worker startup and swept periodically.
- **Shutdown Handling:** Traps `SIGINT` and `SIGTERM` for zero in-flight data corruption.

### 3.2 Python Analysis Service (`services/analysis-worker`)
- **Required Environment Variables:**
  - `ANALYSIS_SERVICE_TOKEN`: Shared bearer token. Fails closed (503) if unset.
- **Database Access:** Zero direct database access. Receives input payloads via POST and returns typed results with explicit mathematical provenance.

---

## 4. Local Zero-Cost Test Mode vs. Continuous Hosting

- **Local Test Mode:** Both services run on the operator's local development machine. Zero infrastructure costs.
- **Limitation:** The local machine must remain powered on, connected to the internet, and running the node process to continuously claim background jobs.
- **Continuous Production Hosting (Deferred):** A persistent background container host (e.g., Fly.io, Railway, or managed VM) requires operator approval, secret management, health monitoring, and system binary provisioning (`ffprobe`).
