# Vanta — Counterfactual Simulation Productization & Backend Architecture

**Status:** Authoritative Design Specification (Phase 6B)  
**Scope:** Persistent Storage, Transactional Server Boundary, State Machines, Job Queue Integration, Review Governance, and Immutability Contracts.

---

## 1. Executive Summary & Core Invariants

Phase 6B transforms the in-memory Counterfactual Simulation Lab domain (Ticket 6.1) into an authenticated, durable, tenant-isolated, and idempotent backend capability.

### Core Invariants:
1. **Strict Epistemic Isolation:** Simulation records are permanently classified as `evidence_class = 'simulation'` and `observed_validation = 'unknown'` (or `'linked'` once post-hoc traceability is established).
2. **Zero Data Contamination:** Simulation results NEVER enter `experiment_outcomes` or `post_observations`, and never serve as historical baselines for optimization.
3. **Deterministic First (v1 Standard):** Simulations compute structural deltas deterministically (duration, reading burden/WPM, scene counts, claim density). They NEVER fabricate performance forecasts, reach predictions, virality scores, ROI estimates, or lift calculations.
4. **Immutable Provenance:** Simulation runs, mutations, structural results, review events, and traceability links are immutable. Direct client `UPDATE` and `DELETE` operations are denied at the database policy level (`USING (false)`). Cancellation is an authorized state transition, never a destructive delete.
5. **Human Governance Checkpoint:** Human review records an administrative decision (`review_decision = 'accepted'`, `'rejected'`, `'corrected'`, or `'needs_human'`) but NEVER promotes hypothetical simulation output to empirical truth.
6. **Traceability Only:** Observed linkages connect real physical experiment outcomes to prior simulations strictly for historical audit and attribution. v1 computes zero variance, lift, or accuracy metrics.

---

## 2. Persistent Storage Schema (Migration 021)

Additive migration `20260822000021_simulation_lab.sql` introduces 5 tenant-isolated, composite-keyed tables:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          public.simulation_runs                         │
│  - id: UUID (PK)                                                       │
│  - workspace_id: UUID (FK -> workspaces)                               │
│  - twin_id, twin_version_id, twin_version (Composite FKs)              │
│  - hypothesis: TEXT (<= 500 chars)                                     │
│  - controls: JSONB                                                     │
│  - status: draft | queued | running | completed | blocked | failed     │
│            | cancelled                                                 │
│  - evidence_class: 'simulation' (CHECK constraint)                     │
│  - observed_validation: 'unknown' | 'linked'                           │
│  - review_decision: unreviewed | needs_human | accepted | rejected      │
│                     | corrected                                        │
│  - idempotency_key: TEXT (UNIQUE with workspace_id)                    │
│  - created_by, created_at, completed_at, uncertainty_note              │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │ 1:N                      │ 1:1                      │ 1:N
         ▼                          ▼                          ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│ simulation_mutations │  │  simulation_results  │  │simulation_review_evts│
│ - sequence_order: INT│  │ - simulated_scenes   │  │ - event_kind         │
│ - mutation_type: TEXT│  │ - structural_delta   │  │ - previous_decision  │
│ - target_scene_index │  │ - council_execution  │  │ - new_decision       │
│ - rationale: TEXT    │  │ - warnings: JSONB    │  │ - rationale: TEXT    │
│ - payload: JSONB     │  │ (Immutable)          │  │ (Append-Only)        │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
         │
         │ 1:N
         ▼
