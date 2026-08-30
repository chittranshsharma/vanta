import { createClient } from "@supabase/supabase-js";
import type { Database } from "../types/database.types";

const env =
  typeof import.meta !== "undefined" && import.meta?.env
    ? import.meta.env
    : typeof process !== "undefined"
    ? process.env
    : ({} as Record<string, string | undefined>);

const supabaseUrl = env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith("https://") &&
    supabaseAnonKey.length > 20
);

export const supabase = createClient<Database>(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);
