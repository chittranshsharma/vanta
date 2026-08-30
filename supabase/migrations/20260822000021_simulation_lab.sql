-- ============================================================
-- Vanta: Counterfactual Simulation Lab Persistence & Productization
-- Migration: 20260822000021_simulation_lab.sql
-- Status: PENDING LIVE APPLY
-- Depends on: 001 through 020 applied. Safe forward-only migration.
-- ============================================================

-- ------------------------------------------------------------
-- 1. SIMULATION RUNS (Provenance & State Record)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.simulation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  twin_id UUID NOT NULL,
  FOREIGN KEY (twin_id, workspace_id)
    REFERENCES public.creative_twins(id, workspace_id)
    ON DELETE CASCADE,
  twin_version_id UUID NOT NULL,
  FOREIGN KEY (twin_version_id, workspace_id)
    REFERENCES public.creative_twin_versions(id, workspace_id)
    ON DELETE CASCADE,
  twin_version INT NOT NULL CHECK (twin_version >= 1),
  hypothesis TEXT NOT NULL CHECK (char_length(hypothesis) <= 500),
  controls JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (
    status IN ('draft', 'queued', 'running', 'completed', 'blocked', 'failed', 'cancelled')
  ),
  evidence_class TEXT NOT NULL DEFAULT 'simulation' CHECK (evidence_class = 'simulation'),
  observed_validation TEXT NOT NULL DEFAULT 'unknown' CHECK (
    observed_validation IN ('unknown', 'linked')
  ),
  review_decision TEXT NOT NULL DEFAULT 'unreviewed' CHECK (
    review_decision IN ('unreviewed', 'needs_human', 'accepted', 'rejected', 'corrected')
  ),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  uncertainty_note TEXT NOT NULL,
  assumptions JSONB NOT NULL DEFAULT '[]'::jsonb,
  limitations JSONB NOT NULL DEFAULT '[]'::jsonb,
  idempotency_key TEXT NOT NULL,
  provenance JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  UNIQUE (id, workspace_id),
  UNIQUE (workspace_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_simulation_runs_workspace
  ON public.simulation_runs(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_simulation_runs_twin
  ON public.simulation_runs(workspace_id, twin_id);

CREATE INDEX IF NOT EXISTS idx_simulation_runs_status
  ON public.simulation_runs(workspace_id, status);

CREATE INDEX IF NOT EXISTS idx_simulation_runs_review
  ON public.simulation_runs(workspace_id, review_decision);

ALTER TABLE public.simulation_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "simulation_runs_select" ON public.simulation_runs;
DROP POLICY IF EXISTS "simulation_runs_insert" ON public.simulation_runs;
DROP POLICY IF EXISTS "simulation_runs_no_update" ON public.simulation_runs;
DROP POLICY IF EXISTS "simulation_runs_no_delete" ON public.simulation_runs;

CREATE POLICY "simulation_runs_select" ON public.simulation_runs FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "simulation_runs_insert" ON public.simulation_runs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

CREATE POLICY "simulation_runs_no_update" ON public.simulation_runs FOR UPDATE
  USING (false);

CREATE POLICY "simulation_runs_no_delete" ON public.simulation_runs FOR DELETE
  USING (false);

-- Trigger: protect core simulation run fields from arbitrary modification
CREATE OR REPLACE FUNCTION public.block_simulation_run_core_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.workspace_id != NEW.workspace_id OR
     OLD.twin_id != NEW.twin_id OR
     OLD.twin_version_id != NEW.twin_version_id OR
     OLD.twin_version != NEW.twin_version OR
     OLD.hypothesis != NEW.hypothesis OR
     OLD.evidence_class != NEW.evidence_class OR
     OLD.idempotency_key != NEW.idempotency_key OR
     OLD.created_by IS DISTINCT FROM NEW.created_by OR
     OLD.created_at != NEW.created_at THEN
    RAISE EXCEPTION 'Core simulation run parameters are immutable. State transitions must occur via authorized RPCs.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.block_simulation_run_core_mutation() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_block_simulation_run_core_mutation ON public.simulation_runs;
CREATE TRIGGER trg_block_simulation_run_core_mutation
BEFORE UPDATE ON public.simulation_runs
FOR EACH ROW
EXECUTE FUNCTION public.block_simulation_run_core_mutation();

-- ------------------------------------------------------------
-- 2. SIMULATION MUTATIONS (Immutable Ordered Mutation History)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.simulation_mutations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  simulation_run_id UUID NOT NULL,
  FOREIGN KEY (simulation_run_id, workspace_id)
    REFERENCES public.simulation_runs(id, workspace_id)
    ON DELETE CASCADE,
  sequence_order INT NOT NULL CHECK (sequence_order >= 0),
  mutation_type TEXT NOT NULL CHECK (
    mutation_type IN (
      'hook_replacement',
      'cta_replacement',
      'scene_reorder',
      'scene_duration_adjust',
      'on_screen_text_change',
      'claim_substitution',
      'tone_guideline_adaptation'
    )
  ),
  target_scene_index INT NOT NULL CHECK (target_scene_index >= 0),
  rationale TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, workspace_id),
  UNIQUE (workspace_id, simulation_run_id, sequence_order)
);

