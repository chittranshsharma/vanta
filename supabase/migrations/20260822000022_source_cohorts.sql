-- ============================================================
-- Vanta: Source Cohorts (Ticket 7.1)
-- Migration: 20260822000022_source_cohorts.sql
-- Depends on: 001 through 021 applied.
--
-- Adds workspace-scoped named cohorts that organize source_registry
-- rows into labeled watchlists. Cohorts are organizational metadata
-- only. They do not create evidence, alter source citability, produce
-- rankings, ingest feeds, or scrape content.
--
-- Composite FK dependency audit (completed before authoring):
--   source_registry UNIQUE (id, workspace_id)  -- migration 003, line 37. ✓
--   workspaces.id referenced via simple FK (always safe).
--
-- RLS pattern: members read; all mutations via SECURITY DEFINER RPCs.
-- Direct INSERT/UPDATE/DELETE denied at the policy layer.
-- ============================================================

-- ------------------------------------------------------------
-- 1. SOURCE COHORTS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.source_cohorts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name         TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  description  TEXT,
  tags         TEXT[] NOT NULL DEFAULT '{}',
  -- Lifecycle: active (default) → archived (soft-delete via RPC).
  -- No reverse transition: archived cohorts cannot be reactivated.
  status       TEXT NOT NULL DEFAULT 'active'
               CHECK (status IN ('active', 'archived')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Composite unique enables future composite FK targets.
  UNIQUE (id, workspace_id),
  -- Canonical name per workspace: prevent duplicate cohort names.
  UNIQUE (workspace_id, name)
);

CREATE INDEX IF NOT EXISTS idx_source_cohorts_workspace
  ON public.source_cohorts(workspace_id, status, created_at DESC);

ALTER TABLE public.source_cohorts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "source_cohorts_select"    ON public.source_cohorts;
DROP POLICY IF EXISTS "source_cohorts_no_insert" ON public.source_cohorts;
DROP POLICY IF EXISTS "source_cohorts_no_update" ON public.source_cohorts;
DROP POLICY IF EXISTS "source_cohorts_no_delete" ON public.source_cohorts;

-- Members read cohorts in their own workspace.
CREATE POLICY "source_cohorts_select" ON public.source_cohorts FOR SELECT
  USING (public.is_workspace_member(workspace_id));

-- All mutations go through RPCs; direct DML is denied.
CREATE POLICY "source_cohorts_no_insert" ON public.source_cohorts FOR INSERT
  WITH CHECK (false);
CREATE POLICY "source_cohorts_no_update" ON public.source_cohorts FOR UPDATE
  USING (false);
CREATE POLICY "source_cohorts_no_delete" ON public.source_cohorts FOR DELETE
  USING (false);

-- ------------------------------------------------------------
-- 2. SOURCE COHORT MEMBERS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.source_cohort_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id    UUID NOT NULL,
  workspace_id UUID NOT NULL,
  -- Composite FK: cohort and member share the same workspace.
  FOREIGN KEY (cohort_id, workspace_id)
    REFERENCES public.source_cohorts(id, workspace_id)
    ON DELETE CASCADE,
  source_id    UUID NOT NULL,
  -- Composite FK: source and member share the same workspace.
  FOREIGN KEY (source_id, workspace_id)
    REFERENCES public.source_registry(id, workspace_id)
    ON DELETE CASCADE,
  added_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- No duplicate memberships within a cohort.
  UNIQUE (cohort_id, source_id),
  -- Enable future composite FK references from downstream tables.
  UNIQUE (id, workspace_id)
  -- Cross-workspace safety: both composite FKs require the same
  -- workspace_id column, so (cohort from ws-A, source from ws-B)
  -- is structurally impossible: both would need workspace_id = ws-A
  -- AND workspace_id = ws-B simultaneously.
);

CREATE INDEX IF NOT EXISTS idx_source_cohort_members_cohort
  ON public.source_cohort_members(workspace_id, cohort_id);

CREATE INDEX IF NOT EXISTS idx_source_cohort_members_source
  ON public.source_cohort_members(workspace_id, source_id);

ALTER TABLE public.source_cohort_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "source_cohort_members_select"    ON public.source_cohort_members;
DROP POLICY IF EXISTS "source_cohort_members_no_insert" ON public.source_cohort_members;
DROP POLICY IF EXISTS "source_cohort_members_no_update" ON public.source_cohort_members;
DROP POLICY IF EXISTS "source_cohort_members_no_delete" ON public.source_cohort_members;

