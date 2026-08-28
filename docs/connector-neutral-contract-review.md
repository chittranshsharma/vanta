# Vanta Connector-Neutral Capability & Contract Review

**Status:** Phase 5A Specification & Architecture Review  
**Date:** 2026-08-29  
**Core Invariant:** A connected account token does **never** imply that automated sync or messaging is active.

---

## 1. Provider-Neutral Capability Matrix

Vanta models external platform integration through explicit, decoupled capabilities with deterministic states.

| Capability | Scope / Domain | Current State | Backing Data Contract | Guardrail / Boundary Rule |
|---|---|---|---|---|
| **Account Metadata** | Identity, Account ID, Handle, Verification Status | `ready` | `connector_accounts` | Tenant-isolated, encrypted access tokens (`tokenCrypto.ts`), manual connection only. |
| **Comments / Observations** | Audience comments, feedback text, timestamps | `ready` (CSV / manual only) | `conversation_observations` | Strict `evidence_class = 'observed'`, pseudonymized `author_ref`, immutable source trigger. |
| **Inbound Webhooks** | Real-time event ingestion | `not implemented` | Future webhook receiver | Deferred. Requires verified HTTPS public endpoint, HMAC signature check, and idempotency keying. |
| **Insights / Outcomes** | Post engagement, impressions, reach | `ready` (CSV / manual only) | `experiment_outcomes`, `post_observations` | Exact observed metrics; ambiguous dates flagged; missing baseline returns `unknown`. |
| **Private Replies** | 1-to-1 reply drafts to comments | `blocked` / `not implemented` | `shared/conversations/replyDrafts.ts` | Draft validation only. Fails closed if Brand Codex claims/proofs are missing. **No automated sending.** |
| **Outbound Messaging / Auto-DM** | Outbound direct messaging | `blocked` / `not applicable` | None | **Strictly prohibited.** Vanta does not perform automatic DMs, mass messaging, or scraping. |
| **Content Publishing** | Scheduled or direct post dispatch | `not implemented` | `shared/publishing/batches.ts` | Planning and test-window suggestion only; direct API dispatch deferred. |

---

## 2. Event Mapping & Traceability Pipeline

When official connectors are introduced in future phases, all incoming signals must strictly map to Vanta's foundational evidence entities without bypassing provenance:

```
External Platform Event (e.g. IG Comment)
  │
  ├── 1. Provider / Account Identity ─────────► connector_accounts (id, provider, account_id)
  │
  ├── 2. Sourced Raw Signal (Immutable) ──────► conversation_observations (
  │                                               source_id,
  │                                               author_ref: "anon_<sha256>",
  │                                               raw_text,
  │                                               idempotency_key: "ig:comment:<id>",
  │                                               evidence_class: "observed"
  │                                             )
  │
  ├── 3. Explicit Human Linking ──────────────► conversation_attributions (
  │                                               twin_id,
  │                                               brand_claim_id,
  │                                               experiment_id,
  │                                               cta_identifier
  │                                             )
  │
  ├── 4. Inference Proposal (Draft) ──────────► conversation_interpretations (
  │                                               evidence_class: "inference",
  │                                               review_state: "unreviewed",
  │                                               uncertainty_note: "..."
  │                                             )
  │
  └── 5. Aggregated Performance ──────────────► experiment_outcomes / post_observations (
                                                  exact metrics in workspace timezone
                                                )
```

---

## 3. Contract Adequacy Assessment

1. **Database Schema:** Tables (`connector_accounts`, `conversation_observations`, `conversation_interpretations`, `conversation_attributions`, `import_batches`, `post_variant_attributions`) provide complete foreign key integrity, composite tenant constraints, and immutability triggers.
2. **Privacy Integrity:** Customer PII is prevented from entering database storage through SHA-256 pseudonymization.
3. **No Schema Gaps Identified:** Current database schemas (Migrations 001–020) fully support connector-neutral intake without requiring new migrations.