CREATE INDEX IF NOT EXISTS idx_simulation_mutations_run
  ON public.simulation_mutations(workspace_id, simulation_run_id, sequence_order ASC);

ALTER TABLE public.simulation_mutations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "simulation_mutations_select" ON public.simulation_mutations;
DROP POLICY IF EXISTS "simulation_mutations_insert" ON public.simulation_mutations;
DROP POLICY IF EXISTS "simulation_mutations_no_update" ON public.simulation_mutations;
DROP POLICY IF EXISTS "simulation_mutations_no_delete" ON public.simulation_mutations;

CREATE POLICY "simulation_mutations_select" ON public.simulation_mutations FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "simulation_mutations_insert" ON public.simulation_mutations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

CREATE POLICY "simulation_mutations_no_update" ON public.simulation_mutations FOR UPDATE
  USING (false);

CREATE POLICY "simulation_mutations_no_delete" ON public.simulation_mutations FOR DELETE
  USING (false);

-- ------------------------------------------------------------
-- 3. SIMULATION RESULTS (Immutable Structural Deltas & Warnings)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.simulation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  simulation_run_id UUID NOT NULL,
  FOREIGN KEY (simulation_run_id, workspace_id)
    REFERENCES public.simulation_runs(id, workspace_id)
    ON DELETE CASCADE,
  simulated_scenes JSONB NOT NULL DEFAULT '[]'::jsonb,
  structural_delta JSONB NOT NULL DEFAULT '{}'::jsonb,
  council_execution JSONB NOT NULL DEFAULT '{}'::jsonb,
  warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, workspace_id),
  UNIQUE (workspace_id, simulation_run_id)
);

CREATE INDEX IF NOT EXISTS idx_simulation_results_run
  ON public.simulation_results(workspace_id, simulation_run_id);

ALTER TABLE public.simulation_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "simulation_results_select" ON public.simulation_results;
DROP POLICY IF EXISTS "simulation_results_insert" ON public.simulation_results;
DROP POLICY IF EXISTS "simulation_results_no_update" ON public.simulation_results;
DROP POLICY IF EXISTS "simulation_results_no_delete" ON public.simulation_results;

CREATE POLICY "simulation_results_select" ON public.simulation_results FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "simulation_results_insert" ON public.simulation_results FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

CREATE POLICY "simulation_results_no_update" ON public.simulation_results FOR UPDATE
  USING (false);

CREATE POLICY "simulation_results_no_delete" ON public.simulation_results FOR DELETE
  USING (false);

