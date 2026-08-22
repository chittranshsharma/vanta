/**
 * Client error reporting (Upgrade G). No third-party SDK: an optional
 * operator-configured endpoint (VITE_TELEMETRY_ENDPOINT) receives
 * structured, scrubbed events. Without it, events go to the console only.
 * Never sends tokens, emails, or free text from user content.
 */

export interface ClientErrorEvent {
  kind: "client_error";
  correlation_id: string;
  message: string;
  name: string;
  stack_head: string | null;
  route: string;
  app_version: string;
  at: string;
}

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const JWT = /eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/g;
const BEARER = /bearer\s+[\w.-]+/gi;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Removes credentials and direct identifiers. UUIDs are kept (workspace/correlation ids are not PII). */
export function scrub(text: string): string {
  return text.replace(JWT, "[jwt]").replace(BEARER, "bearer [redacted]").replace(EMAIL, "[email]");
}

export function buildClientErrorEvent(err: unknown, correlationId: string, route: string, appVersion: string, now = new Date()): ClientErrorEvent {
  const e = err instanceof Error ? err : new Error(String(err));
  const stack = e.stack ? scrub(e.stack).split("\n").slice(0, 5).join("\n") : null;
  return {
    kind: "client_error",
    correlation_id: correlationId,
    message: scrub(e.message).slice(0, 500),
    name: e.name,
    stack_head: stack,
    route: route.replace(UUID, "[id]"),
    app_version: appVersion,
    at: now.toISOString(),
  };
}

export async function reportClientError(event: ClientErrorEvent, endpoint: string | undefined = import.meta.env.VITE_TELEMETRY_ENDPOINT, fetchImpl: typeof fetch = fetch): Promise<void> {
  console.error(JSON.stringify(event));
  if (!endpoint) return;
  try {
    await fetchImpl(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(event), keepalive: true });
  } catch {
    // Telemetry must never affect the user.
  }
}