┌────────────────────────────────────────┐
│       simulation_observed_links        │
│ - experiment_outcome_id: UUID          │
│   (FK -> experiment_outcomes)          │
│ - note, metadata, created_by           │
│ (Traceability Only — No Lift/Variance) │
└────────────────────────────────────────┘
```

### Table Security & Immutability Matrix

| Table Name | SELECT Policy | INSERT Policy | UPDATE Policy | DELETE Policy | Immutability Trigger |
|---|---|---|---|---|---|
| `simulation_runs` | `is_workspace_member` | `created_by = auth.uid()` | `USING (false)` | `USING (false)` | `trg_block_simulation_run_core_mutation` |
| `simulation_mutations` | `is_workspace_member` | `created_by = auth.uid()` | `USING (false)` | `USING (false)` | Denied by RLS policy |
| `simulation_results` | `is_workspace_member` | `created_by = auth.uid()` | `USING (false)` | `USING (false)` | Denied by RLS policy |
| `simulation_review_events` | `is_workspace_member` | `created_by = auth.uid()` | `USING (false)` | `USING (false)` | Denied by RLS policy |
| `simulation_observed_links` | `is_workspace_member` | `created_by = auth.uid()` | `USING (false)` | `USING (false)` | Denied by RLS policy |

---

## 3. State Machines & Lifecycle Transitions

### 3.1 Simulation Run Status Lifecycle
```
[draft] ──► [queued] ──► [running] ──► [completed]
   │           │            │
   ▼           ▼            ▼
[cancelled] [cancelled] [failed] / [cancelled]
```

- Status transitions are guarded by `public.transition_simulation_run_status_atomic`.
- Cancellation is permitted only for the run creator or workspace admins/owners.
- Terminal statuses: `completed`, `failed`, `cancelled`.

### 3.2 Review Governance State Machine
```
[unreviewed] ──► [needs_human] ──► [accepted] ──► [corrected]
     │                 │              │                │
     ▼                 ▼              ▼                ▼
 [rejected]        [rejected]     [rejected]       [accepted]
```

- Evaluated exclusively by `public.review_simulation_run_atomic`.
- Invalid transitions (e.g. arbitrary reversion from rejected to completed without review) are rejected with PostgreSQL exceptions.
- Human acceptance logs an append-only audit event in `simulation_review_events` while strictly keeping `evidence_class = 'simulation'`.

### 3.3 Background Job State Machines
Four simulation job types registered in `shared/jobs/policy.ts` and `jobs_job_type_check`:
1. `simulation_validate`: Pre-flight verification of twin version snapshots, mutation parameter bounds, and Brand Codex claim citations.
2. `simulation_execute`: Executes deterministic domain mutation engine, writes `simulation_results`, and transitions run status to `completed`.
3. `simulation_review_ready`: Transitions run `review_decision` to `needs_human` and logs initial review request event.
4. `simulation_observed_link`: Atomically connects real `experiment_outcomes` record for post-hoc traceability.

---

## 4. Authenticated Service Boundary (`src/lib/simulations.ts`)

| Operation | Function Signature | Enforcement Mechanism |
|---|---|---|
| **Create & Persist** | `createPersistentSimulationRun(input)` | Server-side `create_simulation_run_atomic` RPC (single atomic transaction). |
| **List Runs** | `listSimulationRuns(workspaceId, filter)` | Tenant-scoped fail-closed read. |
| **Fetch Details** | `fetchSimulationRunDetails(workspaceId, runId)` | Parallel composite read of run, mutations, results, review events, and links. |
| **Human Review** | `reviewSimulationRun(input)` | Server-side `review_simulation_run_atomic` RPC with transition validation. |
| **Traceability Link** | `linkSimulationObservedOutcome(input)` | Server-side `link_simulation_observed_outcome_atomic` RPC. |
| **Status Transition** | `transitionSimulationRunStatus(input)` | Server-side `transition_simulation_run_status_atomic` RPC. |
| **Enqueue Job** | `enqueueSimulationJob(input)` | Pre-flight daily quota check (`consume_quota`) + deterministic idempotency key. |

---

## 5. Privacy, Redaction & Tenant Boundaries

- **Audit & Telemetry Redaction:** `audit_events` and worker logs record only sanitized entity IDs, timestamps, mutation counts, and status transitions. Raw prompt text, AI completions, customer text, proof text, and tokens are NEVER written to logs.
- **Cross-Tenant Prevention:** All queries and RPCs enforce composite `(id, workspace_id)` keys. Foreign keys ensure baseline twins, substitute claims, proof points, and experiment outcomes belong to the exact caller workspace.
- **Fail-Closed Authorization:** Missing sessions, unauthenticated RPC calls, or non-member queries fail closed with explicit PostgreSQL authorization errors.