-- ------------------------------------------------------------
-- 4. SIMULATION REVIEW EVENTS (Append-Only Governance Ledger)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.simulation_review_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  simulation_run_id UUID NOT NULL,
  FOREIGN KEY (simulation_run_id, workspace_id)
    REFERENCES public.simulation_runs(id, workspace_id)
    ON DELETE CASCADE,
  event_kind TEXT NOT NULL CHECK (
    event_kind IN ('created', 'review_requested', 'accepted', 'rejected', 'corrected')
  ),
  previous_decision TEXT,
  new_decision TEXT NOT NULL CHECK (
    new_decision IN ('unreviewed', 'needs_human', 'accepted', 'rejected', 'corrected')
  ),
  rationale TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_simulation_review_events_workspace
  ON public.simulation_review_events(workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_simulation_review_events_run
  ON public.simulation_review_events(workspace_id, simulation_run_id);

ALTER TABLE public.simulation_review_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "simulation_review_events_select" ON public.simulation_review_events;
DROP POLICY IF EXISTS "simulation_review_events_insert" ON public.simulation_review_events;
DROP POLICY IF EXISTS "simulation_review_events_no_update" ON public.simulation_review_events;
DROP POLICY IF EXISTS "simulation_review_events_no_delete" ON public.simulation_review_events;

CREATE POLICY "simulation_review_events_select" ON public.simulation_review_events FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "simulation_review_events_insert" ON public.simulation_review_events FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

CREATE POLICY "simulation_review_events_no_update" ON public.simulation_review_events FOR UPDATE
  USING (false);

CREATE POLICY "simulation_review_events_no_delete" ON public.simulation_review_events FOR DELETE
  USING (false);

-- ------------------------------------------------------------
-- 5. SIMULATION OBSERVED LINKS (Traceability-Only Linkage)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.simulation_observed_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  simulation_run_id UUID NOT NULL,
  FOREIGN KEY (simulation_run_id, workspace_id)
    REFERENCES public.simulation_runs(id, workspace_id)
    ON DELETE CASCADE,
  experiment_outcome_id UUID NOT NULL,
  FOREIGN KEY (experiment_outcome_id, workspace_id)
    REFERENCES public.experiment_outcomes(id, workspace_id)
    ON DELETE RESTRICT,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, workspace_id),
  UNIQUE (workspace_id, simulation_run_id, experiment_outcome_id)
);

CREATE INDEX IF NOT EXISTS idx_simulation_observed_links_run
  ON public.simulation_observed_links(workspace_id, simulation_run_id);

CREATE INDEX IF NOT EXISTS idx_simulation_observed_links_outcome
  ON public.simulation_observed_links(workspace_id, experiment_outcome_id);

ALTER TABLE public.simulation_observed_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "simulation_observed_links_select" ON public.simulation_observed_links;
DROP POLICY IF EXISTS "simulation_observed_links_insert" ON public.simulation_observed_links;
DROP POLICY IF EXISTS "simulation_observed_links_no_update" ON public.simulation_observed_links;
DROP POLICY IF EXISTS "simulation_observed_links_no_delete" ON public.simulation_observed_links;

CREATE POLICY "simulation_observed_links_select" ON public.simulation_observed_links FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "simulation_observed_links_insert" ON public.simulation_observed_links FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());

CREATE POLICY "simulation_observed_links_no_update" ON public.simulation_observed_links FOR UPDATE
  USING (false);

CREATE POLICY "simulation_observed_links_no_delete" ON public.simulation_observed_links FOR DELETE
  USING (false);

-- ------------------------------------------------------------
-- 6. EXPAND JOB TYPES CONSTRAINT FOR SIMULATION WORKERS
-- ------------------------------------------------------------
ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_job_type_check;

ALTER TABLE public.jobs ADD CONSTRAINT jobs_job_type_check CHECK (
  job_type IN (
    'model_task',
    'campaign_csv_normalize',
    'media_probe',
    'source_refresh',
    'embedding_refresh',
    'conversation_import_validate',
    'conversation_deduplicate',
    'conversation_interpretation_proposal',
    'conversation_attribution',
    'conversation_aggregate',
    'simulation_validate',
    'simulation_execute',
    'simulation_review_ready',
    'simulation_observed_link'
  )
);

