-- ============================================================
-- Vanta: Missing Backend Primitives (Batch Registry, Atomic Batch Delete,
-- Post-to-Variant Attribution, Stable Workspace Timezone, Nullable Scene Correction)
-- Migration: 20260822000018_backend_primitives.sql
-- Depends on: 001 through 017 applied.
-- ============================================================

-- ------------------------------------------------------------
-- 1. STABLE WORKSPACE TIMEZONE
-- ------------------------------------------------------------
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

-- ------------------------------------------------------------
-- 2. IMPORT BATCH REGISTRY
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source_id UUID,
  FOREIGN KEY (source_id, workspace_id)
    REFERENCES public.source_registry(id, workspace_id)
    ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  batch_kind TEXT NOT NULL CHECK (batch_kind IN ('post_observations', 'experiment_outcomes', 'conversation_observations')),
  file_name TEXT,
  file_size_bytes BIGINT,
  file_sha256 TEXT,
  expected_rows INT,
  accepted_rows INT NOT NULL DEFAULT 0,
  rejected_rows INT NOT NULL DEFAULT 0,
  rejection_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'partial', 'failed')),
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_import_batches_workspace
  ON public.import_batches(workspace_id, created_at DESC);

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "import_batches_select" ON public.import_batches;
DROP POLICY IF EXISTS "import_batches_insert" ON public.import_batches;
DROP POLICY IF EXISTS "import_batches_update" ON public.import_batches;
DROP POLICY IF EXISTS "import_batches_delete" ON public.import_batches;

CREATE POLICY "import_batches_select" ON public.import_batches FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "import_batches_insert" ON public.import_batches FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

CREATE POLICY "import_batches_update" ON public.import_batches FOR UPDATE
  USING (public.is_workspace_admin_or_owner(workspace_id));

CREATE POLICY "import_batches_delete" ON public.import_batches FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- ------------------------------------------------------------
-- 3. EXTERNAL POST TO VARIANT ATTRIBUTION
-- ------------------------------------------------------------
ALTER TABLE public.creative_twin_versions
  ADD CONSTRAINT creative_twin_versions_id_workspace_id_key UNIQUE (id, workspace_id);

CREATE TABLE IF NOT EXISTS public.post_variant_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  connector_account_id UUID,
  FOREIGN KEY (connector_account_id, workspace_id)
    REFERENCES public.connector_accounts(id, workspace_id)
    ON DELETE SET NULL,
  provider TEXT NOT NULL,
  external_account_id TEXT,
  external_post_id TEXT NOT NULL,
  asset_id UUID NOT NULL,
  FOREIGN KEY (asset_id, workspace_id)
    REFERENCES public.creative_assets(id, workspace_id)
    ON DELETE CASCADE,
  twin_id UUID NOT NULL,
  FOREIGN KEY (twin_id, workspace_id)
    REFERENCES public.creative_twins(id, workspace_id)
    ON DELETE CASCADE,
  variant_twin_id UUID,
  FOREIGN KEY (variant_twin_id, workspace_id)
    REFERENCES public.creative_twins(id, workspace_id)
    ON DELETE SET NULL,
  twin_version_id UUID,
  FOREIGN KEY (twin_version_id, workspace_id)
    REFERENCES public.creative_twin_versions(id, workspace_id)
    ON DELETE SET NULL,
  experiment_id UUID,
  FOREIGN KEY (experiment_id, workspace_id)
    REFERENCES public.experiments(id, workspace_id)
    ON DELETE SET NULL,
  source_id UUID,
  FOREIGN KEY (source_id, workspace_id)
    REFERENCES public.source_registry(id, workspace_id)
    ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  idempotency_key TEXT,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, workspace_id),
  UNIQUE (workspace_id, provider, external_post_id)
);

CREATE INDEX IF NOT EXISTS idx_post_variant_attributions_workspace
  ON public.post_variant_attributions(workspace_id, provider, published_at DESC);

ALTER TABLE public.post_variant_attributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "post_variant_attributions_select" ON public.post_variant_attributions;
DROP POLICY IF EXISTS "post_variant_attributions_insert" ON public.post_variant_attributions;
DROP POLICY IF EXISTS "post_variant_attributions_update" ON public.post_variant_attributions;
DROP POLICY IF EXISTS "post_variant_attributions_delete" ON public.post_variant_attributions;

CREATE POLICY "post_variant_attributions_select" ON public.post_variant_attributions FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "post_variant_attributions_insert" ON public.post_variant_attributions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

CREATE POLICY "post_variant_attributions_update" ON public.post_variant_attributions FOR UPDATE
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "post_variant_attributions_delete" ON public.post_variant_attributions FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

