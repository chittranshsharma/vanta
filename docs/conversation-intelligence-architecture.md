# Conversation Intelligence Foundation — Architecture & Data Contracts

**Status:** Phase 3 Specification (Authoring & Verification)  
**Date:** 2026-08-29  
**Core Loop:** Creative Twin → Approved Claims → CTA/Destination → Real Audience Observation → Human Review → Observed Outcome → Next Creative

---

## 1. Principles & Non-Negotiable Boundaries

1. **Provider-Neutral & Evidence-Grounded:**
   - Conversation data is imported from real audience feedback channels (CSV/manual upload first, official connectors later).
   - No mock reactions, fake sentiment scores, or simulated conversations.
   - Raw audience messages are categorized as `observed` evidence; derived insights are strictly categorized as `inference`.

2. **No Secret or Raw Customer Leakage:**
   - Privacy-safe author pseudonymization: `author_ref` is stored only as a provider-scoped ID or SHA-256 one-way hash.
   - Audit logs store only operational metadata (counts, correlation IDs, timestamps, status); never raw text or prompt content.

3. **Strict Separation of Observation vs. Interpretation:**
   - Source comments/messages are stored immutably in `conversation_observations`.
   - Interpretations (topic clusters, objections, questions, friction signals) are stored separately in `conversation_interpretations` with mandatory `uncertainty_note`.
   - Classifiers/LLMs can never alter or overwrite source observations or silently promote `inference` to `observed`.

4. **Human Review & Append-Only Audit:**
   - Human review actions (`accepted`, `rejected`, `corrected`, `needs_human`) are recorded in append-only `conversation_review_events`.
   - Rejection and correction reasons are recorded with actor binding (`created_by = auth.uid()`).

5. **Draft-Only, Source-Backed Reply Generation:**
   - Outgoing automated messaging/DMs is strictly prohibited in this phase.
   - Reply drafts may only cite approved Brand Codex claims, approved proof points, and explicit CTA destination mappings.
   - If evidence is absent, the system outputs `blocked` or `unknown`.

6. **Deterministic Spike Aggregation (No "Virality"):**
   - Spike detection reports exact observation volume in the workspace's configured timezone (`workspaces.timezone`).
   - Comparison delta is calculated only against real recorded historical baselines. If no baseline exists, status is `unknown`.

---

## 2. Schema Architecture (Migration 019)

```
workspaces (1)
  ├── source_registry (1)
  │     └── conversation_observations (N) [immutable source text, observed evidence]
  │           ├── conversation_interpretations (N) [inference evidence, uncertainty note]
  │           ├── conversation_attributions (N) [explicit links to Twin / Claim / CTA]
  │           └── conversation_review_events (N) [append-only review ledger]
  └── import_batches (1)
        └── conversation_observations (N)
```

### Table Definitions:

- **`conversation_observations`**:
  - `id`, `workspace_id`, `source_id`, `import_batch_id`, `provider`, `provider_account_ref`, `external_event_id`, `external_post_id`, `idempotency_key`, `observed_at`, `ingested_at`, `author_ref`, `raw_text`, `text_sha256`, `character_count`, `evidence_class = 'observed'`, `review_state`, `provenance`, `retention_until`, `created_by`, `created_at`.
  - Composite FKs: `(source_id, workspace_id)` to `source_registry`, `(import_batch_id, workspace_id)` to `import_batches`.
  - Unique Constraint: `(workspace_id, idempotency_key)`.
  - Immutability trigger: blocks modification to `raw_text`, `observed_at`, `author_ref`, `text_sha256`, `evidence_class`.

- **`conversation_interpretations`**:
  - `id`, `workspace_id`, `observation_id`, `interpretation_type`, `value`, `evidence_class = 'inference'`, `model_ref`, `prompt_version`, `supporting_evidence_ids`, `uncertainty_note`, `review_state`, `reviewed_by`, `reviewed_at`, `created_by`, `created_at`.
  - Composite FK: `(observation_id, workspace_id)` to `conversation_observations`.

- **`conversation_attributions`**:
  - `id`, `workspace_id`, `observation_id`, `twin_id`, `variant_twin_id`, `twin_version_id`, `brand_claim_id`, `experiment_id`, `cta_identifier`, `destination_url`, `provenance`, `created_by`, `created_at`.
  - Composite FKs to `creative_twins`, `creative_twin_versions`, `brand_claims`, `experiments`.

- **`conversation_review_events`**:
  - `id`, `workspace_id`, `observation_id`, `interpretation_id`, `event_kind`, `previous_state`, `new_state`, `rationale`, `metadata`, `created_by`, `created_at`.
  - Append-only RLS: UPDATE and DELETE denied (`USING (false)`).
