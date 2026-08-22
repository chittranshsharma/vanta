-- Vanta Auth & Workspace Tenant Isolation Migration
-- Version: 20260822000001_auth_workspaces.sql

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Workspaces Table (Tenant Boundary)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Workspace Members Table
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, user_id)
);

-- 4. Audit Events Table (Append-only)
CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast query performance
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_workspace_id ON public.audit_events(workspace_id);

-- Helper security functions
CREATE OR REPLACE FUNCTION public.is_workspace_member(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin_or_owner(ws_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid() AND role IN ('owner', 'admin')
  );
$$;

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can read their own profile or fellow workspace members"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.workspace_members m1
      JOIN public.workspace_members m2 ON m1.workspace_id = m2.workspace_id
      WHERE m1.user_id = auth.uid() AND m2.user_id = public.profiles.id
    )
  );

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Workspaces Policies
CREATE POLICY "Members can view workspaces they belong to"
  ON public.workspaces FOR SELECT
  USING (public.is_workspace_member(id));

CREATE POLICY "Authenticated users can create workspaces"
  ON public.workspaces FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and owners can update workspaces"
  ON public.workspaces FOR UPDATE
  USING (public.is_workspace_admin_or_owner(id))
  WITH CHECK (public.is_workspace_admin_or_owner(id));

CREATE POLICY "Owners can delete workspaces"
  ON public.workspaces FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = public.workspaces.id AND user_id = auth.uid() AND role = 'owner'
    )
  );

-- Workspace Members Policies
CREATE POLICY "Members can view other members in the same workspace"
  ON public.workspace_members FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Owners and admins can add members, or creator adding self as owner"
  ON public.workspace_members FOR INSERT
  WITH CHECK (
    public.is_workspace_admin_or_owner(workspace_id)
    OR (
      user_id = auth.uid() AND role = 'owner' AND EXISTS (
        SELECT 1 FROM public.workspaces WHERE id = workspace_id AND created_by = auth.uid()
      )
    )
  );

CREATE POLICY "Owners and admins can update member roles"
  ON public.workspace_members FOR UPDATE
  USING (public.is_workspace_admin_or_owner(workspace_id))
  WITH CHECK (public.is_workspace_admin_or_owner(workspace_id));

CREATE POLICY "Owners can remove members, or members can leave"
  ON public.workspace_members FOR DELETE
  USING (
    public.is_workspace_admin_or_owner(workspace_id)
    OR user_id = auth.uid()
  );

-- Audit Events Policies (Append-only)
CREATE POLICY "Members can view audit events for their workspace"
  ON public.audit_events FOR SELECT
  USING (public.is_workspace_member(workspace_id));

CREATE POLICY "Members can insert audit events for their workspace"
  ON public.audit_events FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND (workspace_id IS NULL OR public.is_workspace_member(workspace_id))
  );

-- Trigger: Handle new user signups automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_ws_id UUID;
  user_full_name TEXT;
  ws_name TEXT;
  ws_slug TEXT;
BEGIN
  user_full_name := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1), 'Creator');
  ws_name := user_full_name || '''s Workspace';
  ws_slug := lower(regexp_replace(user_full_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(new.id::text, 1, 8);

  -- 1. Create Profile
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    user_full_name,
    new.raw_user_meta_data->>'avatar_url'
  );

  -- 2. Create Default Workspace
  INSERT INTO public.workspaces (name, slug, created_by)
  VALUES (ws_name, ws_slug, new.id)
  RETURNING id INTO new_ws_id;

  -- 3. Add user as owner of default workspace
  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_ws_id, new.id, 'owner');

  -- 4. Record Audit Event
  INSERT INTO public.audit_events (workspace_id, user_id, action, resource_type, resource_id, metadata)
  VALUES (
    new_ws_id,
    new.id,
    'workspace.created',
    'workspace',
    new_ws_id::text,
    jsonb_build_object('name', ws_name, 'auto_generated', true)
  );

  RETURN new;
END;
$$;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
