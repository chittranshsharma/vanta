# Worker Architecture & Conversation Job Handlers

**Status:** Phase 4 Specification  
**Date:** 2026-08-29  
**Service:** `services/job-worker` (Node.js Service-Role Worker) & Shared Domain Contracts

---

## 1. Overview & Operational Principles

The Vanta Job Worker (`services/job-worker`) processes asynchronous, multi-step tasks using PostgreSQL `jobs` table with transactional claiming (`claim_next_job` with `FOR UPDATE SKIP LOCKED`), heartbeat management (`release_stale_jobs`), and transactional completion/failure reporting (`complete_job` / `fail_job`).

### Core Safety Rules:
1. **Tenant Isolation:** Every job handler strictly filters and verifies all entity references against `job.workspace_id`. Cross-workspace foreign references cause immediate, permanent job failure.
2. **Quota & Rate Limiting:** All costly model or worker tasks must consume quota via atomic `consume_quota` before execution and fail closed if quota is exhausted or unavailable.
3. **No Unreviewed Mutation of Facts:** Worker handlers create proposals (`evidence_class = 'inference'`, `review_state = 'unreviewed'`) or validate raw inputs (`evidence_class = 'observed'`). No background job may silently promote an inference to an observed fact or alter immutable source text.
4. **Idempotency & Retry Classification:** Handlers distinguish between transient failures (network/timeouts -> exponential backoff retry) and permanent failures (validation/cross-tenant -> dead-letter immediately).
5. **No Secret / Customer Text in Logs:** All logging output adheres to structured single-line JSON format with operational metadata only (counts, correlation IDs, status, latencies). Raw prompt text, customer comments, and API tokens are never written to logs or audit records.

---

## 2. Conversation Job Handlers

### 1. `conversation_import_validate`
- **Purpose:** Validates registered import batch and candidate observation rows.
- **Payload:** `{ batch_id: string, source_id: string, candidates?: ConversationObservationCandidate[], raw_csv?: string }`
- **Output:** `{ valid_count: number, rejected_count: number, rejection_reasons: Array<{ line: number, reason: string }> }`
- **Failure:** Permanent if batch or source is missing / cross-tenant; transient on database read error.

### 2. `conversation_deduplicate`
- **Purpose:** Scans workspace observation records for duplicate idempotency keys.
- **Payload:** `{ batch_id?: string, since?: string }`
- **Output:** `{ scanned_count: number, unique_count: number, duplicate_count: number }`
- **Behavior:** Never deletes observations silently; flags duplicate counts in batch metadata and audit log.

### 3. `conversation_interpretation_proposal`
- **Purpose:** Generates inference-layer interpretation proposals for unreviewed observations.
- **Payload:** `{ observation_ids: string[], prompt_version?: string }`
- **Output:** `{ proposed_count: number, interpretation_ids: string[] }`
- **Invariants:** 
  - `evidence_class = 'inference'`
  - `review_state = 'unreviewed'`
  - Mandatory `uncertainty_note`
  - Validates supporting IDs belong to `job.workspace_id`.

### 4. `conversation_attribution`
- **Purpose:** Explicitly maps audience observations to Creative Twins, variants, claims, CTAs, and experiments.
- **Payload:** `{ observation_id: string, twin_id?: string, variant_twin_id?: string, twin_version_id?: string, brand_claim_id?: string, experiment_id?: string, cta_identifier?: string, destination_url?: string }`
- **Invariants:** Never guesses links based on text/time similarity; requires explicit foreign IDs and validates workspace ownership.

### 5. `conversation_aggregate`
- **Purpose:** Computes deterministic observation volumes bucketed by workspace timezone (`workspaces.timezone`).
- **Payload:** `{ since?: string, until?: string, bucket_size?: 'hour' | 'day' }`
- **Output:** Exact bucketed observation counts, baseline status (`recorded` vs `unknown`), and observed spike explanations without virality claims.
