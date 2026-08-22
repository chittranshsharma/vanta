-- ============================================================
-- Vanta: experiments and observed outcomes (calibration foundation)
-- Migration: 20260822000016_experiments.sql
-- Status: PENDING LIVE APPLY (authored 2026-08-23)
-- Depends on: 007 through 015 applied.
--
-- An experiment records a hypothesis, the variants under test, the metric
-- it is read against, and where outcomes will come from. Outcome rows are
-- append-only, always carry a source, and are always evidence_class
-- 'observed' by CHECK: an unsourced number cannot be inserted.
-- No reading, winner, or score is stored anywhere in this schema.
--
-- Outcome rows additionally record the citability of their source at import
-- time and whether the source file's dates were ambiguous, so a reading can
-- never silently upgrade unverified input into a verified measurement.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  hypothesis TEXT NOT NULL CHECK (char_length(hypothesis) >= 20),
  primary_metric_key TEXT NOT NULL,
  variant_twin_ids UUID[] NOT NULL DEFAULT '{}',
  min_observations_per_variant INT NOT NULL DEFAULT 30 CHECK (min_observations_per_variant >= 1),
  outcome_source TEXT NOT NULL DEFAULT 'none' CHECK (outcome_source IN ('connector', 'csv_import', 'none')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'running', 'awaiting_outcomes', 'concluded', 'abandoned')),
  started_at TIMESTAMPTZ,
  concluded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_experiments_workspace ON public.experiments(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.experiment_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  experiment_id UUID NOT NULL,
  FOREIGN KEY (experiment_id, workspace_id)
    REFERENCES public.experiments(id, workspace_id)
    ON DELETE CASCADE,
  variant_twin_id UUID NOT NULL,
  FOREIGN KEY (variant_twin_id, workspace_id)
    REFERENCES public.creative_twins(id, workspace_id)
    ON DELETE CASCADE,
  source_id UUID NOT NULL,
  FOREIGN KEY (source_id, workspace_id)
    REFERENCES public.source_registry(id, workspace_id)
    ON DELETE RESTRICT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metric_key TEXT NOT NULL,
  value NUMERIC NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  evidence_class TEXT NOT NULL DEFAULT 'observed' CHECK (evidence_class = 'observed'),
  -- Citability of the source at the moment of import. A row imported from an
  -- unverified source stays visibly unverified forever; it is observed from
  -- that source, which is not the same as a verified measurement.
  source_citability TEXT NOT NULL
    CHECK (source_citability IN ('verified', 'citable_stale', 'citable_unverified')),
  -- True when the file's date format was ambiguous and could not be resolved.
  date_ambiguous BOOLEAN NOT NULL DEFAULT false,
  import_note TEXT,
  import_batch_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_experiment_outcomes_experiment ON public.experiment_outcomes(experiment_id, workspace_id, variant_twin_id);

ALTER TABLE public.experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experiment_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "experiments_select" ON public.experiments;
DROP POLICY IF EXISTS "experiments_insert" ON public.experiments;
DROP POLICY IF EXISTS "experiments_update" ON public.experiments;
DROP POLICY IF EXISTS "experiments_delete" ON public.experiments;

CREATE POLICY "experiments_select" ON public.experiments FOR SELECT
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "experiments_insert" ON public.experiments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());
CREATE POLICY "experiments_update" ON public.experiments FOR UPDATE
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));
CREATE POLICY "experiments_delete" ON public.experiments FOR DELETE
  USING (public.is_workspace_admin_or_owner(workspace_id));

DROP POLICY IF EXISTS "experiment_outcomes_select" ON public.experiment_outcomes;
DROP POLICY IF EXISTS "experiment_outcomes_insert" ON public.experiment_outcomes;
DROP POLICY IF EXISTS "experiment_outcomes_no_update" ON public.experiment_outcomes;
DROP POLICY IF EXISTS "experiment_outcomes_no_delete" ON public.experiment_outcomes;

CREATE POLICY "experiment_outcomes_select" ON public.experiment_outcomes FOR SELECT
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "experiment_outcomes_insert" ON public.experiment_outcomes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());
CREATE POLICY "experiment_outcomes_no_update" ON public.experiment_outcomes FOR UPDATE
  USING (false);
CREATE POLICY "experiment_outcomes_no_delete" ON public.experiment_outcomes FOR DELETE
  USING (false);

-- Status transitions are enforced here so no client can jump to 'concluded'.
CREATE OR REPLACE FUNCTION public.guard_experiment_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = OLD.status THEN
    NEW.updated_at := NOW();
    RETURN NEW;
  END IF;
  IF NOT (
    (OLD.status = 'draft' AND NEW.status IN ('ready', 'abandoned')) OR
    (OLD.status = 'ready' AND NEW.status IN ('running', 'draft', 'abandoned')) OR
    (OLD.status = 'running' AND NEW.status IN ('awaiting_outcomes', 'abandoned')) OR
    (OLD.status = 'awaiting_outcomes' AND NEW.status IN ('concluded', 'abandoned'))
  ) THEN
    RAISE EXCEPTION 'Invalid experiment transition % -> %', OLD.status, NEW.status;
  END IF;
  IF NEW.status = 'running' AND NEW.started_at IS NULL THEN NEW.started_at := NOW(); END IF;
  IF NEW.status = 'concluded' THEN NEW.concluded_at := NOW(); END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_experiment_transition() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_guard_experiment_transition ON public.experiments;
CREATE TRIGGER trg_guard_experiment_transition
BEFORE UPDATE ON public.experiments
FOR EACH ROW
EXECUTE FUNCTION public.guard_experiment_transition();

CREATE OR REPLACE FUNCTION public.block_experiment_outcome_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'experiment_outcomes is append-only; UPDATE and DELETE are prohibited.';
END;
$$;

REVOKE ALL ON FUNCTION public.block_experiment_outcome_mutation() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_block_experiment_outcome_mutation ON public.experiment_outcomes;
CREATE TRIGGER trg_block_experiment_outcome_mutation
BEFORE UPDATE OR DELETE ON public.experiment_outcomes
FOR EACH ROW
EXECUTE FUNCTION public.block_experiment_outcome_mutation();
