-- ============================================================
-- Vanta: model task run records (Upgrade A, Ticket 5.1 persistence)
-- Migration: 20260822000010_model_task_runs.sql
-- Status: PENDING LIVE APPLY (authored 2026-08-23)
-- Depends on: 007, 008, 009 applied.
--
-- One row per gateway task execution. Append-only: the row is the audit
-- trail for a model inference. Output is stored only after server-side
-- validation passed; rejected outputs store validation_errors and no output.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.model_task_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  twin_id UUID,
  FOREIGN KEY (twin_id, workspace_id)
    REFERENCES public.creative_twins(id, workspace_id)
    ON DELETE SET NULL (twin_id),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('gateway_health_check', 'claim_grounding_audit')),
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('passed', 'validation_failed', 'malformed_json', 'upstream_error')),
  attempts INT NOT NULL DEFAULT 1 CHECK (attempts BETWEEN 1 AND 3),
  repaired BOOLEAN NOT NULL DEFAULT false,
  evidence_class TEXT NOT NULL DEFAULT 'inference'
    CHECK (evidence_class IN ('observed', 'sourced_claim', 'inference', 'simulation', 'unknown')),
  input_claim_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  output JSONB,
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  prompt_tokens INT,
  completion_tokens INT,
  latency_ms INT,
  correlation_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Validated output and errors are mutually exclusive
  CHECK ((status = 'passed' AND output IS NOT NULL) OR (status <> 'passed' AND output IS NULL)),
  UNIQUE (id, workspace_id)
);

CREATE INDEX IF NOT EXISTS idx_model_task_runs_workspace_id ON public.model_task_runs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_model_task_runs_twin ON public.model_task_runs(twin_id, workspace_id);
CREATE INDEX IF NOT EXISTS idx_model_task_runs_created_at ON public.model_task_runs(workspace_id, created_at DESC);

ALTER TABLE public.model_task_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "model_task_runs_select" ON public.model_task_runs;
DROP POLICY IF EXISTS "model_task_runs_insert" ON public.model_task_runs;
DROP POLICY IF EXISTS "model_task_runs_no_update" ON public.model_task_runs;
DROP POLICY IF EXISTS "model_task_runs_no_delete" ON public.model_task_runs;

CREATE POLICY "model_task_runs_select" ON public.model_task_runs FOR SELECT
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "model_task_runs_insert" ON public.model_task_runs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND public.is_workspace_member(workspace_id) AND created_by = auth.uid());
CREATE POLICY "model_task_runs_no_update" ON public.model_task_runs FOR UPDATE
  USING (false);
CREATE POLICY "model_task_runs_no_delete" ON public.model_task_runs FOR DELETE
  USING (false);

-- Immutability at trigger level as well, matching creative_twin_versions.
CREATE OR REPLACE FUNCTION public.block_model_task_run_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'model_task_runs is append-only; UPDATE and DELETE are prohibited.';
END;
$$;

DROP TRIGGER IF EXISTS trg_block_model_task_run_mutation ON public.model_task_runs;
CREATE TRIGGER trg_block_model_task_run_mutation
BEFORE UPDATE OR DELETE ON public.model_task_runs
FOR EACH ROW
EXECUTE FUNCTION public.block_model_task_run_mutation();
