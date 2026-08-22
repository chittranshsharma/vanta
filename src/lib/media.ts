import { isSupabaseConfigured, supabase } from "./supabase";
import { verifyDeclaredType, type IntakeCategory, type TypeVerification } from "../../shared/media/magicBytes";

/**
 * Media pipeline client helpers (Upgrade D).
 *
 * - Magic-byte verification runs in the browser before any upload (and again
 *   in the worker before any processing); declared MIME is never trusted.
 * - Signed download URLs are short-lived and scoped by Storage RLS to the
 *   caller's workspace prefix.
 * - Video intake stays disabled until the media worker is deployed; the
 *   flag is build-time so it cannot be toggled from the client at runtime.
 */

export const VIDEO_INTAKE_ENABLED = false;
export const SIGNED_URL_TTL_SECONDS = 300;
export const WORKSPACE_ASSETS_BUCKET = "workspace-assets";

export async function verifyFileBytes(file: Blob, declaredCategory: IntakeCategory): Promise<TypeVerification> {
  const head = await file.slice(0, 8192).arrayBuffer();
  return verifyDeclaredType(new Uint8Array(head), declaredCategory);
}

export async function createSignedDownloadUrl(
  storagePath: string,
  workspaceId: string
): Promise<{ url: string | null; error: string | null }> {
  if (!isSupabaseConfigured) return { url: null, error: "Supabase is not configured." };
  if (!storagePath.startsWith(`${workspaceId}/`)) return { url: null, error: "Storage path is outside the workspace." };
  const { data, error } = await supabase.storage.from(WORKSPACE_ASSETS_BUCKET).createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return { url: null, error: error?.message ?? "Could not sign URL." };
  return { url: data.signedUrl, error: null };
}

/** Retention default for derived artifacts: 90 days, expressed as an ISO timestamp for the row. */
export function defaultRetentionUntil(now: Date = new Date()): string {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() + 90);
  return d.toISOString();
}
