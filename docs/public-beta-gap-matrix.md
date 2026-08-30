# Vanta — Non-Frontend Public-Beta Gap Matrix & Release Paths

**Document Version:** 1.0.0  
**Date:** 2026-08-30  
**Status:** Authoritative Pre-Release Operational Assessment  
**Evidence Standard:** Canonical 5-Class Taxonomy (`observed`, `sourced`, `inference`, `simulation`, `unknown`). `linked` is an operational relationship/status only, never an evidence class.

---

## 1. Executive Summary

All domain, persistence, isolation, and security capabilities for Vanta's core intelligence engine are complete and verified across 935 automated tests (920 Vitest + 15 Pytest) and remote Supabase PostgreSQL checks (Migrations 001–022).

This document establishes the exact non-frontend readiness posture, operational classifications, gap matrix, and release paths comparing a **Zero-Cost Private Beta** against a **Full Public Beta**.

---

## 2. Non-Frontend Public-Beta Gap Matrix

| # | Operational Domain | Current Classification | Repository / Verified State | Required Production Action | Blocked By / Dependencies |
|---|---|---|---|---|---|
| **1** | **Continuous Node Worker Hosting** | `tested-local-only` | 14 registered job handlers, exponential backoff, dead-lettering, stale lock sweeper (`services/job-worker`). | Deploy 24/7 container daemon (e.g. Fly.io, Cloud Run, or VPS) with health probe. | Operator hosting selection. |
| **2** | **Continuous Python Analysis Service** | `tested-local-only` | FastAPI media/ETL service with `ffprobe` integration and 15 passing tests (`services/analysis-worker`). | Deploy containerized FastAPI runtime with `ffmpeg`/`ffprobe` system binaries. | Operator hosting selection. |
| **3** | **Production HTTPS & Exact CORS** | `pending operator decision` | Edge function `model-gateway` v9 deployed; public CORS wildcard deferred to avoid CSRF. | Register production domain (e.g. `app.vanta.ai`), provision SSL, allowlist origin in Edge Function secrets. | Production domain registration. |
| **4** | **Automated Retention Scheduler** | `manual-only` | `purge_expired_derived_artifacts` RPC and manual sweep safety verified live. | Configure daily cron execution (via `pg_cron` extension, Supabase Scheduled Functions, or worker daemon cron). | Operator scheduler setup. |
| **5** | **Production Monitoring & Alerting** | `manual-only` | Sanitized JSON audit logging, quota tracking, `jobs.last_error` logging, and 12 runbook scenarios. | Connect external error tracking (e.g. Sentry) and operational dead-letter alerts (Slack/PagerDuty webhook). | Operator monitoring setup. |
| **6** | **Secret Rotation & Revocation** | `manual-only` | AES-256-GCM token encryption (`tokenCrypto.ts`), atomic revocation RPCs, zero client-side secret exposure. | Establish periodic secret rotation schedule for `GROQ_API_KEY`, `CONNECTOR_TOKEN_KEY`, and database service role. | Operator key management. |
| **7** | **Backup / Restore & Rollback Drill** | `manual-only` | Supabase platform daily backups active; documented manual recovery and migration rollback procedures. | Execute formal staging disaster recovery and PITR restoration drill. | Operator schedule. |
| **8** | **Rate-Limit & Cost Controls** | `complete` | Daily quotas on `job_enqueue`, `model_call`, `media_probe` via atomic `consume_quota` RPC; gateway rate limits active. | Monitor quota exhaustion metrics under live multi-tenant traffic. | None (Fully complete & verified). |
| **9** | **Provider OAuth Prerequisites** | `pending operator decision` | Provider-neutral contracts, HMAC state verification, webhook signatures, and pure tests (`shared/connectors/instagram.ts`). | Register official Meta for Developers, Google Cloud Console, and TikTok Developer apps; configure redirect URIs. | Operator developer app registration. |
| **10** | **Incident Recovery & Operator Access** | `complete` | 12 incident recovery runbooks documented in `docs/incident-and-recovery-runbook.md`. | Ensure on-call operators have authenticated CLI / Supabase dashboard access. | None (Fully complete & verified). |
| **11** | **Authenticated Browser Flow (QA-2)** | `blocked by frontend` | Real-JWT multi-tenant isolation suite passing (47/47 tables in QA-1). Full UI browser E2E pending. | Implement Ticket 6.2 UI (Workspace & Council UI Integration) and execute QA-2 browser test suite. | Frontend Ticket 6.2. |

---

## 3. Two Defined Release Paths

### Path A: Zero-Cost Private Beta (Recommended Immediate Path)
- **Infrastructure Cost:** $0 / month (Supabase Free Tier + Local Operator Runtime).
- **Execution Model:**
  - Background jobs and analysis tasks executed on-demand by the operator via local worker daemon (`npm run worker` / `uvicorn`).
  - Signal ingestion conducted through verified CSV/manual upload paths (`import_batches`).
  - Retention sweeps executed manually via `purge_expired_derived_artifacts`.
  - Claim Grounding Audit gated by owner/admin authorization and server-only Groq Edge Gateway v9.
  - No public OAuth app registration or continuous hosting required.
- **Audience:** Trusted pilot brands, internal operators, and design partners.
- **Status:** **Ready for immediate operation.**

### Path B: Public Beta
- **Infrastructure Requirements:**
  - Continuous managed container hosting for Node worker and Python FastAPI service ($10–$30/mo).
  - Production HTTPS custom domain with strict CORS allowlisting.
  - Automated cron scheduling for retention purges and connector polling.
  - Sentry / PagerDuty error alerting on job dead-letter queue.
  - Verified Meta, Google, and TikTok Developer App registrations with App Review approval.
  - Completion of Frontend Ticket 6.2 (Workspace & Council UI Integration) and QA-2 authenticated browser verification.
- **Status:** **Blocked on hosting deployment, domain/OAuth configuration, and frontend Ticket 6.2.**

---

## 4. Recommendation for Next Operator Action

1. **Adopt Path A (Zero-Cost Private Beta) immediately.**
2. Do **not** deploy paid hosting, register live OAuth apps, or enable public CORS at this stage.
3. Proceed with **Frontend Ticket 6.2** (Workspace, Specialist Council, Simulation Lab UI integration with restrained ReactBits polish) to unblock the remaining browser user workflows and QA-2.
