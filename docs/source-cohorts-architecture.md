# Source Cohorts Architecture Specification — Ticket 7.1

## 1. Overview & Purpose

`source_cohorts` and `source_cohort_members` introduce workspace-scoped named watchlists and grouping metadata for `source_registry` entries.

### Epistemic Boundary & Product Constitution

- **Organizational Metadata Only:** Cohorts group registered sources into named collections (e.g. competitor watchlists, niche research buckets).
- **No Evidence Class:** Cohort tables do not have an `evidence_class` column. They do not fabricate observations, modify citability, or assert empirical validity.
- **Source Citability Unchanged:** Adding a source to a cohort does not alter its health status, freshness window, or citability in `evaluateSourceCitability`.
- **No Predictive Rankings:** Outlier metrics, virality scoring, scraping, and automated feed crawling are strictly prohibited and absent from this contract.

---

## 2. Schema Specification (Migration 022)

### Table: `public.source_cohorts`

```sql
CREATE TABLE IF NOT EXISTS public.source_cohorts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name         TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  description  TEXT,
  tags         TEXT[] NOT NULL DEFAULT '{}',
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'archived')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, workspace_id),
  UNIQUE (workspace_id, name)
);
```

### Table: `public.source_cohort_members`

```sql
CREATE TABLE IF NOT EXISTS public.source_cohort_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id    UUID NOT NULL,
  workspace_id UUID NOT NULL,
  FOREIGN KEY (cohort_id, workspace_id)
    REFERENCES public.source_cohorts(id, workspace_id)
    ON DELETE CASCADE,
  source_id    UUID NOT NULL,
  FOREIGN KEY (source_id, workspace_id)
    REFERENCES public.source_registry(id, workspace_id)
    ON DELETE CASCADE,
  added_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cohort_id, source_id),
  UNIQUE (id, workspace_id)
);
```

### Composite Tenant Fortress Enforcement

- `source_cohort_members` enforces composite foreign keys `(cohort_id, workspace_id)` and `(source_id, workspace_id)`.
- Structurally impossible to mix cohorts and sources across different workspaces: both foreign keys bind against the identical `workspace_id` column.
- Parent table `source_registry` satisfies `UNIQUE (id, workspace_id)` (Migration 003).

---

## 3. RLS & RPC Boundary

### Row Level Security
- `SELECT`: Permitted for workspace members via `public.is_workspace_member(workspace_id)`.
- `INSERT` / `UPDATE` / `DELETE`: Explicitly denied (`USING (false)` / `WITH CHECK (false)`) on both tables. All state mutations must flow through hardened `SECURITY DEFINER` RPCs.

### RPC State Machine & Permissions

| RPC | Permissions | Description | Audit Action |
|---|---|---|---|
| `create_source_cohort` | `authenticated` (member) | Creates cohort in active state; checks name constraints | `source_cohort.created` |
| `archive_source_cohort` | `authenticated` (owner/admin) | Soft-archives cohort; member rows retained for provenance | `source_cohort.archived` |
| `add_source_to_cohort` | `authenticated` (member) | Adds member; idempotent via `ON CONFLICT DO NOTHING`; rejects if cohort is archived | `source_cohort_member.added` |
| `remove_source_from_cohort` | `authenticated` (member) | Removes membership row; does not delete source or evidence | `source_cohort_member.removed` |

All RPCs enforce `SET search_path = public, pg_temp` and revoke execution from `PUBLIC` and `anon`.

---

## 4. Client Service Boundary (`src/lib/sourceCohorts.ts`)

- **Fail-Closed Reads:** `listSourceCohorts`, `getSourceCohort`, `listCohortMembers` return `ReadResult<T>` with classified `ReadFailure` (`denied`, `absent`, `offline`, `failed`, `unconfigured`). Refused reads are never collapsed to empty arrays.
- **Typed Mutations:** Direct table DML is not exposed in the TypeScript module; all write actions call the corresponding database RPC.

---

## 5. Deferrals & Future Slices

- **Evidence Datasets (§B):** Deferred to a future ticket. Existing primitives (`import_batches`, `evidence_items`, and source provenance) already support benchmark grouping without introducing redundant tables.
- **Outlier Ranking:** Deferred. Requires a formal observed query specification with explicit metric, denominator, time window, sample size, and fallback to `insufficient_evidence`.
