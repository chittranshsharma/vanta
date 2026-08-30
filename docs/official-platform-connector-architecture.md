# Official Platform Connector Architecture Specification — Ticket 8.2

**Document Version:** 1.0.0  
**Status:** Pre-Implementation Specification (Architecture & Contracts Only)  
**Execution Gate:** Requires formal operator review and platform developer app verification before any live external connection.

---

## 1. Executive Summary & Epistemic Boundary

Ticket 8.2 defines the provider-neutral backend architecture for official platform connectors (Meta/Instagram Graph API, YouTube Analytics & Data API, and TikTok Business Marketing API).

### Non-Negotiable Invariants:
1. **No Outbound Mass Messaging / Auto-DMs:** Vanta does not perform automated direct messaging, bot outreach, scraping, or spam.
2. **No Hallucinated Signals:** Ingested engagement data maps directly to `evidence_class = 'observed'` without synthetic extrapolation or virality scoring.
3. **Tenant Fortress:** All credentials, tokens, and ingested observations are strictly workspace-isolated via composite foreign keys and PostgreSQL Row Level Security.
4. **Zero Client Secret Exposure:** Client secrets, refresh tokens, and decryption keys never enter the frontend bundle or browser memory.

---

## 2. Supported Providers & Explicit Permission Scopes

| Provider | Target Capabilities | Required OAuth Scopes | Prohibited Scopes |
|---|---|---|---|
| **Meta / Instagram** | Read business account posts, insights, and top-level comments | `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, `pages_show_list` | `instagram_manage_messages` (No DMs), `pages_manage_posts` (No auto-publish in v1) |
| **YouTube** | Read channel videos, playlist metadata, and aggregate analytics | `https://www.googleapis.com/auth/youtube.readonly`, `https://www.googleapis.com/auth/yt-analytics.readonly` | `https://www.googleapis.com/auth/youtube.force-ssl` (No write/delete) |
| **TikTok** | Read creator video metrics and audience insights | `user.info.basic`, `video.list`, `video.insights` | `im.chat` (No direct messaging), `video.publish` (No auto-publish in v1) |

---

## 3. OAuth 2.0 Consent & State Lifecycle

```
[ Browser / Workspace ]                  [ Supabase Edge Gateway ]                  [ Platform OAuth Provider ]
          │                                         │                                           │
          │ ── 1. Request Auth URL (workspaceId) ──►│                                           │
          │                                         │ ── 2. Generate State (HMAC + nonce) ─────►│
          │ ◄─ 3. Return Redirect URL with state ───│                                           │
          │                                                                                     │
          │ ── 4. User Grants Consent ─────────────────────────────────────────────────────────►│
          │                                                                                     │
          │ ◄─ 5. Redirect with auth code & state ──────────────────────────────────────────────│
          │                                         │                                           │
          │ ── 6. Exchange Code (POST /auth/callback) ─►                                       │
          │                                         │ ── 7. Verify State HMAC & Timestamp ───── │
          │                                         │ ── 8. Exchange Code for Tokens ──────────►│
          │                                         │ ◄─ 9. Return Access & Refresh Tokens ─────│
          │                                         │                                           │
          │                                         │ ── 10. AES-256-GCM Token Encryption ───── │
          │                                         │ ── 11. Write connector_accounts record ──► [ PostgreSQL ]
          │ ◄─ 12. Confirm Connection (Sanitized) ──│                                           │
```

### State Parameter Security:
- `state = base64url(json({ workspace_id, user_id, nonce, expires_at, hmac_signature }))`
- Edge function verifies HMAC using server-only secret `CONNECTOR_OAUTH_STATE_SECRET` to prevent CSRF attacks and cross-workspace injection.

---

## 4. Token Storage, Encryption, Rotation & Revocation

### Database Schema: `public.connector_accounts` (Migration 014)

```sql
CREATE TABLE IF NOT EXISTS public.connector_accounts (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id             UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider                 TEXT NOT NULL CHECK (provider IN ('meta_instagram', 'youtube', 'tiktok')),
  external_account_id      TEXT,
  display_name             TEXT,
  requested_scopes         TEXT[] NOT NULL DEFAULT '{}',
  granted_scopes           TEXT[] NOT NULL DEFAULT '{}',
  token_key_id             TEXT,                     -- Key version identifier
  access_token_ciphertext  TEXT,                     -- AES-256-GCM encrypted
  refresh_token_ciphertext TEXT,                     -- AES-256-GCM encrypted
  token_expires_at         TIMESTAMPTZ,
  consent_granted_at       TIMESTAMPTZ,
  consent_granted_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at               TIMESTAMPTZ,
  revoked_by               UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status                   TEXT NOT NULL DEFAULT 'connected'
                           CHECK (status IN ('connected', 'expired', 'revoked', 'error')),
  last_sync_at             TIMESTAMPTZ,
  last_error               JSONB,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, workspace_id),
  UNIQUE (workspace_id, provider, external_account_id)
);
```

