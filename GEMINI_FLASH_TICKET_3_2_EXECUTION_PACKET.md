# Vanta — Gemini Flash Execution Packet

## Mission

Continue the Vanta repository from the **actual current state**. Complete **Ticket 3.2: evidence-safe ingestion workflows and the deterministic Creative Twin foundation**. Work in one contained vertical slice. Do not start agents, Groq calls, trend scraping, social connectors, creative scores, persona simulation, or outcome prediction.

## Mandatory first step: reconcile state, do not recreate work

Ticket 3.1 is **already implemented and verified**. Before changing code, read only these files:

1. `docs/build-state.md`
2. `todo.md`
3. `supabase/migrations/20260822000003_evidence_layer.sql`
4. `src/lib/evidence.ts`
5. `src/lib/sourceRegistry.ts`
6. `src/lib/sourceRegistry.test.ts`
7. `src/components/SourceRegistry.tsx`
8. `src/App.tsx` sections that define workspace navigation and panels.

Then update `docs/build-state.md` if it still says Ticket 3.1 is pending. State exactly that Ticket 3.1 is complete, migration `20260822000003_evidence_layer.sql` exists, Source Registry UI exists, 26 tests pass, and the next active work is Ticket 3.2. Do **not** recreate the evidence tables, source registry service, CitabilityResult union, tests, or Source Registry component.

> Repository fact: Ticket 3.1 already includes `source_registry`, `evidence_items`, and `metric_definitions`; `evaluateSourceCitability`; `resolveEvidenceCitability`; Source Registry UI; source registry tests; and a clean build. The actual code wins over stale documents.

## In-scope result

Vanta needs a private, workspace-scoped intake flow for user-provided creative material. The user can upload a small approved file or enter text manually. Vanta records provenance, validates the input deterministically, stores file bytes in private Supabase Storage, creates an asset record, creates an ingestion record, and creates a **Creative Twin stub** containing only user-provided or deterministic fields.

The screen must look complete without claiming analysis happened. An uploaded asset must show what Vanta knows, what it does not know, and what is needed next.

## Out of scope — do not implement

- Groq or any other model call.
- Image, video, audio, scene, transcript, OCR, or semantic analysis.
- Remote fetching of URLs or HTTP health checks.
- Trend research, public-web scraping, social platform APIs, or browser automation.
- Campaign metric row ingestion, attribution, prediction, simulation, agent runs, or recommendations.
- A fake “analysis complete” score, fabricated extracted data, seed customer data, reviews, campaign data, or trends.
- New tables outside the contract below unless a required foreign key or security constraint cannot be implemented otherwise.

## Data contract

### Existing dependencies

All new rows must belong to a workspace. Existing workspace membership helpers and RLS patterns are authoritative. `source_registry` is already the provenance entry point. For any upload, create or reuse a `source_registry` row with `source_type = 'file_import'`, status `unverified`, and honest coverage/review states.

### New table 1: `creative_assets`

Create one record per user-provided asset or text submission.

| Field | Contract |
|---|---|
| `id` | UUID primary key |
| `workspace_id` | Required; workspace FK; RLS tenant boundary |
| `source_id` | Required; composite workspace-safe reference to `source_registry` (`source_id`, `workspace_id`) |
| `created_by` | Auth user UUID; null only if the user is later deleted |
| `asset_kind` | Strict check: `script`, `hook`, `caption`, `cta`, `landing_page_copy`, `thumbnail`, `short_video_metadata`, `campaign_csv`, `other` |
| `title` | Required, user-visible name |
| `original_filename` | Nullable for manual text; never claim it exists when it does not |
| `mime_type` | Nullable for manual text; validated when file-backed |
| `byte_size` | Nullable for manual text; non-negative when present |
| `storage_bucket` / `storage_path` | Both nullable for text; both required together for file-backed assets; path unique when present |
| `content_sha256` | Nullable when browser hashing is unavailable; never invent a hash |
| `manual_text` | Nullable; user-provided text only; no generated summary |
| `declared_platform` | Nullable text, user-declared only |
| `declared_objective` | Nullable text, user-declared only |
| `ingestion_status` | Strict check: `pending`, `accepted`, `blocked`, `failed` |
| `blocked_reason` | Required when status is `blocked` or `failed`; otherwise null |
| `created_at`, `updated_at` | UTC timestamps |

