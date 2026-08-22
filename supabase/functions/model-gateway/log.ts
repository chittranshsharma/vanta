/**
 * Structured logging for the gateway (Upgrade G). One JSON object per line,
 * always with the correlation id, never with request bodies, prompts,
 * headers, keys, or model output.
 */

export type LogLevel = "info" | "warn" | "error";

export interface LogFields {
  correlation_id: string;
  task_type?: string;
  workspace_id?: string;
  user_id?: string;
  status?: number;
  error?: string;
  latency_ms?: number;
  model?: string;
  attempts?: number;
  validation_status?: string;
}

const FORBIDDEN_KEYS = new Set(["prompt", "messages", "content", "authorization", "apikey", "api_key", "token", "body", "output"]);

// eslint-disable-next-line no-console -- structured JSON log lines are the intended stdout output of the function
export function logEvent(level: LogLevel, msg: string, fields: LogFields, sink: (line: string) => void = level === "error" ? console.error : console.log): void {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (FORBIDDEN_KEYS.has(k.toLowerCase())) continue;
    safe[k] = v;
  }
  sink(JSON.stringify({ ts: new Date().toISOString(), level, service: "model-gateway", msg, ...safe }));
}
