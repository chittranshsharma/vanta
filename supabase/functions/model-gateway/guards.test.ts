import { describe, expect, it } from "vitest";
import {
  AUDIT_ACTION,
  AUDIT_RESOURCE_TYPE,
  MAX_BODY_BYTES,
  buildAuditEvent,
  evaluateRateLimit,
  resolveCorsOrigin,
  validateRequestBody,
} from "./guards.ts";
import { validateHealthCheckOutput } from "./schemas.ts";

const WS = "11111111-2222-3333-4444-555555555555";

describe("validateRequestBody", () => {
  it("accepts exactly workspace_id and an allowlisted task_type", () => {
    const res = validateRequestBody(JSON.stringify({ workspace_id: WS, task_type: "gateway_health_check" }));
    expect(res).toEqual({ ok: true, workspaceId: WS, taskType: "gateway_health_check", twinId: null });
  });

  it("accepts twin_id only for claim_grounding_audit and requires it there", () => {
    const withTwin = validateRequestBody(JSON.stringify({ workspace_id: WS, task_type: "claim_grounding_audit", twin_id: WS }));
    expect(withTwin).toEqual({ ok: true, workspaceId: WS, taskType: "claim_grounding_audit", twinId: WS });

    const missing = validateRequestBody(JSON.stringify({ workspace_id: WS, task_type: "claim_grounding_audit" }));
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error).toBe("missing_twin_id");

    const onHealth = validateRequestBody(JSON.stringify({ workspace_id: WS, task_type: "gateway_health_check", twin_id: WS }));
    expect(onHealth.ok).toBe(false);
    if (!onHealth.ok) expect(onHealth.error).toBe("invalid_request");
  });

  it("rejects bodies above the byte limit before parsing, regardless of Content-Length", () => {
    const big = JSON.stringify({ workspace_id: WS, task_type: "x".repeat(MAX_BODY_BYTES) });
    const res = validateRequestBody(big);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("payload_too_large");
  });

  it("rejects invalid JSON", () => {
    const res = validateRequestBody("{not json");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalid_json");
  });

  it("rejects arrays and primitives", () => {
    for (const raw of ["[]", "null", "42", '"str"']) {
      const res = validateRequestBody(raw);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error).toBe("invalid_request");
    }
  });

  it.each(["prompt", "model", "schema", "evidence", "messages", "temperature"])(
    "rejects client-supplied %s",
    (key) => {
      const res = validateRequestBody(
        JSON.stringify({ workspace_id: WS, task_type: "gateway_health_check", [key]: "anything" })
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("invalid_request");
        expect(res.message).toContain(key);
      }
    }
  );

  it("rejects a non-UUID workspace_id", () => {
    const res = validateRequestBody(JSON.stringify({ workspace_id: "ws-1", task_type: "gateway_health_check" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("missing_workspace_id");
  });

  it("rejects a task_type outside the allowlist", () => {
    const res = validateRequestBody(JSON.stringify({ workspace_id: WS, task_type: "persona_simulation" }));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe("invalid_task_type");
  });
});

describe("evaluateRateLimit", () => {
  it("allows when under the limit", () => {
    expect(evaluateRateLimit({ count: 9, countError: null })).toEqual({ allow: true });
  });

  it("refuses with 429 at the limit", () => {
    const res = evaluateRateLimit({ count: 10, countError: null });
    expect(res.allow).toBe(false);
    if (!res.allow) expect(res.status).toBe(429);
  });

  it("fails closed with 503 when the count could not be read", () => {
    const onError = evaluateRateLimit({ count: null, countError: { message: "permission denied" } });
    expect(onError.allow).toBe(false);
    if (!onError.allow) expect(onError.error).toBe("rate_limit_unavailable");

    const onNull = evaluateRateLimit({ count: null, countError: null });
    expect(onNull.allow).toBe(false);
    if (!onNull.allow) expect(onNull.status).toBe(503);
  });
});

describe("buildAuditEvent", () => {
  const base = {
    workspaceId: WS,
    userId: "u1",
    taskType: "gateway_health_check" as const,
    model: "test-model",
    correlationId: "corr-1",
    latencyMs: 12,
    validationStatus: "passed" as const,
  };

  it("satisfies audit_events NOT NULL columns (action, resource_type)", () => {
    const row = buildAuditEvent(base);
    expect(row.action).toBe(AUDIT_ACTION);
    expect(row.resource_type).toBe(AUDIT_RESOURCE_TYPE);
    expect(row.resource_id).toBe("corr-1");
    expect(row.user_id).toBe("u1");
    expect(row.workspace_id).toBe(WS);
  });

  it("metadata contains only the fixed sanitized keys", () => {
    const row = buildAuditEvent({ ...base, promptTokens: 5, completionTokens: 7, httpStatus: 200 });
    expect(Object.keys(row.metadata).sort()).toEqual(
      ["completion_tokens", "correlation_id", "http_status", "latency_ms", "model", "prompt_tokens", "task_type", "validation_status"]
    );
    const serialized = JSON.stringify(row);
    // Token counts are allowed; prompt text, headers, keys, and model content are not.
    for (const forbidden of ['"prompt":', "authorization", "apikey", "groq", "bearer", '"content"']) {
      expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});

describe("resolveCorsOrigin", () => {
  const defaults = ["http://localhost:5173"];
  const allowed = ["https://app.example.com"];

  it("echoes a matching default or allowlisted origin", () => {
    expect(resolveCorsOrigin("http://localhost:5173", defaults, allowed)).toBe("http://localhost:5173");
    expect(resolveCorsOrigin("https://app.example.com", defaults, allowed)).toBe("https://app.example.com");
  });

  it("never returns a wildcard or an unknown origin", () => {
    const res = resolveCorsOrigin("https://evil.example", defaults, allowed);
    expect(res).toBe("http://localhost:5173");
    expect(res).not.toBe("*");
    expect(resolveCorsOrigin(null, defaults, allowed)).toBe("http://localhost:5173");
  });
});

describe("validateHealthCheckOutput", () => {
  const nonce = "abc-123";

  it("accepts the exact expected shape", () => {
    const res = validateHealthCheckOutput(
      { status: "healthy", service: "vanta-model-gateway", echo_nonce: nonce },
      nonce
    );
    expect(res.isValid).toBe(true);
    expect(res.data?.echo_nonce).toBe(nonce);
  });

  it("rejects unknown keys", () => {
    const res = validateHealthCheckOutput(
      { status: "healthy", service: "vanta-model-gateway", echo_nonce: nonce, extra: 1 },
      nonce
    );
    expect(res.isValid).toBe(false);
    expect(res.errors?.join(" ")).toContain("extra");
  });

  it("rejects a nonce mismatch", () => {
    const res = validateHealthCheckOutput(
      { status: "healthy", service: "vanta-model-gateway", echo_nonce: "other" },
      nonce
    );
    expect(res.isValid).toBe(false);
  });

  it("rejects non-object output", () => {
    expect(validateHealthCheckOutput(null, nonce).isValid).toBe(false);
    expect(validateHealthCheckOutput([], nonce).isValid).toBe(false);
    expect(validateHealthCheckOutput("healthy", nonce).isValid).toBe(false);
  });
});