Enforce same-workspace source consistency at the database layer using a composite foreign key, as in `evidence_items`. Add a check preventing one of `storage_bucket`/`storage_path` being set without the other. Add a unique constraint on `(workspace_id, content_sha256)` only if null handling does not block manual text; otherwise use a partial unique index for non-null hashes.

### New table 2: `ingestion_runs`

Use this as the durable audit and failure record for every intake attempt. It is not model output.

| Field | Contract |
|---|---|
| `id`, `workspace_id`, `asset_id`, `started_by` | Required IDs with workspace-safe relationships |
| `ingestion_method` | `manual_text`, `file_upload`, `csv_header_inspection` only |
| `status` | `pending`, `accepted`, `blocked`, `failed` |
| `validation_summary` | Small JSON object with deterministic checks only: MIME result, size result, hash presence, text length, CSV headers, and missing fields |
| `error_code`, `error_message` | Null on success; concise and user-safe on failure |
| `created_at`, `completed_at` | UTC timestamps |

### New table 3: `creative_twins`

The Ticket 3.2 Creative Twin is a **grounded asset manifest**, not an AI persona, score, or analysis.

| Field | Contract |
|---|---|
| `id`, `workspace_id`, `asset_id` | Required; one active stub per asset initially |
| `title` | Mirrors user-approved asset title; no generated title |
| `asset_kind`, `declared_platform`, `declared_objective` | Copied from the asset only if supplied |
| `source_evidence_ids` | JSON array or relation containing the backing source/evidence IDs; starts with the source registry entry |
| `deterministic_features` | JSON object containing only deterministic facts such as `manual_text_character_count`, `manual_text_word_count`, `csv_headers`, `mime_type`, `byte_size`, `content_sha256_present`; no sentiment, attention, quality, or performance inference |
| `known_gaps` | JSON array such as `video_not_analyzed`, `no_target_audience_linked`, `no_outcome_data`; derive only from absent inputs |
| `state` | `grounded_stub`, `needs_input`, `blocked`; never `analyzed` in this ticket |
| `created_at`, `updated_at` | UTC timestamps |

Every new table requires RLS. Members may read and create their workspace’s assets/twins/runs. Only the asset creator or an admin/owner may update an asset while it is pending; only admins/owners may delete. If the existing authorization helper patterns cannot express creator-level control cleanly, choose the safer admin/owner update policy and document it rather than weakening RLS.

### Audit events

Create audit entries for asset creation, upload acceptance/failure, ingestion completion, and Creative Twin stub creation. Audit metadata must contain identifiers, status, and deterministic metadata only; do not place user content, tokens, secrets, raw CSV rows, or uploaded file bytes in audit metadata.

## Supabase Storage contract

Create a **private** Storage bucket named `workspace-assets` in the migration or through the approved Supabase workflow. Do not expose a public bucket.

Object path format is mandatory:

```text
{workspace_id}/{asset_id}/{sanitized_filename}
```

Implement storage policies so a user can list, read, create, and update objects only when the first folder segment is a workspace they belong to. Delete requires workspace admin/owner. Use a defensive helper or safe folder parsing; an invalid object path must be denied, not crash a query or default to allow.

Initial browser-side acceptance limits:

| Category | Allow in Ticket 3.2 | Constraint |
|---|---|---|
| Manual text | Yes | 1–100,000 characters; reject empty/over-limit with a visible reason |
| CSV | Yes | `.csv`, `text/csv`, max 5 MB; inspect headers only, do not import rows into campaign tables |
| Scripts/transcripts/captions | Yes | `.txt`, `.md`, `text/plain`, max 2 MB |
| JSON metadata | Yes | `application/json`, max 2 MB; store raw file but do not assume schema beyond basic validity |
| Images/thumbnails | Yes | PNG/JPEG/WebP, max 10 MB; store only, no visual analysis |
| Videos | Metadata record only | Do not upload or transcode video bytes in this ticket; expose a clear “video processing is not enabled yet” notice |

