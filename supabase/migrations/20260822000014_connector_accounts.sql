-- ============================================================
-- Vanta: official connector accounts (Upgrade F)
-- Migration: 20260822000014_connector_accounts.sql
-- Status: PENDING LIVE APPLY (authored 2026-08-23)
-- Depends on: 011 applied (jobs).
--
-- Rules from the roadmap:
--   * Only user-authorized official APIs, account exports, and permitted
--     public feeds. Consent is explicit and recorded (who, when, scopes).
--   * OAuth refresh tokens are encrypted and access-scoped. Ciphertext lives
--     in the base table, which browser roles cannot SELECT at all. Members
--     read a view that exposes no secret columns.
--   * Connecting, refreshing, and revoking run through the secure backend,
--     never the browser. Members only request and revoke via RPC.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.connector_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  provider TEXT NOT NULL CHECK (provider IN ('meta', 'google', 'youtube', 'tiktok', 'linkedin', 'x', 'rss')),
  external_account_id TEXT,
  display_name TEXT,
  requested_scopes TEXT[] NOT NULL DEFAULT '{}',
  granted_scopes TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending_consent'
    CHECK (status IN ('pending_consent', 'connected', 'revoked', 'error')),
  consent_granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  consent_granted_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  -- Secrets: AES-256-GCM ciphertext produced by the backend with a key the database never sees.
  access_token_ciphertext BYTEA,
  refresh_token_ciphertext BYTEA,
  token_key_id TEXT,
  token_expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  last_error JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, workspace_id),
  CHECK (status <> 'connected' OR (consent_granted_by IS NOT NULL AND consent_granted_at IS NOT NULL)),
  CHECK ((access_token_ciphertext IS NULL AND refresh_token_ciphertext IS NULL) OR token_key_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_connector_accounts_workspace ON public.connector_accounts(workspace_id, provider);

ALTER TABLE public.connector_accounts ENABLE ROW LEVEL SECURITY;

-- No browser role may read the base table (ciphertext lives here). Policies exist for
-- completeness but REVOKE makes them moot for anon/authenticated.
DROP POLICY IF EXISTS "connector_accounts_select" ON public.connector_accounts;
DROP POLICY IF EXISTS "connector_accounts_no_insert" ON public.connector_accounts;
DROP POLICY IF EXISTS "connector_accounts_no_update" ON public.connector_accounts;
DROP POLICY IF EXISTS "connector_accounts_no_delete" ON public.connector_accounts;

CREATE POLICY "connector_accounts_select" ON public.connector_accounts FOR SELECT
  USING (public.is_workspace_member(workspace_id));
CREATE POLICY "connector_accounts_no_insert" ON public.connector_accounts FOR INSERT
  WITH CHECK (false);
CREATE POLICY "connector_accounts_no_update" ON public.connector_accounts FOR UPDATE
  USING (false);
CREATE POLICY "connector_accounts_no_delete" ON public.connector_accounts FOR DELETE
  USING (false);

REVOKE ALL ON TABLE public.connector_accounts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.connector_accounts TO service_role;

-- Member-facing view: every column except secrets. security_invoker keeps RLS semantics
-- of the base table for the view's reads (PostgreSQL 15+).
CREATE OR REPLACE VIEW public.connector_accounts_public
WITH (security_invoker = true) AS
  SELECT id, workspace_id, created_by, provider, external_account_id, display_name,
         requested_scopes, granted_scopes, status, consent_granted_by, consent_granted_at,
         revoked_by, revoked_at, token_expires_at, last_sync_at, last_error, created_at, updated_at
  FROM public.connector_accounts;

-- The view is security_invoker, so the caller needs SELECT on the base table for RLS
-- evaluation. Grant column-level SELECT on non-secret columns only.
GRANT SELECT (id, workspace_id, created_by, provider, external_account_id, display_name,
              requested_scopes, granted_scopes, status, consent_granted_by, consent_granted_at,
              revoked_by, revoked_at, token_expires_at, last_sync_at, last_error, created_at, updated_at)
  ON public.connector_accounts TO authenticated;
GRANT SELECT ON public.connector_accounts_public TO authenticated, service_role;

-- Member RPC: request a connection. Creates the pending row; the OAuth dance itself
-- happens in the backend, which later sets status = connected with consent fields.
CREATE OR REPLACE FUNCTION public.request_connector(p_workspace_id UUID, p_provider TEXT, p_scopes TEXT[])
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_id UUID;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_workspace_admin_or_owner(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: connecting an account requires workspace admin or owner';
  END IF;

  INSERT INTO public.connector_accounts (workspace_id, created_by, provider, requested_scopes, status)
  VALUES (p_workspace_id, v_actor_id, p_provider, COALESCE(p_scopes, '{}'), 'pending_consent')
  RETURNING id INTO v_id;

  INSERT INTO public.audit_events (workspace_id, user_id, action, resource_type, resource_id, metadata)
  VALUES (p_workspace_id, v_actor_id, 'connector.requested', 'connector_account', v_id::text,
          jsonb_build_object('provider', p_provider, 'scopes', COALESCE(p_scopes, '{}')));
  RETURN v_id;
END;
$$;

-- Member RPC: revoke. Clears ciphertext immediately; the backend later revokes upstream.
CREATE OR REPLACE FUNCTION public.revoke_connector(p_connector_id UUID, p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id UUID;
  v_rows INT;
BEGIN
  v_actor_id := auth.uid();
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT public.is_workspace_admin_or_owner(p_workspace_id) THEN
    RAISE EXCEPTION 'Access denied: revoking requires workspace admin or owner';
  END IF;

  UPDATE public.connector_accounts
  SET status = 'revoked',
      revoked_by = v_actor_id,
      revoked_at = NOW(),
      access_token_ciphertext = NULL,
      refresh_token_ciphertext = NULL,
      token_key_id = NULL,
      updated_at = NOW()
  WHERE id = p_connector_id AND workspace_id = p_workspace_id AND status <> 'revoked';
  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    INSERT INTO public.audit_events (workspace_id, user_id, action, resource_type, resource_id, metadata)
    VALUES (p_workspace_id, v_actor_id, 'connector.revoked', 'connector_account', p_connector_id::text, '{}'::jsonb);
  END IF;
  RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.request_connector(UUID, TEXT, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_connector(UUID, TEXT, TEXT[]) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.revoke_connector(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_connector(UUID, UUID) TO authenticated, service_role;
