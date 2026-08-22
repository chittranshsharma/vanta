# Vanta — Architecture

Selected stack, app boundaries, data flow, and environment assumptions. Update this file and append an ADR in `decisions.md` before changing any layer.

## Stack

| Layer | Technology | Version / notes |
|---|---|---|
| Frontend | React | 19.2 |
| Build tool | Vite | 7.x |
| Language | TypeScript | 5.9 strict mode |
| Animation | Framer Motion | 12.x |
| Icons | Lucide React | 0.468 |
| CSS | Vanilla CSS (custom properties, no framework yet) | `src/styles.css` |
| Unit tests | Vitest | 2.x — `npm test` |
| Database / Auth | Supabase (PostgreSQL + Auth + RLS + Storage) | `@supabase/supabase-js` 2.57 |
| Hosting (target) | Cloudflare Pages | static React build |
| API gateway (target) | Cloudflare Workers + TypeScript + Zod | server-side model proxy, rate limits |
| LLM gateway | Groq (primary), Gemini Developer API (fallback) | server-side only; keys never in browser |
| Local ML (future) | Transformers.js / ONNX Runtime Web | browser-side embeddings only |

## App boundaries

### Client (browser)
- Displays evidence and requests tasks via typed API calls.
- May **not** hold provider secrets, resolve authority conflicts, calculate trusted metrics from unverified fields, or execute privileged integration actions.
- Supabase anon key is safe to expose **only** when Row Level Security is enabled on every tenant-owned table.
- All model calls go through the server-side gateway — never directly to Groq/Gemini from the browser.

### API / policy gateway (Cloudflare Workers — not yet built)
- Validates user/workspace membership before any data mutation.
- Enforces source policy, input limits, rate limits, idempotency, and task state transitions.
- Holds `GROQ_API_KEY`, Supabase service-role key, and OAuth tokens.
- Returns structured, Zod-validated responses only.

### Database (Supabase Postgres)
- Every tenant-owned table has a `workspace_id` column and an RLS policy that enforces it.
- Immutable observed imports are stored separately from derived AI findings.
- Raw source metadata and structured derived findings are stored separately.
- No binary files in database rows — use Supabase Storage with signed private URLs.

## Environment variables

| Variable | Side | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser (public) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Browser (public) | Supabase anon key — safe only with RLS |
| `GROQ_API_KEY` | Server only — never prefix with VITE_ | Groq structured-output calls |
| `VITE_API_BASE_URL` | Browser (public) | Future Cloudflare Worker / API gateway |

## Current implementation boundary (Phase 0–1)

- **Phase 0 complete**: Repository initialized, evidence guard (`src/lib/evidence.ts`), public site shell, local workspace shell, durable docs.
- **Phase 1 active**: Supabase auth + workspace schema + RLS → then Brand Brain → then Evidence Layer.
- **Not yet started**: Cloudflare Workers gateway, Groq integration, agent orchestration, trend ingestion, publishing intelligence.

## Data flow (current)

```
Browser → Supabase (anon key, RLS enforced) → Postgres
```

Future:
```
Browser → Cloudflare Worker (validates JWT, holds secrets) → Groq / Gemini
Browser → Cloudflare Worker → Supabase (service-role, server-side only)
```

## Core database tables (planned — not yet migrated)

| Table | Purpose |
|---|---|
| `profiles` | Linked to `auth.users`; display name, avatar |
| `workspaces` | Tenant boundary |
| `workspace_members` | User ↔ workspace with role (`owner`, `member`) |
| `brands` | Brand Brain root — one per workspace |
| `brand_rules` | Individual approved/prohibited claims and tone rules |
| `source_connections` | Authorized source registry |
| `evidence_items` | Provenance records for every asserted fact |
| `creative_assets` | Original asset metadata |
| `creative_features` | Extracted twin features |
| `audiences` | Audience definitions |
| `decision_packets` | Immutable task inputs for agent runs |
| `agent_runs` | Durable agent task state |
| `agent_findings` | Typed, validated agent outputs |
| `experiments` | Hypothesis + variant history |
| `campaign_outcomes` | Observed metrics — immutable |
| `audit_events` | Append-only security and policy history |

## Security requirements

- RLS on every tenant table; test cross-workspace access before shipping any feature.
- Short-lived signed URLs for all private assets.
- Append-only `audit_events` — never update or delete rows.
- Model and prompt version stored with every AI finding.
- No `GROQ_API_KEY` or service-role keys in browser code, logs, fixtures, or committed files.
