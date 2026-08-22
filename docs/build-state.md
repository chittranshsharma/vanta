# Vanta Build State

## Current status

Ticket 2.1 (Auth & RLS) + Ticket 2.2 (Brand Brain) + Ticket 3.1 (Evidence Layer & Source Registry) + Ticket 3.2 (Creative Intake & Grounded Twins) + Ticket 4.1 (Creative Twin Structured Expansion & Versioning) + Ticket 4.2 (Creative Decision Matrix & Timeline Doctor) complete. 74 tests pass across 7 suites. Build clean.

## Migration state (exact — do not re-apply)

| Migration name | Applied | Tables created / Constraints |
|---|---|---|
| `20260822000001_auth_workspaces` | ✅ | `profiles`, `workspaces`, `workspace_members`, `audit_events` |
| `20260822000002_brand_brain` | ✅ | `brands`, `brand_codex_versions`, `brand_audiences`, `brand_claims`, `brand_proof_points`, `brand_competitors`, `brand_tone_guidelines`, `brand_compliance_boundaries` |
| `20260822000003_evidence_layer` | ✅ | `source_registry`, `evidence_items`, `metric_definitions` + `block_manual_connected_status` trigger + composite FK |
| `20260822000004_creative_intake` | ✅ | `creative_assets`, `ingestion_runs`, `creative_twins` + `workspace-assets` private storage bucket + defensive `storage_workspace_id` helper + partial unique SHA-256 index |
| `20260822000005_creative_twin_expansion` | ✅ | `creative_scenes`, `creative_claims`, `creative_twin_versions` + `block_twin_version_mutation` immutability trigger + composite FKs to `creative_twins(id, workspace_id)` and `brand_claims(id, workspace_id)` |
| `20260822000006_secure_twin_correction_rpcs` | ✅ | Hardened `save_scene_correction_atomic` & `save_claim_correction_atomic`: `SET search_path = public, pg_temp`, mandatory non-null `auth.uid()`, removed untrusted `p_user_id`, enforced asset-creator / admin-owner authority, per-twin transaction advisory locks, revoked `PUBLIC` / `anon` execution. |

## Completed

- **Ticket 0.1**: All 5 durable docs created (`blueprint-index.md`, `product-constitution.md`, `architecture.md`, `decisions.md`, `build-state.md`)
- **Ticket 2.1**: Supabase Auth + workspace schema + RLS + anon key wired + auth UI + workspace switcher
- **RLS isolation proof**: 8 SQL-level tests passed (schema, policies, SECURITY DEFINER functions, tenant isolation logic)
- **RLS contract tests**: `src/lib/rls.test.ts` (8 tests) documents isolation invariants
- **Ticket 2.2**: Brand Brain schema (8 tables), RLS (32 policies), typed queries (`src/lib/brandBrain.ts`), React component (`src/components/BrandBrain.tsx`) with versioned codex snapshots — no fake data
- **Ticket 3.1**: Evidence Layer & Source Registry schema (3 tables), RLS (12 policies), DB trigger blocking manual `connected` status, composite FK on `evidence_items(source_id, workspace_id)`, typed queries and validation service (`src/lib/sourceRegistry.ts`), pure synchronous citability evaluation, 5-class evidence standard, `SourceRegistry.tsx` (Sources, Evidence Items, Metric Definitions), live evidence state in Decision Room
- **Ticket 3.2**: Creative Intake & Grounded Twins schema (3 tables + private storage bucket `workspace-assets`), defensive `storage_workspace_id(name)` SQL helper, composite FK `(source_id, workspace_id)` on `creative_assets`, pure deterministic validators & guards (`src/lib/creativeIntake.ts`), 23 unit & invariant tests (`src/lib/creativeIntake.test.ts`), `CreativeIntake.tsx` component (Manual Text & File Import flows, privacy assurance banner, grounded twin inspector with deterministic features & explicit known gaps), intelligent Decision Room "Next safe action" routing.
- **Ticket 4.1**: Creative Twin Expansion & Structured Representation (`20260822000005_creative_twin_expansion.sql`): composite tenant FKs, database-enforced immutable version snapshots via trigger, pure deterministic script parser (`src/lib/creativeTwin.ts`), reading burden WPM calculator, traceable regex claim extractor with character offsets and Brand Codex alignment matching, `CreativeTwinEditor.tsx` (Scene Timeline, Claims & Codex, Changelog, and Known Gaps tabs with inline correction modal).
- **Ticket 4.1 Emergency Security Patch (`20260822000006_secure_twin_correction_rpcs.sql`)**: Remedied privilege escalation in atomic correction RPCs by removing `p_user_id` parameter, enforcing mandatory `auth.uid()` checks, restricting editing authority strictly to the asset creator or workspace owner/admin, adding per-twin transaction-scoped advisory locks, and revoking `EXECUTE` from `anon` and `PUBLIC`. Verified with 100% passing SQL security isolation tests.
- **Ticket 4.2**: Creative Decision Matrix & Timeline Doctor: Pure in-memory derivation engine on read (`src/lib/creativeDoctor.ts`), strictly adhering to the canonical 5 evidence classes (`inference` for rule conclusions), neutral policy rules (`R-HOOK-001/002/GAP`, `R-PACE-001/GAP`, `R-CLAIM-001/002`, `R-CTA-001`, `R-VIS-GAP`), visible and configurable threshold parameters, separation of lexical Brand Codex alignment from verified evidence citations, explicit `unknown` audience evidence state, sequential/timed `TimelineDoctor.tsx` inspector with actionable edit recommendations, multi-variant comparative `DecisionMatrix.tsx` table with calculation provenance inspection, and full integration into workspace navigation.

