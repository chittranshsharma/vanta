/**
 * Client feature flags (Upgrade G). Build-time only: values come from
 * VITE_FLAGS at build, so nothing in the browser can flip them at runtime.
 * Server-side behavior is gated separately (ENABLED_TASKS on the gateway);
 * a client flag only decides whether UI is rendered, never whether a task
 * is allowed.
 */

export type ClientFlag = "claim_grounding_panel" | "video_intake" | "jobs_panel" | "connectors_panel";

export const ALL_CLIENT_FLAGS: readonly ClientFlag[] = ["claim_grounding_panel", "video_intake", "jobs_panel", "connectors_panel"] as const;

/** Every flag is off unless named. Unknown names are ignored. */
export function parseFlags(raw: string | undefined | null): Set<ClientFlag> {
  const on = new Set<ClientFlag>();
  if (!raw) return on;
  for (const part of raw.split(",")) {
    const name = part.trim() as ClientFlag;
    if (ALL_CLIENT_FLAGS.includes(name)) on.add(name);
  }
  return on;
}

const ENABLED = parseFlags(import.meta.env.VITE_FLAGS);

export function isFlagOn(flag: ClientFlag): boolean {
  return ENABLED.has(flag);
}
