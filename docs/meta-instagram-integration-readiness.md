# Official Meta & Instagram Platform Integration Readiness

**Status:** Phase 5A Preparation & Architectural Checklist  
**Date:** 2026-08-29  
**Scope:** Technical and Compliance Prerequisites for Future Official Instagram Integration

---

## 1. Official Platform Prerequisites & Account Eligibility

Per official Meta documentation ([Instagram Platform Overview](https://developers.facebook.com/documentation/instagram-platform/overview)):
1. **Professional Account:** Target Instagram accounts must be converted to an **Instagram Professional Account** (Business or Creator) linked to a verified Facebook Page or set up with Instagram Login for Business.
2. **Meta App Registration:** A verified Meta Developer App in the "Business" category with Business Verification completed.
3. **App Review & Permissions:** Production access requires App Review submission and approval for specific granular permissions:
   - `instagram_basic`: Read profile info and media metadata.
   - `instagram_manage_comments`: Read and moderate comments on workspace-owned media.
   - `instagram_manage_insights`: Access metrics on posts, stories, and reels.
   - `instagram_manage_messages`: Required if private reply capabilities are enabled.

---

## 2. Inbound Signal Ingestion (Comments & Webhooks)

Per [Comment Moderation Documentation](https://developers.facebook.com/documentation/instagram-platform/comment-moderation):
- **Webhooks Verification:** Webhook endpoints must respond to `GET` hub challenge verification (`hub.mode = subscribe`, `hub.verify_token`, `hub.challenge`).
- **Signature Authentication:** Every incoming payload headers must be validated against `X-Hub-Signature-256` using HMAC-SHA256 with the app secret.
- **Replay Protection:** Unique event ID + timestamp deduplication using `UNIQUE (workspace_id, idempotency_key)` on `conversation_observations`.
- **Author Pseudonymization:** Real usernames or IDs must immediately be hashed (`anon_<sha256(workspace:author_id)>`) to maintain customer privacy boundaries.

---

## 3. Insights & Observed Outcomes

Per [Instagram Insights Documentation](https://developers.facebook.com/documentation/instagram-platform/insights):
- Metrics are queried for media owned by the authorized account (`impressions`, `reach`, `saved`, `video_views`, `shares`).
- Metrics must be stored as **observed facts** in `experiment_outcomes` and `post_observations`.
- Ambiguous dates and timezone differences must be explicitly normalized against `workspaces.timezone`.
- When baselines are absent, Vanta reports `baseline_status = 'unknown'` and never projects guaranteed future reach or algorithm scores.

---

## 4. Private Replies & Outbound Policy Constraints

Per [Private Replies Documentation](https://developers.facebook.com/documentation/instagram-platform/private-replies):
- **7-Day Window:** A private reply can only be sent within 7 days of the user's comment.
- **One Reply Per Comment:** Meta permits exactly **one** private reply per comment ID. Subsequent attempts fail with API error.
- **Human-in-the-Loop Required:** Vanta strictly enforces human review (`review_state = 'approved'`) and approved Brand Codex proof citations before any draft can be queued.
- **Prohibited Patterns:** No automated bulk spamming, no fake reviews, no deceptive claims, and no ungrounded marketing messages.

---

## 5. Security & Token Lifecycle

- **Token Storage:** Long-lived user/page access tokens are encrypted at rest using AES-256-GCM via `services/job-worker/src/connectors/tokenCrypto.ts`.
- **Token Refresh & Revocation:** Tokens must be refreshed before 60-day expiry; deleted accounts immediately purge encrypted secrets from `connector_accounts`.
- **Tenant Isolation:** Tokens are bound strictly to `(workspace_id, id)`. One tenant can never access or query tokens of another tenant.
