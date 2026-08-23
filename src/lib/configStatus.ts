/**
 * Configuration status (operational readiness). Pure derivation from
 * build-time values so the workspace can show an honest "what is wired"
 * view. Nothing here proves a live service works; live checks are
 * explicit user actions whose typed result is displayed as observed.
 */

import { ALL_CLIENT_FLAGS, type ClientFlag } from "./flags";

export type ReadinessState = "configured" | "missing" | "disabled" | "unknown";

export interface ReadinessItem {
  id: string;
  label: string;
  state: ReadinessState;
  /** What the state means for the user, in product terms. */
  detail: string;
  /** How the state was established. Static = from build config; live = from an explicit probe. */
  basis: "static" | "live";
}

export interface ConfigInput {
  supabaseConfigured: boolean;
  flagsOn: ReadonlySet<ClientFlag>;
  telemetryEndpoint: string | undefined;
  appVersion: string | undefined;
}

export const FLAG_LABELS: Record<ClientFlag, string> = {
  claim_grounding_panel: "Claim-grounding audit panel",
  video_intake: "Video intake",
  jobs_panel: "Background jobs panel",
  connectors_panel: "Source connectors panel"
};

export function deriveConfigStatus(input: ConfigInput): ReadinessItem[] {
  const items: ReadinessItem[] = [
    {
      id: "supabase",
      label: "Supabase project",
      state: input.supabaseConfigured ? "configured" : "missing",
      detail: input.supabaseConfigured
        ? "URL and publishable key present at build time. Row-level security is declared in the repository migrations; live policy state is not verified from the browser."
        : "VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. Sign-in and every workspace read are disabled.",
      basis: "static"
    },
    {
      id: "gateway",
      label: "Model gateway",
      state: "unknown",
      detail: "Server-owned Edge Function. The browser cannot know whether it is deployed or has a provider key until a health probe runs.",
      basis: "static"
    },
    {
      id: "retrieval",
      label: "Codex retrieval",
      state: "missing",
      detail:
        "Not available in this build. The embedding store exists, and nothing fills or reads it: no embedding provider is chosen, no worker indexes anything, and no brief or answer is grounded by a vector search. Retrieval therefore covers nothing.",
      basis: "static"
    },
    {
      id: "telemetry",
      label: "Client error telemetry",
      state: input.telemetryEndpoint ? "configured" : "disabled",
      detail: input.telemetryEndpoint
        ? "Scrubbed error events are posted to the operator endpoint."
        : "No VITE_TELEMETRY_ENDPOINT. Errors stay in the browser console only.",
      basis: "static"
    },
    {
      id: "version",
      label: "Build version",
      state: input.appVersion ? "configured" : "unknown",
      detail: input.appVersion ? `Running ${input.appVersion}.` : "VITE_APP_VERSION not set; error reports cannot be tied to a build.",
      basis: "static"
    }
  ];
  for (const flag of ALL_CLIENT_FLAGS) {
    const on = input.flagsOn.has(flag);
    items.push({
      id: `flag:${flag}`,
      label: FLAG_LABELS[flag],
      state: on ? "configured" : "disabled",
      detail: on
        ? "Enabled by VITE_FLAGS at build. A client flag only renders UI; server tasks stay gated by ENABLED_TASKS."
        : "Off. Enable by adding the flag name to VITE_FLAGS and rebuilding.",
      basis: "static"
    });
  }
  return items;
}

/** Maps a gateway probe outcome to a readiness item, keeping the typed error visible. */
export function gatewayItemFromProbe(result: { success: true } | { success: false; error: string; message: string }): ReadinessItem {
  if (result.success) {
    return { id: "gateway", label: "Model gateway", state: "configured", detail: "Health probe succeeded: function deployed and provider key present. No model content was requested.", basis: "live" };
  }
  const detailByError: Record<string, string> = {
    gateway_not_configured: "Function reachable but GROQ_API_KEY is not set. Operator action required.",
    function_unavailable: "Function not deployed or not reachable from this origin.",
    not_authenticated: "Sign in to probe the gateway.",
    task_disabled: "Health check task is disabled by ENABLED_TASKS."
  };
  return {
    id: "gateway",
    label: "Model gateway",
    state: result.error === "gateway_not_configured" || result.error === "function_unavailable" ? "missing" : "unknown",
    detail: `${detailByError[result.error] ?? result.message} (error: ${result.error})`,
    basis: "live"
  };
}
