# Vanta Build State

## Current status

Ticket 2.1 (Auth & RLS) + Ticket 2.2 (Brand Brain) + Ticket 3.1 (Evidence Layer & Source Registry) + Ticket 3.2 (Creative Intake & Grounded Twins) complete. 47 tests pass. Build clean.

## Migration state (exact — do not re-apply)

| Migration name | Applied | Tables created / Constraints |
|---|---|---|
| `20260822000001_auth_workspaces` | ✅ | `profiles`, `workspaces`, `workspace_members`, `audit_events` |
| `20260822000002_brand_brain` | ✅ | `brands`, `brand_codex_versions`, `brand_audiences`, `brand_claims`, `brand_proof_points`, `brand_competitors`, `brand_tone_guidelines`, `brand_compliance_boundaries` |
| `20260822000003_evidence_layer` | ✅ | `source_registry`, `evidence_items`, `metric_definitions` + `block_manual_connected_status` trigger + composite FK |
| `20260822000004_creative_intake` | ✅ | `creative_assets`, `ingestion_runs`, `creative_twins` + `workspace-assets` private storage bucket + defensive `storage_workspace_id` helper + partial unique SHA-256 index |

## Completed

- **Ticket 0.1**: All 5 durable docs created (`blueprint-index.md`, `product-constitution.md`, `architecture.md`, `decisions.md`, `build-state.md`)
- **Ticket 2.1**: Supabase Auth + workspace schema + RLS + anon key wired + auth UI + workspace switcher
- **RLS isolation proof**: 8 SQL-level tests passed (schema, policies, SECURITY DEFINER functions, tenant isolation logic)
- **RLS contract tests**: `src/lib/rls.test.ts` (8 tests) documents isolation invariants
- **Ticket 2.2**: Brand Brain schema (8 tables), RLS (32 policies), typed queries (`src/lib/brandBrain.ts`), React component (`src/components/BrandBrain.tsx`) with versioned codex snapshots — no fake data
- **Ticket 3.1**: Evidence Layer & Source Registry schema (3 tables), RLS (12 policies), DB trigger blocking manual `connected` status, composite FK on `evidence_items(source_id, workspace_id)`, typed queries and validation service (`src/lib/sourceRegistry.ts`), pure synchronous citability evaluation, 5-class evidence standard, `SourceRegistry.tsx` (Sources, Evidence Items, Metric Definitions), live evidence state in Decision Room
- **Ticket 3.2**: Creative Intake & Grounded Twins schema (3 tables + private storage bucket `workspace-assets`), defensive `storage_workspace_id(name)` SQL helper, composite FK `(source_id, workspace_id)` on `creative_assets`, pure deterministic validators & guards (`src/lib/creativeIntake.ts`), 21 unit & invariant tests (`src/lib/creativeIntake.test.ts`), `CreativeIntake.tsx` component (Manual Text & File Import flows, privacy assurance banner, grounded twin inspector with deterministic features & explicit known gaps), intelligent Decision Room "Next safe action" routing.

## Test suite

- `src/lib/evidence.test.ts` — 3 tests: numeric provenance guards
- `src/lib/auth.test.ts` — 3 tests: auth fallback contract
- `src/lib/rls.test.ts` — 8 tests: RLS isolation contract documentation
- `src/lib/sourceRegistry.test.ts` — 12 tests: pure citability evaluation, stale/unverified/blocked source guards, freshness window derivation
- `src/lib/creativeIntake.test.ts` — 21 tests: manual text bounds, client-declared file validation, video byte rejection, filename sanitization, CSV header inspection, deterministic feature manifest, known gap derivation, intake failure invariants

Total: 47 unit & contract tests passing.

## Supabase project state

- Project ref: `ujxrapbhiedkwleccvqw`
- URL: `https://ujxrapbhiedkwleccvqw.supabase.co`
- Anon key in `.env` (publishable, safe with RLS active)
- All 18 tenant tables have RLS enabled
- `handle_new_user` trigger: auto-creates profile + workspace + owner membership + audit event on signup
- `trg_block_connected_status` trigger on `source_registry`: restricts `connected` status to service-role
- Private Supabase Storage bucket `workspace-assets` protected by `storage_workspace_id` RLS policies

## QA Requirements (Planned)

- **Ticket QA-1 (future)**: Real-JWT two-user browser RLS integration test suite (Playwright). Two distinct authenticated users in independent workspaces to verify that User A cannot read, insert, update, or delete any record belonging to User B even with direct API requests.

## Active constraints

- Never fabricate metrics, AI outputs, social data, or source connections
- RLS tested and active on all tables; test cross-workspace isolation before shipping new tables
- No `GROQ_API_KEY` or service-role key in browser code
- Do not re-apply migrations listed above
- Ask before: pushing, deploying, destructive migrations, paid resources

## Next

**Ticket 4.1: Creative Decision Matrix & Timeline Doctor Foundations**
1. Multi-modal asset decomposition schema
2. Scene / variant comparative matrix UI
3. Typed diagnostic indicators with explicit gap markers (no hallucinated scores)
