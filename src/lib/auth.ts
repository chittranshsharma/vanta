import { supabase, isSupabaseConfigured } from "./supabase";
import type { Database } from "../types/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
export type WorkspaceMember = Database["public"]["Tables"]["workspace_members"]["Row"];

export type WorkspaceWithRole = Workspace & {
  role: "owner" | "admin" | "member" | "viewer";
};

export async function signUpWithEmail(
  email: string,
  password: string,
  fullName: string
): Promise<{ error: Error | null; user: any | null }> {
  if (!isSupabaseConfigured) {
    return { error: new Error("Supabase is not configured with valid credentials."), user: null };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName
      }
    }
  });

  return { error, user: data.user };
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<{ error: Error | null; user: any | null; session: any | null }> {
  if (!isSupabaseConfigured) {
    return { error: new Error("Supabase is not configured with valid credentials."), user: null, session: null };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  return { error, user: data.user, session: data.session };
}

export async function signOutUser(): Promise<{ error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { error: null };
  }
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function fetchUserProfile(userId: string): Promise<Profile | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching user profile:", error);
    return null;
  }
  return data;
}

export async function fetchUserWorkspaces(userId: string): Promise<WorkspaceWithRole[]> {
  if (!isSupabaseConfigured) return [];

  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces(*)")
    .eq("user_id", userId);

  if (error || !data) {
    console.error("Error fetching user workspaces:", error);
    return [];
  }

  return data
    .filter((item) => item.workspaces !== null)
    .map((item) => ({
      ...(item.workspaces as unknown as Workspace),
      role: item.role as WorkspaceWithRole["role"]
    }));
}

export async function createNewWorkspace(
  name: string,
  userId: string
): Promise<{ workspace: Workspace | null; error: Error | null }> {
  if (!isSupabaseConfigured) {
    return { workspace: null, error: new Error("Supabase is not configured.") };
  }

  const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Math.random().toString(36).substring(2, 8)}`;

  const { data: ws, error: wsError } = await supabase
    .from("workspaces")
    .insert({
      name,
      slug,
      created_by: userId
    })
    .select()
    .single();

  if (wsError || !ws) {
    return { workspace: null, error: wsError };
  }

  // Add user as owner
  const { error: memberError } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: ws.id,
      user_id: userId,
      role: "owner"
    });

  if (memberError) {
    console.error("Error adding workspace owner member:", memberError);
  }

  // Add audit event
  await supabase.from("audit_events").insert({
    workspace_id: ws.id,
    user_id: userId,
    action: "workspace.created",
    resource_type: "workspace",
    resource_id: ws.id,
    metadata: { name, slug }
  });

  return { workspace: ws, error: null };
}