-- ------------------------------------------------------------
-- 4. ATOMIC POST OBSERVATION BATCH DELETE RPC
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_post_observation_batch(
  p_workspace_id UUID,
  p_batch_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_deleted_count INT;
BEGIN
  -- 1. Authentication check
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 2. Workspace membership check
  IF NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a workspace member';
  END IF;

  -- 3. Authorization check: Admin or owner only
  IF NOT public.is_workspace_admin_or_owner(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: only workspace owners and admins may delete post observation batches';
  END IF;

  -- 4. Delete scoped rows
  WITH deleted AS (
    DELETE FROM public.post_observations
    WHERE workspace_id = p_workspace_id
      AND import_batch_id = p_batch_id
    RETURNING id
  )
  SELECT count(*) INTO v_deleted_count FROM deleted;

  -- 5. If batch exists in import_batches, remove or mark it
  DELETE FROM public.import_batches
  WHERE workspace_id = p_workspace_id
    AND id = p_batch_id;

  -- 6. Write append-only audit event in the same transaction
  INSERT INTO public.audit_events (
    workspace_id,
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    p_workspace_id,
    v_actor_id,
    'post_observation_batch.deleted',
    'post_observation_batch',
    p_batch_id::text,
    jsonb_build_object(
      'observations_deleted', v_deleted_count,
      'batch_id', p_batch_id
    )
  );

  -- 7. Return summary
  RETURN jsonb_build_object(
    'success', true,
    'deleted', v_deleted_count,
    'batch_id', p_batch_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_post_observation_batch(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_post_observation_batch(UUID, UUID) TO authenticated;

-- ------------------------------------------------------------
-- 5. NULLABLE SCENE CORRECTION RPC PARAMETERS
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_scene_correction_atomic(
  p_scene_id UUID,
  p_workspace_id UUID,
  p_shot_purpose TEXT,
  p_spoken_transcript TEXT,
  p_on_screen_text TEXT DEFAULT NULL,
  p_provided_visual_notes TEXT DEFAULT NULL,
  p_start_seconds NUMERIC DEFAULT NULL,
  p_end_seconds NUMERIC DEFAULT NULL,
  p_reading_burden_wpm INT DEFAULT NULL,
  p_change_summary TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_twin_id UUID;
  v_asset_creator_id UUID;
  v_next_version INT;
  v_twin_row RECORD;
  v_scenes_json JSONB;
  v_claims_json JSONB;
  v_snapshot JSONB;
  v_version_id UUID;
BEGIN
  -- 1. Mandatory authentication check
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 2. Validate workspace membership
  IF NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a workspace member';
  END IF;

  -- 3. Fetch twin and workspace relationship
  SELECT twin_id INTO v_twin_id
  FROM public.creative_scenes
  WHERE id = p_scene_id AND workspace_id = p_workspace_id;

  IF v_twin_id IS NULL THEN
    RAISE EXCEPTION 'Scene not found in specified workspace';
  END IF;

  -- 4. Derive asset creator and enforce correction authority
  SELECT a.created_by INTO v_asset_creator_id
  FROM public.creative_twins t
  JOIN public.creative_assets a ON a.id = t.asset_id AND a.workspace_id = p_workspace_id
  WHERE t.id = v_twin_id AND t.workspace_id = p_workspace_id;

  IF v_asset_creator_id IS NULL THEN
    RAISE EXCEPTION 'Associated asset not found in specified workspace';
  END IF;

  IF v_asset_creator_id != v_actor_id AND NOT public.is_workspace_admin_or_owner(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: only the asset creator or workspace admin/owner may correct scenes';
  END IF;

  -- 5. Acquire transaction-scoped advisory lock keyed by twin ID to serialize concurrent snapshots
  PERFORM pg_advisory_xact_lock(hashtext(v_twin_id::text));

  -- 6. Update scene record
  UPDATE public.creative_scenes
  SET
    shot_purpose = p_shot_purpose,
    spoken_transcript = p_spoken_transcript,
    on_screen_text = p_on_screen_text,
    provided_visual_notes = p_provided_visual_notes,
    start_seconds = p_start_seconds,
    end_seconds = p_end_seconds,
    reading_burden_wpm = p_reading_burden_wpm,
    is_user_corrected = true,
    updated_at = NOW()
  WHERE id = p_scene_id AND workspace_id = p_workspace_id;

  -- 7. Fetch full twin record
  SELECT * INTO v_twin_row FROM public.creative_twins WHERE id = v_twin_id AND workspace_id = p_workspace_id;

  -- 8. Fetch all current scenes & claims for the twin
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.scene_index), '[]'::jsonb)
    INTO v_scenes_json
    FROM public.creative_scenes s
    WHERE s.twin_id = v_twin_id AND s.workspace_id = p_workspace_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.created_at), '[]'::jsonb)
    INTO v_claims_json
    FROM public.creative_claims c
    WHERE c.twin_id = v_twin_id AND c.workspace_id = p_workspace_id;

  -- 9. Determine next version number
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
  FROM public.creative_twin_versions
  WHERE twin_id = v_twin_id AND workspace_id = p_workspace_id;

  -- 10. Construct immutable snapshot JSON
  v_snapshot := jsonb_build_object(
    'twin_id', v_twin_id,
    'title', v_twin_row.title,
    'asset_kind', v_twin_row.asset_kind,
    'declared_platform', v_twin_row.declared_platform,
    'declared_objective', v_twin_row.declared_objective,
    'deterministic_features', v_twin_row.deterministic_features,
    'known_gaps', v_twin_row.known_gaps,
    'state', v_twin_row.state,
    'scenes', v_scenes_json,
    'claims', v_claims_json,
    'snapshotted_at', NOW()
  );

  -- 11. Insert new version record
  INSERT INTO public.creative_twin_versions (
    twin_id,
    workspace_id,
    version_number,
    snapshot,
    change_summary,
    created_by
  ) VALUES (
    v_twin_id,
    p_workspace_id,
    v_next_version,
    v_snapshot,
    COALESCE(p_change_summary, 'Corrected scene timing/transcript attributes'),
    v_actor_id
  )
  RETURNING id INTO v_version_id;

  -- 12. Return updated version number and ID
  RETURN jsonb_build_object(
    'success', true,
    'version_number', v_next_version,
    'version_id', v_version_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.save_scene_correction_atomic(UUID, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_scene_correction_atomic(UUID, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INT, TEXT) TO authenticated;
