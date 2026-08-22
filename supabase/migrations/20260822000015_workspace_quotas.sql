-- ============================================================
-- Vanta: per-workspace quotas (Upgrade G, operational safety)
-- Migration: 20260822000015_workspace_quotas.sql
-- Status: PENDING LIVE APPLY (authored 2026-08-23)
-- Depends on: 001.
--
-- Replaces the best-effort audit-count limiter with an atomic daily counter
-- per workspace and kind. consume_quota is the only write path; it is
-- SECURITY DEFINER, requires a non-null auth.uid() that is a member of the
-- workspace, and fails closed (returns allowed = false) when the limit is hit.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.workspace_quotas (
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('model_call', 'job_enqueue', 'media_probe', 'feed_refresh')),
  daily_limit INT NOT NULL CHECK (daily_limit >= 0),
  used_today INT NOT NULL DEFAULT 0 CHECK (used_today >= 0),
  window_date DATE NOT NULL DEFAULT CURRENT_DATE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (workspace_id, kind)
);

ALTER TABLE public.workspace_quotas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "workspace_quotas_select" ON public.workspace_quotas;
DROP POLICY IF EXISTS "workspace_quotas_no_insert" ON public.workspace_quotas;
DROP POLICY IF EXISTS "workspace_quotas_no_update" ON public.workspace_quotas;
DROP POLICY IF EXISTS "workspace_quotas_no_delete" ON public.workspace_quotas;

CREATE POLICY "workspace_quotas_select" ON public.workspace_quotas FOR SELECT
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "workspace_quotas_no_insert" ON public.workspace_quotas FOR INSERT WITH CHECK (false);
CREATE POLICY "workspace_quotas_no_update" ON public.workspace_quotas FOR UPDATE USING (false);
CREATE POLICY "workspace_quotas_no_delete" ON public.workspace_quotas FOR DELETE USING (false);

-- Defaults applied lazily on first consume. Operators change limits with service_role.
CREATE OR REPLACE FUNCTION public.default_quota(p_kind TEXT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_kind
    WHEN 'model_call' THEN 50
    WHEN 'job_enqueue' THEN 200
    WHEN 'media_probe' THEN 50
    WHEN 'feed_refresh' THEN 24
    ELSE 0 END;
$$;

-- Atomic consume. Resets the counter when the window date rolls over.
CREATE OR REPLACE FUNCTION public.consume_quota(p_workspace_id UUID, p_kind TEXT)
RETURNS TABLE (allowed BOOLEAN, used INT, daily_limit INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_row public.workspace_quotas;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_workspace_member(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: not a workspace member';
  END IF;

  INSERT INTO public.workspace_quotas (workspace_id, kind, daily_limit)
  VALUES (p_workspace_id, p_kind, public.default_quota(p_kind))
  ON CONFLICT (workspace_id, kind) DO NOTHING;

  SELECT * INTO v_row FROM public.workspace_quotas
  WHERE workspace_id = p_workspace_id AND kind = p_kind
  FOR UPDATE;

  IF v_row.window_date < CURRENT_DATE THEN
    v_row.used_today := 0;
    v_row.window_date := CURRENT_DATE;
  END IF;

  IF v_row.used_today >= v_row.daily_limit THEN
    UPDATE public.workspace_quotas SET window_date = v_row.window_date, used_today = v_row.used_today, updated_at = NOW()
    WHERE workspace_id = p_workspace_id AND kind = p_kind;
    RETURN QUERY SELECT false, v_row.used_today, v_row.daily_limit;
    RETURN;
  END IF;

  UPDATE public.workspace_quotas
  SET used_today = v_row.used_today + 1, window_date = v_row.window_date, updated_at = NOW()
  WHERE workspace_id = p_workspace_id AND kind = p_kind;

  RETURN QUERY SELECT true, v_row.used_today + 1, v_row.daily_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_quota(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.consume_quota(UUID, TEXT) TO authenticated, service_role;

-- Data-access audit helper for operators: who read or changed what, by day (service_role only).
CREATE OR REPLACE FUNCTION public.audit_summary(p_workspace_id UUID, p_days INT)
RETURNS TABLE (day DATE, action TEXT, actor UUID, events BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT created_at::date AS day, action, user_id AS actor, count(*) AS events
  FROM public.audit_events
  WHERE workspace_id = p_workspace_id AND created_at >= NOW() - make_interval(days => GREATEST(p_days, 1))
  GROUP BY 1, 2, 3
  ORDER BY 1 DESC, 4 DESC;
$$;

REVOKE ALL ON FUNCTION public.audit_summary(UUID, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_summary(UUID, INT) TO service_role;
