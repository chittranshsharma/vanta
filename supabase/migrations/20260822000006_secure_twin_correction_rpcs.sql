-- Migration: 20260822000006_secure_twin_correction_rpcs.sql
-- Description: Emergency security patch for creative twin atomic correction RPCs
-- 1. Sets explicit search_path = public, pg_temp
-- 2. Enforces non-null auth.uid() authentication check at procedure start
-- 3. Removes browser-supplied p_user_id parameter (uses auth.uid() exclusively)
-- 4. Enforces strict correction authority: only asset creator or workspace admin/owner
-- 5. Revokes execution from PUBLIC and anon; grants to authenticated and service_role
-- 6. Enforces per-twin concurrency serialization using transaction-scoped advisory locks

-- 1. DROP OLD UNSECURED FUNCTIONS
DROP FUNCTION IF EXISTS public.save_scene_correction_atomic(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INT, TEXT);
DROP FUNCTION IF EXISTS public.save_claim_correction_atomic(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT);

-- 2. SECURE SCENE CORRECTION ATOMIC PROCEDURE
CREATE OR REPLACE FUNCTION public.save_scene_correction_atomic(
  p_scene_id UUID,
  p_workspace_id UUID,
  p_shot_purpose TEXT,
  p_spoken_transcript TEXT,
  p_on_screen_text TEXT,
  p_provided_visual_notes TEXT,
  p_start_seconds NUMERIC,
  p_end_seconds NUMERIC,
  p_reading_burden_wpm INT,
  p_change_summary TEXT
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
    WHERE s.twin_id = v_twin_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.created_at), '[]'::jsonb)
    INTO v_claims_json
    FROM public.creative_claims c
    WHERE c.twin_id = v_twin_id;

  -- 9. Build immutable snapshot
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

  -- 10. Monotonically increment version number under advisory lock
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
    FROM public.creative_twin_versions
    WHERE twin_id = v_twin_id;

  -- 11. Insert immutable snapshot with verified actor ID
  INSERT INTO public.creative_twin_versions (
    twin_id, workspace_id, version_number, snapshot, change_summary, created_by
  ) VALUES (
    v_twin_id, p_workspace_id, v_next_version, v_snapshot, p_change_summary, v_actor_id
  ) RETURNING id INTO v_version_id;

  -- 12. Record audit event with verified actor ID
  INSERT INTO public.audit_events (
    workspace_id, user_id, action, resource_type, resource_id, metadata
  ) VALUES (
    p_workspace_id, v_actor_id, 'creative_twin.scene_corrected', 'creative_twin', v_twin_id::text,
    jsonb_build_object(
      'scene_id', p_scene_id,
      'version_number', v_next_version,
      'change_summary', p_change_summary
    )
  );

  RETURN jsonb_build_object(
    'version_id', v_version_id,
    'version_number', v_next_version,
    'snapshot', v_snapshot
  );
END;
$$;

-- 3. SECURE CLAIM CORRECTION ATOMIC PROCEDURE
CREATE OR REPLACE FUNCTION public.save_claim_correction_atomic(
  p_claim_id UUID,
  p_workspace_id UUID,
  p_brand_claim_id UUID,
  p_claim_text TEXT,
  p_claim_classification TEXT,
  p_brand_alignment_status TEXT,
  p_proof_reference TEXT,
  p_change_summary TEXT
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
  FROM public.creative_claims
  WHERE id = p_claim_id AND workspace_id = p_workspace_id;

  IF v_twin_id IS NULL THEN
    RAISE EXCEPTION 'Claim not found in specified workspace';
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
    RAISE EXCEPTION 'Access denied: only the asset creator or workspace admin/owner may correct claims';
  END IF;

  -- 5. Acquire transaction-scoped advisory lock keyed by twin ID to serialize concurrent snapshots
  PERFORM pg_advisory_xact_lock(hashtext(v_twin_id::text));

  -- 6. Update claim record
  UPDATE public.creative_claims
  SET
    brand_claim_id = p_brand_claim_id,
    claim_text = p_claim_text,
    claim_classification = p_claim_classification,
    brand_alignment_status = p_brand_alignment_status,
    proof_reference = p_proof_reference,
    is_user_corrected = true,
    updated_at = NOW()
  WHERE id = p_claim_id AND workspace_id = p_workspace_id;

  -- 7. Fetch full twin record
  SELECT * INTO v_twin_row FROM public.creative_twins WHERE id = v_twin_id AND workspace_id = p_workspace_id;

  -- 8. Fetch all current scenes & claims for the twin
  SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.scene_index), '[]'::jsonb)
    INTO v_scenes_json
    FROM public.creative_scenes s
    WHERE s.twin_id = v_twin_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.created_at), '[]'::jsonb)
    INTO v_claims_json
    FROM public.creative_claims c
    WHERE c.twin_id = v_twin_id;

  -- 9. Build immutable snapshot
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

  -- 10. Monotonically increment version number under advisory lock
  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
    FROM public.creative_twin_versions
    WHERE twin_id = v_twin_id;

  -- 11. Insert immutable snapshot with verified actor ID
  INSERT INTO public.creative_twin_versions (
    twin_id, workspace_id, version_number, snapshot, change_summary, created_by
  ) VALUES (
    v_twin_id, p_workspace_id, v_next_version, v_snapshot, p_change_summary, v_actor_id
  ) RETURNING id INTO v_version_id;

  -- 12. Record audit event with verified actor ID
  INSERT INTO public.audit_events (
    workspace_id, user_id, action, resource_type, resource_id, metadata
  ) VALUES (
    p_workspace_id, v_actor_id, 'creative_twin.claim_corrected', 'creative_twin', v_twin_id::text,
    jsonb_build_object(
      'claim_id', p_claim_id,
      'version_number', v_next_version,
      'change_summary', p_change_summary
    )
  );

  RETURN jsonb_build_object(
    'version_id', v_version_id,
    'version_number', v_next_version,
    'snapshot', v_snapshot
  );
END;
$$;

-- 4. REVOKE PERMISSIONS FROM PUBLIC AND ANON; GRANT ONLY TO AUTHENTICATED AND SERVICE_ROLE
REVOKE ALL ON FUNCTION public.save_scene_correction_atomic(UUID, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_scene_correction_atomic(UUID, UUID, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INT, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.save_claim_correction_atomic(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_claim_correction_atomic(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 5. HARDEN SEARCH_PATH ON HELPER TRIGGER FUNCTIONS
CREATE OR REPLACE FUNCTION public.block_manual_connected_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.health_status = 'connected' AND (OLD.health_status IS NULL OR OLD.health_status != 'connected') THEN
    IF current_setting('role', true) != 'service_role' THEN
      RAISE EXCEPTION 'Status "connected" may only be set by automated verification services, not manual client writes.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.storage_workspace_id(object_name text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  first_segment text;
BEGIN
  IF object_name IS NULL OR object_name = '' THEN
    RETURN NULL;
  END IF;
  first_segment := split_part(object_name, '/', 1);
  IF first_segment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN first_segment::uuid;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.block_twin_version_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Version snapshots in creative_twin_versions are strictly immutable and cannot be updated or deleted.';
END;
$$;