Use browser `crypto.subtle` SHA-256 when available for small file-backed assets. If hashing fails, preserve the upload as accepted only when all other validation passes, record hash absence truthfully, and show the asset as lower provenance coverage. Do not use a made-up checksum.

## UI contract

Add a **Creative Intake** navigation item or a clearly discoverable entry from Decision Room. Use the existing visual system and maintain the honest dark/cinematic style.

### Intake flow

1. User selects `Manual text` or `File import`.
2. User supplies a title, asset kind, optional platform/objective, and either text or an allowed file.
3. Client runs deterministic validation first. Display every validation failure before upload.
4. For an accepted file, create/reuse an unverified file-import source, create asset ID, upload into the private path, create `creative_assets`, create `ingestion_runs`, create `creative_twins`, and record audits.
5. Render the grounded Creative Twin stub.

### Required UI states

- Loading state for source/asset/ingestion queries.
- Empty state: no creative assets exist; invite user to import one.
- Validation failure state with exact human-readable reason.
- Upload failure state that does not pretend the asset exists.
- Partial/unknown state for assets without audience, outcome data, video analysis, or verified source freshness.
- Private-data reassurance: tell users files remain private to their workspace and no external platform data is fetched in this step.

Never display a “virality score,” “best time to post,” “confidence percentage,” “audience reaction,” “trend,” or generative advice in this ticket.

## Implementation order

1. Confirm migration state; create **one** migration named `20260822000004_creative_intake.sql`.
2. Apply it once. Verify tables, indexes, RLS, bucket, object policies, and constraints via Supabase MCP.
3. Generate `database.types.ts` from the live database; do not hand-edit generated sections.
4. Add `src/lib/creativeIntake.ts` with typed data access and pure validators.
5. Add focused tests: `creativeIntake.test.ts` and extend only relevant existing tests.
6. Add `src/components/CreativeIntake.tsx` and a minimal grounded twin detail panel.
7. Wire the component into `App.tsx` with workspace ID/user role propagation.
8. Run `npm test`, `npm run build`, then perform one local browser smoke test: create manual text asset → verify asset/twin appears → attempt invalid file type → verify it remains blocked and no success state appears.
9. Update `docs/build-state.md`, `todo.md`, and a short `docs/ticket-3-2-walkthrough.md`.

## Required validators and test cases

### Pure unit tests

- Manual text accepts a non-empty text within limit and blocks blank/over-limit text.
- MIME/extension allow-list blocks unsupported MIME, extension mismatch, and over-limit size.
- Storage path has exactly `{workspaceId}/{assetId}/{filename}` order and filename is sanitized.
- Deterministic Creative Twin includes only supplied/deterministic fields.
- No unverified/stale source can make a numeric claim verified.
- CSV header inspection preserves headers but does not create fake metric rows.
- Failed upload/run cannot create a `grounded_stub` Creative Twin.

### Database/security verification

- All new public tables have RLS enabled.
- Every RLS policy is workspace-scoped and write policy checks authentication.
- `creative_assets.source_id` cannot point to a source from another workspace.
- An invalid storage path is denied.
- A non-member cannot access a member’s object or asset row. Preserve the existing real-JWT two-user QA task if it is not run in this slice.

## Stop conditions

Stop and ask the user rather than improvising if: a required Supabase storage setting cannot be created with current permission; object policies need a capability not available in the project; an action would create a paid resource; an upload limit has a business consequence outside this specification; or an existing migration/schema conflicts with this contract.

## Completion report format

Report only:

```text
Completed: [ticket and key artifacts]
Verified: [tests/build/browser/db checks]
Known limits: [what is deliberately not implemented]
Next: [one ticket]
```

Keep the report under 180 words. Do not paste full files or repeat the product blueprint.
