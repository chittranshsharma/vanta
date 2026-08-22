/**
 * Pure request and audit guards for the model gateway.
 *
 * Everything here is side-effect free so it can be unit tested outside Deno.
 * index.ts composes these with the Supabase client and the provider call.
 */

import { ALLOWLISTED_TASKS, type TaskType } from "./schemas.ts";

export const MAX_BODY_BYTES = 8192;
export const HEALTH_CHECK_HOURLY_LIMIT = 10;
export const AUDIT_RESOURCE_TYPE = "model_gateway";
export const AUDIT_ACTION = "model_gateway.invocation";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type RequestValidation =
  | { ok: true; workspaceId: string; taskType: TaskType; twinId: string | null }
  | { ok: false; error: string; message: string };

/** Extra fields each task may carry. Anything else is rejected. */
const TASK_EXTRA_FIELDS: Record<TaskType, readonly string[]> = {
  gateway_health_check: [],
  claim_grounding_audit: ["twin_id"],
};

/**
 * Validates the raw request body text. Checks byte size before parsing so a
 * client-supplied Content-Length header is never trusted.
 */
export function validateRequestBody(rawText: string): RequestValidation {
  const bytes = new TextEncoder().encode(rawText).byteLength;
  if (bytes > MAX_BODY_BYTES) {
    return {
      ok: false,
      error: "payload_too_large",
      message: `Request body exceeds maximum allowed size (${MAX_BODY_BYTES} bytes).`,
    };
  }

  let body: unknown;
  try {
    body = JSON.parse(rawText);
  } catch {
    return { ok: false, error: "invalid_json", message: "Request body must be valid JSON." };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "invalid_request", message: "Request body must be a JSON object." };
  }

  const obj = body as Record<string, unknown>;
  const taskTypeRaw = obj.task_type;
  const taskExtras =
    typeof taskTypeRaw === "string" && ALLOWLISTED_TASKS.includes(taskTypeRaw as TaskType)
      ? TASK_EXTRA_FIELDS[taskTypeRaw as TaskType]
      : [];
  const allowedKeys = new Set(["workspace_id", "task_type", ...taskExtras]);
  const disallowed = Object.keys(obj).filter((k) => !allowedKeys.has(k));
  if (disallowed.length > 0) {
    return {
      ok: false,
      error: "invalid_request",
      message: `Disallowed fields in request body: ${disallowed.join(", ")}. Client-supplied prompts, models, schemas, or arbitrary keys are strictly forbidden.`,
    };
  }

  const workspaceId = obj.workspace_id;
  if (typeof workspaceId !== "string" || !UUID_REGEX.test(workspaceId)) {
    return {
      ok: false,
      error: "missing_workspace_id",
      message: "A valid workspace_id UUID string is required.",
    };
  }

  const taskType = obj.task_type;
  if (typeof taskType !== "string" || !ALLOWLISTED_TASKS.includes(taskType as TaskType)) {
    return {
      ok: false,
      error: "invalid_task_type",
      message: `Task type "${String(taskType)}" is not allowlisted. Supported tasks: ${ALLOWLISTED_TASKS.join(", ")}.`,
    };
  }

  let twinId: string | null = null;
  if (taskType === "claim_grounding_audit") {
    const raw = obj.twin_id;
    if (typeof raw !== "string" || !UUID_REGEX.test(raw)) {
      return { ok: false, error: "missing_twin_id", message: "claim_grounding_audit requires a valid twin_id UUID." };
    }
    twinId = raw;
  }

  return { ok: true, workspaceId, taskType: taskType as TaskType, twinId };
}

export type RateLimitDecision =
  | { allow: true }
  | { allow: false; error: "rate_limited" | "rate_limit_unavailable"; status: 429 | 503; message: string };

/**
 * Best-effort limiter over audit_events counts. Fails closed: if the count
 * could not be read, the request is refused rather than allowed through.
 */
export function evaluateRateLimit(input: {
  count: number | null;
  countError: unknown;
  limit?: number;
}): RateLimitDecision {
  const limit = input.limit ?? HEALTH_CHECK_HOURLY_LIMIT;
  if (input.countError || input.count === null || input.count === undefined) {
    return {
      allow: false,
      error: "rate_limit_unavailable",
      status: 503,
      message: "Rate limit state could not be read; request refused (fail-closed).",
    };
  }
  if (input.count >= limit) {
    return {
      allow: false,
      error: "rate_limited",
      status: 429,
      message: `Workspace health probe quota reached (${limit} invocations / hour). Best-effort rate limit enforced.`,
    };
  }
  return { allow: true };
}

export type AuditValidationStatus =
  | "passed"
  | "schema_violation"
  | "malformed_json"
  | "upstream_error"
  | "refused";

export interface AuditEventInsert {
  workspace_id: string;
  user_id: string;
  action: typeof AUDIT_ACTION;
  resource_type: typeof AUDIT_RESOURCE_TYPE;
  resource_id: string;
  metadata: {
    task_type: TaskType;
    model: string;
    correlation_id: string;
    latency_ms: number;
    validation_status: AuditValidationStatus;
    http_status?: number;
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
  };
}

/**
 * Builds the sanitized audit row. The shape is fixed so no prompt text,
 * headers, keys, or raw model output can be added by accident.
 */
export function buildAuditEvent(input: {
  workspaceId: string;
  userId: string;
  taskType: TaskType;
  model: string;
  correlationId: string;
  latencyMs: number;
  validationStatus: AuditValidationStatus;
  httpStatus?: number;
  promptTokens?: number | null;
  completionTokens?: number | null;
}): AuditEventInsert {
  const metadata: AuditEventInsert["metadata"] = {
    task_type: input.taskType,
    model: input.model,
    correlation_id: input.correlationId,
    latency_ms: input.latencyMs,
    validation_status: input.validationStatus,
  };
  if (input.httpStatus !== undefined) metadata.http_status = input.httpStatus;
  if (input.promptTokens !== undefined) metadata.prompt_tokens = input.promptTokens;
  if (input.completionTokens !== undefined) metadata.completion_tokens = input.completionTokens;

  return {
    workspace_id: input.workspaceId,
    user_id: input.userId,
    action: AUDIT_ACTION,
    resource_type: AUDIT_RESOURCE_TYPE,
    resource_id: input.correlationId,
    metadata,
  };
}

/**
 * Resolves the CORS origin. Unknown origins receive the first default origin,
 * which the browser will reject; the wildcard is never emitted.
 */
export function resolveCorsOrigin(
  requestOrigin: string | null,
  defaults: readonly string[],
  allowed: readonly string[]
): string {
  if (requestOrigin && (defaults.includes(requestOrigin) || allowed.includes(requestOrigin))) {
    return requestOrigin;
  }
  return defaults[0];
}