### Security Invariants:
1. **Public View Sanitization:** The public view `public.connector_accounts_public` exposes ONLY `id`, `provider`, `display_name`, `status`, `last_sync_at`, `granted_scopes`. Ciphertext columns are restricted to `SECURITY DEFINER` routines and the background job worker.
2. **Encrypted Token Rotation:** Background job `connector_sync` evaluates `token_expires_at`. If `token_expires_at < now() + interval '24 hours'`, it triggers token renewal via the platform's OAuth token endpoint, re-encrypts the new token, and updates `connector_accounts`.
3. **Explicit Revocation:** Calling `revoke_connector_account` sets `status = 'revoked'`, `revoked_at = now()`, zeroes the ciphertext columns, and dispatches a revocation request to the provider's token revocation endpoint.

---

## 5. Webhook Signature Verification & Inbound Ingestion

When webhooks are configured (e.g. Meta Real-Time Updates), the Edge Function receiver enforces:

1. **HMAC Signature Verification:**
   - Meta: `X-Hub-Signature-256` verified against `META_APP_SECRET`.
   - TikTok: `X-TikTok-Signature` verified against `TIKTOK_CLIENT_SECRET`.
   - YouTube: PubSubHubbub HMAC-SHA1 verified against registered secret.
2. **Replay & Idempotency Keying:**
   - Deterministic event ID: `idempotency_key = sha256(provider || ':' || external_event_id || ':' || event_timestamp)`
   - Checked against `conversation_observations(workspace_id, idempotency_key)` to guarantee zero duplicate signal creation.

---

## 6. Provider-Event Normalization Pipeline

All platform signals normalize into Vanta's canonical entities:

```
Platform Event Payload
   │
   ├── Post / Video Metric Update ──► post_observations (
   │                                    workspace_id, source_id, external_post_id,
   │                                    published_at, metric_key, value,
   │                                    evidence_class: 'observed',
   │                                    source_citability: 'verified'
   │                                  )
   │
   ├── Audience Comment Signal ──────► conversation_observations (
   │                                    workspace_id, source_id, external_event_id,
   │                                    author_ref: sha256(salt || external_user_id),
   │                                    raw_text, text_sha256, character_count,
   │                                    evidence_class: 'observed',
   │                                    review_state: 'unreviewed'
   │                                  )
   │
   └── Experiment Metric Snapshot ───► experiment_outcomes (
                                        workspace_id, experiment_id, variant_twin_id,
                                        source_id, metric_key, value, observed_at,
                                        evidence_class: 'observed'
                                      )
```

---

## 7. Rate Limits, Quota Consumption & Worker Resilience

1. **Daily Quota Enforcement:** Ingestion jobs consume the `job_enqueue` quota via `consume_quota(p_workspace_id, 'job_enqueue', 1)`.
2. **Platform Rate Limit Backoff:** If a provider responds with HTTP 429 or platform-specific quota codes (e.g. Meta code 32/80004), the job worker calculates the `run_after` delay from the `Retry-After` header (or applies exponential backoff: $2^{\text{attempts}} \times 60\text{s}$) and transitions the job to `retryable`.
3. **Dead-Letter State:** Jobs that fail continuously for 5 attempts transition to `failed` with sanitized error logging.

---

## 8. Retention Policy & Data Minimization

1. **Pseudonymization of User References:** External user IDs and handles from comments are hashed with a workspace-scoped rotating salt into `anon_<sha256>`.
2. **Configurable Observation Retention:** `conversation_observations.retention_until` defaults to 90 days (or workspace-configured policy). Expired rows are purged by the scheduled batch sweeper.

---

## 9. Operator Checklist Before Live Connector Deployment

Before any live OAuth app is registered or activated:
- [ ] Operator creates developer app in Meta for Developers / Google Cloud Console / TikTok Developers.
- [ ] Operator configures verified HTTPS redirect URIs in developer console.
- [ ] Operator stores Client ID, Client Secret, and Token Encryption Key into Supabase Secrets (never committed to git or `.env`).
- [ ] Operator validates webhook HMAC signature verification with disposable test payloads.
- [ ] Operator runs QA-1 multi-tenant isolation suite to verify zero cross-workspace connector access.