CREATE POLICY "source_cohort_members_select" ON public.source_cohort_members FOR SELECT
  USING (public.is_workspace_member(workspace_id));

-- All mutations go through RPCs; direct DML is denied.
CREATE POLICY "source_cohort_members_no_insert" ON public.source_cohort_members FOR INSERT
  WITH CHECK (false);
CREATE POLICY "source_cohort_members_no_update" ON public.source_cohort_members FOR UPDATE
  USING (false);
CREATE POLICY "source_cohort_members_no_delete" ON public.source_cohort_members FOR DELETE
  USING (false);

-- ============================================================
-- 3. RPC: create_source_cohort
--    Actor: any workspace member.
--    Creates a cohort row and writes an audit event atomically.
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_source_cohort(
  p_workspace_id UUID,
  p_name         TEXT,
  p_description  TEXT DEFAULT NULL,
  p_tags         TEXT[] DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_cohort_id UUID;
BEGIN
  -- 1. Authentication
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 2. Workspace membership
  IF NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a workspace member';
  END IF;

  -- 3. Name validation
  IF p_name IS NULL OR char_length(trim(p_name)) < 1 THEN
    RAISE EXCEPTION 'Cohort name must be a non-empty string';
  END IF;
  IF char_length(p_name) > 160 THEN
    RAISE EXCEPTION 'Cohort name must not exceed 160 characters';
  END IF;

  -- 4. Insert cohort (UNIQUE (workspace_id, name) enforces no duplicates)
  INSERT INTO public.source_cohorts (
    workspace_id, created_by, name, description, tags, status
  ) VALUES (
    p_workspace_id, v_actor_id, p_name, p_description, COALESCE(p_tags, '{}'), 'active'
  )
  RETURNING id INTO v_cohort_id;

  -- 5. Audit event (no raw user content; name is safe organizational metadata)
  INSERT INTO public.audit_events (
    workspace_id, user_id, action, resource_type, resource_id, metadata
  ) VALUES (
    p_workspace_id, v_actor_id, 'source_cohort.created',
    'source_cohort', v_cohort_id::TEXT,
    jsonb_build_object('name', p_name, 'tags', to_jsonb(COALESCE(p_tags, '{}'::TEXT[])))
  );

  RETURN jsonb_build_object('cohort_id', v_cohort_id, 'success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.create_source_cohort(UUID, TEXT, TEXT, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_source_cohort(UUID, TEXT, TEXT, TEXT[]) TO authenticated;

-- ============================================================
-- 4. RPC: archive_source_cohort
--    Actor: workspace admin or owner only.
--    Soft-archives a cohort; member rows are retained for provenance.
--    Archived cohorts cannot be reactivated (irreversible in v1).
-- ============================================================
CREATE OR REPLACE FUNCTION public.archive_source_cohort(
  p_workspace_id UUID,
  p_cohort_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_current_status TEXT;
BEGIN
  -- 1. Authentication
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 2. Admin or owner only
  IF NOT public.is_workspace_admin_or_owner(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: admin or owner role required to archive a cohort';
  END IF;

  -- 3. Fetch current status (validates cohort belongs to workspace)
  SELECT status INTO v_current_status
  FROM public.source_cohorts
  WHERE id = p_cohort_id AND workspace_id = p_workspace_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Source cohort not found in workspace';
  END IF;

  -- 4. Idempotent: already archived is a no-op
  IF v_current_status = 'archived' THEN
    RETURN jsonb_build_object('cohort_id', p_cohort_id, 'success', true, 'note', 'already_archived');
  END IF;

  -- 5. Archive
  UPDATE public.source_cohorts
  SET status = 'archived', updated_at = NOW()
  WHERE id = p_cohort_id AND workspace_id = p_workspace_id;

  -- 6. Audit event
  INSERT INTO public.audit_events (
    workspace_id, user_id, action, resource_type, resource_id, metadata
  ) VALUES (
    p_workspace_id, v_actor_id, 'source_cohort.archived',
    'source_cohort', p_cohort_id::TEXT,
    jsonb_build_object('previous_status', v_current_status)
  );

  RETURN jsonb_build_object('cohort_id', p_cohort_id, 'success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.archive_source_cohort(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_source_cohort(UUID, UUID) TO authenticated;

-- ============================================================
-- 5. RPC: add_source_to_cohort
--    Actor: any workspace member.
--    Idempotent: duplicate membership silently no-ops.
--    Validates both cohort and source belong to the same workspace.
--    Does not add to archived cohorts.
-- ============================================================
CREATE OR REPLACE FUNCTION public.add_source_to_cohort(
  p_workspace_id UUID,
  p_cohort_id    UUID,
  p_source_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_cohort_status TEXT;
  v_source_exists BOOLEAN;
  v_member_id UUID;
BEGIN
  -- 1. Authentication
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 2. Workspace membership
  IF NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a workspace member';
  END IF;

  -- 3. Validate cohort exists in this workspace
  SELECT status INTO v_cohort_status
  FROM public.source_cohorts
  WHERE id = p_cohort_id AND workspace_id = p_workspace_id;

  IF v_cohort_status IS NULL THEN
    RAISE EXCEPTION 'Source cohort not found in workspace';
  END IF;

  IF v_cohort_status = 'archived' THEN
    RAISE EXCEPTION 'Cannot add a source to an archived cohort';
  END IF;

  -- 4. Validate source exists in this workspace
  SELECT EXISTS (
    SELECT 1 FROM public.source_registry
    WHERE id = p_source_id AND workspace_id = p_workspace_id
  ) INTO v_source_exists;

  IF NOT v_source_exists THEN
    RAISE EXCEPTION 'Source not found in workspace';
  END IF;

  -- 5. Idempotent insert: duplicate membership silently no-ops
  INSERT INTO public.source_cohort_members (
    cohort_id, workspace_id, source_id, added_by
  ) VALUES (
    p_cohort_id, p_workspace_id, p_source_id, v_actor_id
  )
  ON CONFLICT (cohort_id, source_id) DO NOTHING
  RETURNING id INTO v_member_id;

  -- 6. Audit only on actual insert (v_member_id null means it was a no-op)
  IF v_member_id IS NOT NULL THEN
    INSERT INTO public.audit_events (
      workspace_id, user_id, action, resource_type, resource_id, metadata
    ) VALUES (
      p_workspace_id, v_actor_id, 'source_cohort_member.added',
      'source_cohort', p_cohort_id::TEXT,
      jsonb_build_object('source_id', p_source_id, 'cohort_id', p_cohort_id)
    );
  END IF;

  RETURN jsonb_build_object(
    'cohort_id', p_cohort_id,
    'source_id', p_source_id,
    'success', true,
    'was_duplicate', v_member_id IS NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.add_source_to_cohort(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_source_to_cohort(UUID, UUID, UUID) TO authenticated;

-- ============================================================
-- 6. RPC: remove_source_from_cohort
--    Actor: any workspace member.
--    Removes the membership row. Does not touch source_registry.
--    Idempotent: removing a non-existent membership is a no-op.
-- ============================================================
CREATE OR REPLACE FUNCTION public.remove_source_from_cohort(
  p_workspace_id UUID,
  p_cohort_id    UUID,
  p_source_id    UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_cohort_exists BOOLEAN;
  v_rows_deleted INT;
BEGIN
  -- 1. Authentication
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 2. Workspace membership
  IF NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a workspace member';
  END IF;

  -- 3. Validate cohort belongs to workspace (prevents cross-tenant id guessing)
  SELECT EXISTS (
    SELECT 1 FROM public.source_cohorts
    WHERE id = p_cohort_id AND workspace_id = p_workspace_id
  ) INTO v_cohort_exists;

  IF NOT v_cohort_exists THEN
    RAISE EXCEPTION 'Source cohort not found in workspace';
  END IF;

  -- 4. Delete the membership row (workspace_id included in WHERE for safety)
  DELETE FROM public.source_cohort_members
  WHERE cohort_id = p_cohort_id
    AND source_id = p_source_id
    AND workspace_id = p_workspace_id;

  GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;

  -- 5. Audit only on actual delete
  IF v_rows_deleted > 0 THEN
    INSERT INTO public.audit_events (
      workspace_id, user_id, action, resource_type, resource_id, metadata
    ) VALUES (
      p_workspace_id, v_actor_id, 'source_cohort_member.removed',
      'source_cohort', p_cohort_id::TEXT,
      jsonb_build_object('source_id', p_source_id, 'cohort_id', p_cohort_id)
    );
  END IF;

  RETURN jsonb_build_object(
    'cohort_id', p_cohort_id,
    'source_id', p_source_id,
    'success', true,
    'was_noop', v_rows_deleted = 0
  );
END;
$$;

REVOKE ALL ON FUNCTION public.remove_source_from_cohort(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_source_from_cohort(UUID, UUID, UUID) TO authenticated;
