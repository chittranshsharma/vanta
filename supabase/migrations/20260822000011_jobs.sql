-- ============================================================
-- Vanta: durable job records (Upgrade C, step 1: database-backed queue)
-- Migration: 20260822000011_jobs.sql
-- Status: PENDING LIVE APPLY (authored 2026-08-23)
-- Depends on: 007-010 applied.
--
-- Properties required by the roadmap: idempotency keys, retriable jobs,
-- dead-letter state, step audit log, cancellation, concurrency limits
-- (per-worker claim with SKIP LOCKED), and a human-approval gate
-- (requires_approval / approved_by).
--
-- Who does what:
--   members      insert (enqueue) and read jobs in their workspace; cancel queued jobs via RPC
--   workers      service_role only; claim / complete / fail via RPCs. Never the browser.
--   nobody       direct UPDATE or DELETE; all transitions go through RPCs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  job_type TEXT NOT NULL CHECK (job_type IN (
    'model_task',
    'campaign_csv_normalize',
    'media_probe',
    'source_refresh',
    'embedding_refresh'
  )),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'awaiting_approval', 'queued', 'running', 'succeeded', 'failed', 'dead', 'cancelled'
  )),
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  last_error JSONB,
  attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INT NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  run_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  step_log JSONB NOT NULL DEFAULT '[]'::jsonb,
  correlation_id UUID NOT NULL DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  UNIQUE (workspace_id, idempotency_key),
  UNIQUE (id, workspace_id),
  CHECK (status <> 'succeeded' OR result IS NOT NULL),
  CHECK (status NOT IN ('failed', 'dead') OR last_error IS NOT NULL),
  CHECK ((locked_at IS NULL) = (locked_by IS NULL)),
  -- The approval gate is a property of the job type, not of the caller's choice.
  CHECK (requires_approval = (job_type IN ('source_refresh'))),
  CHECK (status <> 'awaiting_approval' OR requires_approval)
);

CREATE INDEX IF NOT EXISTS idx_jobs_workspace_id ON public.jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_jobs_claimable ON public.jobs(status, run_after) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS idx_jobs_workspace_status ON public.jobs(workspace_id, status, created_at DESC);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs_select" ON public.jobs;
DROP POLICY IF EXISTS "jobs_insert" ON public.jobs;
DROP POLICY IF EXISTS "jobs_no_update" ON public.jobs;
DROP POLICY IF EXISTS "jobs_no_delete" ON public.jobs;

CREATE POLICY "jobs_select" ON public.jobs FOR SELECT
  USING (public.is_workspace_member(workspace_id));
-- Enqueue: members only, actor bound, and only into the two initial states.
CREATE POLICY "jobs_insert" ON public.jobs FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_workspace_member(workspace_id)
    AND created_by = auth.uid()
    AND status IN ('queued', 'awaiting_approval')
    AND attempts = 0
    AND locked_at IS NULL
    AND result IS NULL
  );
CREATE POLICY "jobs_no_update" ON public.jobs FOR UPDATE
  USING (false);
CREATE POLICY "jobs_no_delete" ON public.jobs FOR DELETE
  USING (false);

-- ------------------------------------------------------------
-- Worker RPCs (service_role only). Bypass RLS by SECURITY DEFINER;
-- authorization is the EXECUTE grant, so these are revoked from every
-- browser-facing role.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_next_job(p_worker_id TEXT, p_job_types TEXT[])
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.jobs;
BEGIN
  IF p_worker_id IS NULL OR length(p_worker_id) = 0 THEN
    RAISE EXCEPTION 'worker id required';
  END IF;

  SELECT * INTO v_job
  FROM public.jobs
  WHERE status = 'queued'
    AND run_after <= NOW()
    AND job_type = ANY (p_job_types)
  ORDER BY run_after, created_at
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.jobs
  SET status = 'running',
      attempts = attempts + 1,
      locked_at = NOW(),
      locked_by = p_worker_id,
      updated_at = NOW(),
      step_log = step_log || jsonb_build_object('at', NOW(), 'event', 'claimed', 'worker', p_worker_id, 'attempt', attempts + 1)
  WHERE id = v_job.id
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_job(p_job_id UUID, p_worker_id TEXT, p_result JSONB)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.jobs;
BEGIN
  UPDATE public.jobs
  SET status = 'succeeded',
      result = COALESCE(p_result, '{}'::jsonb),
      locked_at = NULL,
      locked_by = NULL,
      finished_at = NOW(),
      updated_at = NOW(),
      step_log = step_log || jsonb_build_object('at', NOW(), 'event', 'succeeded', 'worker', p_worker_id)
  WHERE id = p_job_id AND status = 'running' AND locked_by = p_worker_id
  RETURNING * INTO v_job;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'job % is not running under worker %', p_job_id, p_worker_id;
  END IF;
  RETURN v_job;