-- ------------------------------------------------------------
-- 7. ATOMIC TRANSACTIONAL PERSISTENCE RPC (Create Run + Mutations + Results)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_simulation_run_atomic(
  p_workspace_id UUID,
  p_twin_id UUID,
  p_twin_version_id UUID,
  p_twin_version INT,
  p_hypothesis TEXT,
  p_mutations JSONB,
  p_results JSONB,
  p_assumptions JSONB DEFAULT '[]'::jsonb,
  p_limitations JSONB DEFAULT '[]'::jsonb,
  p_controls JSONB DEFAULT '[]'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL,
  p_provenance JSONB DEFAULT '{}'::jsonb,
  p_uncertainty_note TEXT DEFAULT 'Simulated variant produced under hypothetical parameter modifications.',
  p_status TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_run_id UUID;
  v_mut_elem JSONB;
  v_seq INT := 0;
  v_existing_id UUID;
  v_initial_status TEXT;
BEGIN
  -- 1. Authentication & Tenant Authorization Check
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create simulation run.';
  END IF;

  IF NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: caller is not a member of workspace %.', p_workspace_id;
  END IF;

  -- 2. Verify twin and twin version exist within same workspace
  IF NOT EXISTS (
    SELECT 1 FROM public.creative_twin_versions
    WHERE id = p_twin_version_id AND twin_id = p_twin_id AND workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'Twin version % for twin % not found in workspace %.', p_twin_version_id, p_twin_id, p_workspace_id;
  END IF;

  -- 3. Check idempotency key for duplicate request replay
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.simulation_runs
    WHERE workspace_id = p_workspace_id AND idempotency_key = p_idempotency_key;

    IF v_existing_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', true,
        'simulation_run_id', v_existing_id,
        'idempotent_replay', true
      );
    END IF;
  END IF;

  v_initial_status := COALESCE(
    p_status,
    CASE WHEN p_results IS NOT NULL AND p_results != '{}'::jsonb THEN 'completed' ELSE 'draft' END
  );

  -- 4. Insert simulation run record (evidence_class strictly 'simulation')
  INSERT INTO public.simulation_runs (
    workspace_id,
    twin_id,
    twin_version_id,
    twin_version,
    hypothesis,
    controls,
    status,
    evidence_class,
    observed_validation,
    review_decision,
    uncertainty_note,
    assumptions,
    limitations,
    idempotency_key,
    provenance,
    created_by,
    created_at,
    completed_at
  ) VALUES (
    p_workspace_id,
    p_twin_id,
    p_twin_version_id,
    p_twin_version,
    p_hypothesis,
    p_controls,
    v_initial_status,
    'simulation',
    'unknown',
    'unreviewed',
    p_uncertainty_note,
    p_assumptions,
    p_limitations,
    COALESCE(p_idempotency_key, 'sim:' || gen_random_uuid()::text),
    p_provenance,
    v_actor_id,
    NOW(),
    CASE WHEN v_initial_status IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE NULL END
  )
  RETURNING id INTO v_run_id;

  -- 5. Insert ordered mutations
  IF p_mutations IS NOT NULL AND jsonb_array_length(p_mutations) > 0 THEN
    FOR v_mut_elem IN SELECT * FROM jsonb_array_elements(p_mutations)
    LOOP
      INSERT INTO public.simulation_mutations (
        workspace_id,
        simulation_run_id,
        sequence_order,
        mutation_type,
        target_scene_index,
        rationale,
        payload,
        created_by,
        created_at
      ) VALUES (
        p_workspace_id,
        v_run_id,
        v_seq,
        v_mut_elem->>'mutation_type',
        COALESCE((v_mut_elem->>'target_scene_index')::int, 0),
        COALESCE(v_mut_elem->>'rationale', ''),
        COALESCE(v_mut_elem->'payload', '{}'::jsonb),
        v_actor_id,
        NOW()
      );
      v_seq := v_seq + 1;
    END LOOP;
  END IF;

  -- 6. Insert simulation results
  IF p_results IS NOT NULL THEN
    INSERT INTO public.simulation_results (
      workspace_id,
      simulation_run_id,
      simulated_scenes,
      structural_delta,
      council_execution,
      warnings,
      created_by,
      created_at
    ) VALUES (
      p_workspace_id,
      v_run_id,
      COALESCE(p_results->'simulated_scenes', '[]'::jsonb),
      COALESCE(p_results->'structural_delta', '{}'::jsonb),
      COALESCE(p_results->'council_execution', '{}'::jsonb),
      COALESCE(p_results->'warnings', '[]'::jsonb),
      v_actor_id,
      NOW()
    );
  END IF;

  -- 7. Insert initial review event
  INSERT INTO public.simulation_review_events (
    workspace_id,
    simulation_run_id,
    event_kind,
    previous_decision,
    new_decision,
    rationale,
    metadata,
    created_by,
    created_at
  ) VALUES (
    p_workspace_id,
    v_run_id,
    'created',
    NULL,
    'unreviewed',
    'Initial simulation run created and verified.',
    jsonb_build_object('mutation_count', v_seq),
    v_actor_id,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'simulation_run_id', v_run_id,
    'idempotent_replay', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_simulation_run_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_simulation_run_atomic TO authenticated;

-- ------------------------------------------------------------
-- 8. ATOMIC HUMAN REVIEW RPC (State Transition & Audit Event)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.review_simulation_run_atomic(
  p_workspace_id UUID,
  p_simulation_run_id UUID,
  p_decision TEXT,
  p_rationale TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_previous_decision TEXT;
  v_valid_transition BOOLEAN := false;
  v_event_kind TEXT;
BEGIN
  -- 1. Authentication & Workspace Membership
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to review simulation run.';
  END IF;

  IF NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: caller is not a member of workspace %.', p_workspace_id;
  END IF;

  -- 2. Fetch current simulation run
  SELECT review_decision INTO v_previous_decision
  FROM public.simulation_runs
  WHERE id = p_simulation_run_id AND workspace_id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Simulation run % not found in workspace %.', p_simulation_run_id, p_workspace_id;
  END IF;

  -- 3. Validate transition matrix
  IF v_previous_decision = p_decision THEN
    -- Idempotent no-op
    RETURN jsonb_build_object(
      'success', true,
      'simulation_run_id', p_simulation_run_id,
      'previous_decision', v_previous_decision,
      'new_decision', p_decision,
      'idempotent_no_op', true
    );
  END IF;

  IF v_previous_decision = 'unreviewed' AND p_decision IN ('needs_human', 'accepted', 'rejected', 'corrected') THEN
    v_valid_transition := true;
  ELSIF v_previous_decision = 'needs_human' AND p_decision IN ('accepted', 'rejected', 'corrected') THEN
    v_valid_transition := true;
  ELSIF v_previous_decision = 'accepted' AND p_decision IN ('corrected', 'rejected') THEN
    v_valid_transition := true;
  ELSIF v_previous_decision = 'rejected' AND p_decision IN ('needs_human', 'accepted') THEN
    v_valid_transition := true;
  ELSIF v_previous_decision = 'corrected' AND p_decision IN ('accepted', 'rejected') THEN
    v_valid_transition := true;
  END IF;

  IF NOT v_valid_transition THEN
    RAISE EXCEPTION 'Illegal review transition from % to % for simulation run %.',
      v_previous_decision, p_decision, p_simulation_run_id;
  END IF;

  -- 4. Determine event_kind
  IF p_decision = 'needs_human' THEN
    v_event_kind := 'review_requested';
  ELSE
    v_event_kind := p_decision;
  END IF;

  -- 5. Update simulation run (evidence_class remains strictly 'simulation')
  UPDATE public.simulation_runs
  SET review_decision = p_decision,
      reviewed_by = v_actor_id,
      reviewed_at = NOW()
  WHERE id = p_simulation_run_id AND workspace_id = p_workspace_id;

  -- 6. Insert append-only audit review event
  INSERT INTO public.simulation_review_events (
    workspace_id,
    simulation_run_id,
    event_kind,
    previous_decision,
    new_decision,
    rationale,
    metadata,
    created_by,
    created_at
  ) VALUES (
    p_workspace_id,
    p_simulation_run_id,
    v_event_kind,
    v_previous_decision,
    p_decision,
    p_rationale,
    p_metadata,
    v_actor_id,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'simulation_run_id', p_simulation_run_id,
    'previous_decision', v_previous_decision,
    'new_decision', p_decision,
    'idempotent_no_op', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.review_simulation_run_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_simulation_run_atomic TO authenticated;

-- ------------------------------------------------------------
-- 9. ATOMIC TRACEABILITY LINKAGE RPC (Simulation -> Experiment Outcome)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.link_simulation_observed_outcome_atomic(
  p_workspace_id UUID,
  p_simulation_run_id UUID,
  p_experiment_outcome_id UUID,
  p_note TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_existing_id UUID;
BEGIN
  -- 1. Authentication & Workspace Membership
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to link observed outcome.';
  END IF;

  IF NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: caller is not a member of workspace %.', p_workspace_id;
  END IF;

  -- 2. Verify simulation run exists in same workspace
  IF NOT EXISTS (
    SELECT 1 FROM public.simulation_runs
    WHERE id = p_simulation_run_id AND workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'Simulation run % not found in workspace %.', p_simulation_run_id, p_workspace_id;
  END IF;

  -- 3. Verify experiment outcome exists in same workspace
  IF NOT EXISTS (
    SELECT 1 FROM public.experiment_outcomes
    WHERE id = p_experiment_outcome_id AND workspace_id = p_workspace_id
  ) THEN
    RAISE EXCEPTION 'Experiment outcome % not found in workspace %.', p_experiment_outcome_id, p_workspace_id;
  END IF;

  -- 4. Check for existing link (idempotent)
  SELECT id INTO v_existing_id
  FROM public.simulation_observed_links
  WHERE workspace_id = p_workspace_id
    AND simulation_run_id = p_simulation_run_id
    AND experiment_outcome_id = p_experiment_outcome_id;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'link_id', v_existing_id,
      'simulation_run_id', p_simulation_run_id,
      'experiment_outcome_id', p_experiment_outcome_id,
      'idempotent_replay', true
    );
  END IF;

  -- 5. Insert traceability link record
  INSERT INTO public.simulation_observed_links (
    workspace_id,
    simulation_run_id,
    experiment_outcome_id,
    note,
    metadata,
    created_by,
    created_at
  ) VALUES (
    p_workspace_id,
    p_simulation_run_id,
    p_experiment_outcome_id,
    p_note,
    p_metadata,
    v_actor_id,
    NOW()
  )
  RETURNING id INTO v_existing_id;

  -- 6. Transition observed_validation state to 'linked' (evidence_class remains strictly 'simulation')
  UPDATE public.simulation_runs
  SET observed_validation = 'linked'
  WHERE id = p_simulation_run_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object(
    'success', true,
    'link_id', v_existing_id,
    'simulation_run_id', p_simulation_run_id,
    'experiment_outcome_id', p_experiment_outcome_id,
    'idempotent_replay', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.link_simulation_observed_outcome_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_simulation_observed_outcome_atomic TO authenticated;

-- ------------------------------------------------------------
-- 10. ATOMIC STATUS TRANSITION & CANCELLATION RPC
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transition_simulation_run_status_atomic(
  p_workspace_id UUID,
  p_simulation_run_id UUID,
  p_target_status TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_current_status TEXT;
  v_created_by UUID;
  v_valid_transition BOOLEAN := false;
BEGIN
  -- 1. Authentication & Workspace Membership
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to update simulation status.';
  END IF;

  IF NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: caller is not a member of workspace %.', p_workspace_id;
  END IF;

  -- 2. Fetch current run status and creator
  SELECT status, created_by INTO v_current_status, v_created_by
  FROM public.simulation_runs
  WHERE id = p_simulation_run_id AND workspace_id = p_workspace_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Simulation run % not found in workspace %.', p_simulation_run_id, p_workspace_id;
  END IF;

  -- Idempotent check
  IF v_current_status = p_target_status THEN
    RETURN jsonb_build_object(
      'success', true,
      'simulation_run_id', p_simulation_run_id,
      'status', p_target_status,
      'idempotent_no_op', true
    );
  END IF;

  -- 3. Transition validations
  IF v_current_status = 'draft' AND p_target_status IN ('queued', 'cancelled') THEN
    v_valid_transition := true;
  ELSIF v_current_status = 'queued' AND p_target_status IN ('running', 'cancelled', 'blocked') THEN
    v_valid_transition := true;
  ELSIF v_current_status = 'running' AND p_target_status IN ('completed', 'failed', 'cancelled') THEN
    v_valid_transition := true;
  ELSIF v_current_status = 'blocked' AND p_target_status IN ('queued', 'cancelled') THEN
    v_valid_transition := true;
  END IF;

  -- Cancellation permission check: creator, admin, or owner
  IF p_target_status = 'cancelled' THEN
    IF v_created_by != v_actor_id AND NOT public.is_workspace_admin_or_owner(p_workspace_id) THEN
      RAISE EXCEPTION 'Only the run creator or workspace admin/owner may cancel a simulation run.';
    END IF;
  END IF;

  IF NOT v_valid_transition THEN
    RAISE EXCEPTION 'Illegal status transition from % to % for simulation run %.',
      v_current_status, p_target_status, p_simulation_run_id;
  END IF;

  -- 4. Update status
  UPDATE public.simulation_runs
  SET status = p_target_status,
      completed_at = CASE WHEN p_target_status IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE completed_at END
  WHERE id = p_simulation_run_id AND workspace_id = p_workspace_id;

  RETURN jsonb_build_object(
    'success', true,
    'simulation_run_id', p_simulation_run_id,
    'previous_status', v_current_status,
    'status', p_target_status,
    'idempotent_no_op', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.transition_simulation_run_status_atomic FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_simulation_run_status_atomic TO authenticated;