## Test suite

- `src/lib/evidence.test.ts` — 3 tests: numeric provenance guards
- `src/lib/auth.test.ts` — 3 tests: auth fallback contract
- `src/lib/rls.test.ts` — 8 tests: RLS isolation contract documentation
- `src/lib/sourceRegistry.test.ts` — 12 tests: pure citability evaluation, stale/unverified/blocked source guards, freshness window derivation
- `src/lib/creativeIntake.test.ts` — 23 tests: manual text bounds, client-declared file validation, video byte rejection, filename sanitization, CSV header inspection, deterministic feature manifest, known gap derivation, intake failure & rollback invariants
- `src/lib/creativeTwin.test.ts` — 13 tests: scene delimiter parsing, reading burden / WPM calculations, candidate claim extraction, character offsets, exact vs partial Brand Codex matching, failure and unknown invariants
- `src/lib/creativeDoctor.test.ts` — 12 tests: 5-class evidence semantics, rule derivation with neutral non-predictive wording, hook window bounds, reading burden WPM thresholds, missing timecode gaps, proof citation vs lexical match separation, unknown audience disclosure, multi-variant comparative matrix derivation

Total: 74 unit & contract tests passing across 7 test suites.

## Supabase project state

- Project ref: `ujxrapbhiedkwleccvqw`
- URL: `https://ujxrapbhiedkwleccvqw.supabase.co`
- Anon key in `.env` (publishable, safe with RLS active)
- All 21 tenant tables have RLS enabled
- `handle_new_user` trigger: auto-creates profile + workspace + owner membership + audit event on signup
- `trg_block_connected_status` trigger on `source_registry`: restricts `connected` status to service-role
- `trg_block_twin_version_mutation` trigger on `creative_twin_versions`: prohibits UPDATE/DELETE
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

**Ticket 4.2: Creative Decision Matrix & Timeline Doctor UI**
1. Multi-variant comparative matrix UI (comparing 2-3 script/creative variants across objectives & audience segments)
2. Timeline Doctor UI displaying likely failure moments with precise edit briefs
3. Strict 5-class evidence badges with transparent provenance (no hallucinated virality or engagement scores)