END;
$$;

-- Fails the current attempt. Requeues with the supplied delay until max_attempts,
-- then moves the job to the dead-letter state. Non-retriable errors go dead at once.
CREATE OR REPLACE FUNCTION public.fail_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_error JSONB,
  p_retriable BOOLEAN,
  p_retry_delay_seconds INT
)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_job public.jobs;
  v_next_status TEXT;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id AND status = 'running' AND locked_by = p_worker_id FOR UPDATE;
  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'job % is not running under worker %', p_job_id, p_worker_id;
  END IF;

  IF p_retriable AND v_job.attempts < v_job.max_attempts THEN
    v_next_status := 'queued';
  ELSIF p_retriable THEN
    v_next_status := 'dead';
  ELSE
    v_next_status := 'dead';
  END IF;

  UPDATE public.jobs
  SET status = v_next_status,
      last_error = COALESCE(p_error, '{}'::jsonb),
      locked_at = NULL,
      locked_by = NULL,
      run_after = CASE WHEN v_next_status = 'queued' THEN NOW() + make_interval(secs => GREATEST(p_retry_delay_seconds, 1)) ELSE run_after END,
      finished_at = CASE WHEN v_next_status = 'dead' THEN NOW() ELSE NULL END,
      updated_at = NOW(),
      step_log = step_log || jsonb_build_object('at', NOW(), 'event', v_next_status, 'worker', p_worker_id, 'retriable', p_retriable)
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  RETURN v_job;
END;
$$;

-- ------------------------------------------------------------
-- Member RPCs: cancel a queued/awaiting job; approve a gated job.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cancel_job(p_job_id UUID, p_workspace_id UUID)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_job public.jobs;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a workspace member';
  END IF;

  UPDATE public.jobs
  SET status = 'cancelled',
      finished_at = NOW(),
      updated_at = NOW(),
      step_log = step_log || jsonb_build_object('at', NOW(), 'event', 'cancelled', 'by', v_actor_id)
  WHERE id = p_job_id
    AND workspace_id = p_workspace_id
    AND status IN ('queued', 'awaiting_approval')
    AND (created_by = v_actor_id OR public.is_workspace_admin_or_owner(p_workspace_id))
  RETURNING * INTO v_job;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'Job not cancellable: not found, already started, or not yours';
  END IF;
  RETURN v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_job(p_job_id UUID, p_workspace_id UUID)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_job public.jobs;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_workspace_admin_or_owner(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: approval requires workspace admin or owner';
  END IF;

  UPDATE public.jobs
  SET status = 'queued',
      approved_by = v_actor_id,
      approved_at = NOW(),
      updated_at = NOW(),
      step_log = step_log || jsonb_build_object('at', NOW(), 'event', 'approved', 'by', v_actor_id)
  WHERE id = p_job_id
    AND workspace_id = p_workspace_id
    AND status = 'awaiting_approval'
    AND requires_approval
  RETURNING * INTO v_job;

  IF v_job.id IS NULL THEN
    RAISE EXCEPTION 'Job not awaiting approval in this workspace';
  END IF;
  RETURN v_job;
END;
$$;

-- Grants: worker RPCs to service_role only; member RPCs to authenticated only.
REVOKE ALL ON FUNCTION public.claim_next_job(TEXT, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_next_job(TEXT, TEXT[]) TO service_role;

REVOKE ALL ON FUNCTION public.complete_job(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_job(UUID, TEXT, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.fail_job(UUID, TEXT, JSONB, BOOLEAN, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_job(UUID, TEXT, JSONB, BOOLEAN, INT) TO service_role;

REVOKE ALL ON FUNCTION public.cancel_job(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_job(UUID, UUID) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.approve_job(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_job(UUID, UUID) TO authenticated, service_role;

-- Stale lock sweeper: a worker that died mid-run leaves status = running.
-- Called by the worker on startup and periodically; service_role only.
CREATE OR REPLACE FUNCTION public.release_stale_jobs(p_older_than_seconds INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT;
BEGIN
  WITH released AS (
    UPDATE public.jobs
    SET status = CASE WHEN attempts < max_attempts THEN 'queued' ELSE 'dead' END,
        last_error = CASE WHEN attempts < max_attempts THEN last_error ELSE COALESCE(last_error, '{}'::jsonb) || '{"reason":"stale lock"}'::jsonb END,
        locked_at = NULL,
        locked_by = NULL,
        updated_at = NOW(),
        step_log = step_log || jsonb_build_object('at', NOW(), 'event', 'stale_lock_released')
    WHERE status = 'running' AND locked_at < NOW() - make_interval(secs => GREATEST(p_older_than_seconds, 60))
    RETURNING 1
  )
  SELECT count(*) INTO v_count FROM released;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.release_stale_jobs(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_stale_jobs(INT) TO service_role;
