import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { validateHealthCheckOutput } from "./schemas.ts";
import { isTaskEnabled } from "./flags.ts";
import { logEvent } from "./log.ts";
import {
  buildAuditEvent,
  resolveCorsOrigin,
  validateRequestBody,
  type AuditEventInsert,
} from "./guards.ts";
import { runStructuredCompletion, runWithBoundedRetry, type ChatMessage } from "./provider.ts";
import {
  CLAIM_GROUNDING_SCHEMA_VERSION,
  claimGroundingJsonSchema,
  validateClaimGroundingOutput,
} from "./tasks/claimGroundingAudit.ts";
import {
  CLAIM_GROUNDING_PROMPT_VERSION,
  buildGroundingContext,
  buildGroundingMessages,
} from "./tasks/claimGroundingPrompt.ts";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Local dev origins allowed by default
const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
];

function getCorsHeaders(requestOrigin: string | null): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": resolveCorsOrigin(requestOrigin, DEFAULT_ORIGINS, ALLOWED_ORIGINS),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { success: false, error: "method_not_allowed" }, corsHeaders);
  }

  const correlationId = crypto.randomUUID();
  const startTime = Date.now();
  const fail = (status: number, error: string, message: string, extra: Record<string, unknown> = {}) =>
    jsonResponse(status, { success: false, error, message, correlation_id: correlationId, ...extra }, corsHeaders);

  try {
    // 1-3. Body size on bytes read, JSON parse, strict field whitelist per task
    const rawBody = await req.text();
    const validation = validateRequestBody(rawBody);
    if (!validation.ok) {
      return fail(validation.error === "payload_too_large" ? 413 : 400, validation.error, validation.message);
    }
    const { workspaceId, taskType, twinId, userGroqApiKey } = validation;

    // Task must be enabled by operator configuration, never by the request.
    if (!isTaskEnabled(taskType, Deno.env.get("ENABLED_TASKS"))) {
      return fail(403, "task_disabled", `Task "${taskType}" is not enabled on this deployment.`);
    }

    // 4. Authenticate caller via Supabase JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return fail(401, "unauthorized", "Authorization header with Bearer JWT is required.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
    if (!supabaseUrl || !supabaseAnonKey) {
      return fail(503, "gateway_not_configured", "Supabase environment configuration missing.");
    }

    // All data access below runs under the caller's JWT, so RLS applies.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return fail(401, "invalid_token", "Caller JWT token is invalid or expired.");
    }
    const userId = userData.user.id;

    // 5. Authorize caller role. All model gateway tasks are restricted to owner/admin for initial beta.
    const { data: memberData, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .single();
    if (memberError || !memberData) {
      return fail(403, "forbidden", "Caller is not a member of the workspace.");
    }
    if (!["owner", "admin"].includes(memberData.role)) {
      return fail(403, "forbidden", "Only workspace owners and administrators may invoke model gateway tasks.");
    }

    // 6. Provider configuration (BYOK support: prioritizes user-supplied key, falls back to server env)
    const headerUserKey = req.headers.get("x-user-groq-key");
    const candidateUserKey = (userGroqApiKey || headerUserKey || "").trim();

    let activeGroqApiKey: string | null = null;
    let keySource: "user" | "server" = "server";

    if (candidateUserKey) {
      if (!candidateUserKey.startsWith("gsk_") || candidateUserKey.length < 20 || !/^gsk_[A-Za-z0-9_-]+$/.test(candidateUserKey)) {
        return fail(400, "invalid_user_key", "Supplied user Groq API key format is invalid. Keys must start with 'gsk_'.");
      }
      activeGroqApiKey = candidateUserKey;
      keySource = "user";
    } else {
      const serverKey = Deno.env.get("GROQ_API_KEY");
      if (serverKey) {
        activeGroqApiKey = serverKey;
        keySource = "server";
      } else {
        return fail(503, "custom_key_required", "No Groq API key configured. Please enter your personal Groq API key in Settings.");
      }
    }
    const groqModel = Deno.env.get("GROQ_MODEL") || "qwen/qwen3.8-27b";

    // 7. Atomic Quota (Migration 015). Fails closed.
    const quota = await supabase.rpc("consume_quota", { p_workspace_id: workspaceId, p_kind: "model_call" });
    if (quota.error) {
      return fail(503, "rate_limit_unavailable", "Quota state could not be read; request refused (fail-closed).");
    }
    const row = (Array.isArray(quota.data) ? quota.data[0] : quota.data) as { allowed?: boolean; used?: number; daily_limit?: number } | null;
    if (!row || row.allowed !== true) {
      logEvent("warn", "quota exhausted", { correlation_id: correlationId, task_type: taskType, workspace_id: workspaceId, status: 429 });
      return fail(429, "rate_limited", `Workspace daily model-call quota reached (${row?.used ?? "?"} of ${row?.daily_limit ?? "?"}).`);
    }

    let auditWriteFailed = false;
    async function writeAudit(row: AuditEventInsert): Promise<void> {
      const { error } = await supabase.from("audit_events").insert(row);
      if (error) auditWriteFailed = true;
    }
    const auditBase = { workspaceId, userId, taskType, model: groqModel, correlationId };
    const fetchImpl: typeof fetch = (input, init) => fetch(input, init);

    // ------------------------------------------------------------------
    // TASK: gateway_health_check
    // ------------------------------------------------------------------
    if (taskType === "gateway_health_check") {
      const nonce = crypto.randomUUID();
      const messages: ChatMessage[] = [
        {
          role: "system",
          content: `You are an internal health check probe for Vanta. Verify gateway responsiveness and output the required JSON format exactly: {"status": "healthy", "service": "vanta-model-gateway", "echo_nonce": "${nonce}"}. Output only valid JSON with these exact keys. Do not include any other text or keys.`,
        },
        { role: "user", content: `Perform gateway probe for nonce: ${nonce}` },
      ];
      const result = await runStructuredCompletion(
        { apiKey: activeGroqApiKey, model: groqModel, messages, maxTokens: 100 },
        fetchImpl
      );
      const latencyMs = Date.now() - startTime;

      if (!result.ok) {
        await writeAudit(
          buildAuditEvent({
            ...auditBase,
            latencyMs,
            validationStatus: "upstream_error",
            httpStatus: result.kind === "http" ? result.status : undefined,
          })
        );
        return fail(502, "upstream_provider_error", "Upstream model inference provider returned an error.", {
          latency_ms: latencyMs,
          audit_write_failed: auditWriteFailed,
        });
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(result.content);
      } catch {
        await writeAudit(buildAuditEvent({ ...auditBase, latencyMs, validationStatus: "malformed_json" }));
        return jsonResponse(
          502,
          {
            success: false,
            error: "validation_failed",
            validation_errors: ["Model output was not valid parseable JSON."],
            correlation_id: correlationId,
            latency_ms: latencyMs,
            audit_write_failed: auditWriteFailed,
          },
          corsHeaders
        );
      }

      const validationResult = validateHealthCheckOutput(parsedJson, nonce);
      await writeAudit(
        buildAuditEvent({
          ...auditBase,
          latencyMs,
          validationStatus: validationResult.isValid ? "passed" : "schema_violation",
          promptTokens: result.promptTokens,
          completionTokens: result.completionTokens,
        })
      );
      logEvent(validationResult.isValid ? "info" : "warn", "health check", { correlation_id: correlationId, task_type: taskType, workspace_id: workspaceId, latency_ms: latencyMs, model: groqModel, validation_status: validationResult.isValid ? "passed" : "schema_violation" });
      if (!validationResult.isValid) {
        return jsonResponse(
          502,
          {
            success: false,
            error: "validation_failed",
            validation_errors: validationResult.errors,
            correlation_id: correlationId,
            latency_ms: latencyMs,
            audit_write_failed: auditWriteFailed,
          },
          corsHeaders
        );
      }
      return jsonResponse(
        200,
        {
          success: true,
          data: {
            ...validationResult.data,
            key_source: keySource,
          },
          latency_ms: latencyMs,
          model: groqModel,
          correlation_id: correlationId,
          audit_write_failed: auditWriteFailed,
        },
        corsHeaders
      );
    }

    // ------------------------------------------------------------------
    // TASK: claim_grounding_audit (Ticket 5.1)
    // ------------------------------------------------------------------
    if (taskType === "claim_grounding_audit" && twinId) {
      const loaded = await loadGroundingRows(supabase, workspaceId, twinId);
      if (!loaded.ok) {
        return fail(loaded.status, loaded.error, loaded.message);
      }

      const built = buildGroundingContext(loaded.rows);
      if (!built.ok) {
        await writeAudit(buildAuditEvent({ ...auditBase, latencyMs: Date.now() - startTime, validationStatus: "refused" }));
        return fail(400, built.error, built.message, { audit_write_failed: auditWriteFailed });
      }

      const schema = claimGroundingJsonSchema();
      const outcome = await runWithBoundedRetry({
        messages: buildGroundingMessages(built.payload),
        call: (messages) =>
          runStructuredCompletion(
            { apiKey: activeGroqApiKey, model: groqModel, messages, jsonSchema: schema, maxTokens: 4000 },
            fetchImpl
          ),
        validate: (parsed) => validateClaimGroundingOutput(parsed, built.ctx),
      });
      const latencyMs = Date.now() - startTime;

      const status = outcome.ok
        ? "passed"
        : outcome.reason === "upstream_error"
        ? "upstream_error"
        : outcome.reason === "malformed_json"
        ? "malformed_json"
        : "validation_failed";

      // Persist the run (append-only). Output is stored only when validation passed.
      const { data: runRow, error: runError } = await supabase
        .from("model_task_runs")
        .insert({
          workspace_id: workspaceId,
          twin_id: twinId,
          created_by: userId,
          task_type: "claim_grounding_audit",
          model: groqModel,
          prompt_version: CLAIM_GROUNDING_PROMPT_VERSION,
          schema_version: CLAIM_GROUNDING_SCHEMA_VERSION,
          status,
          attempts: outcome.attempts,
          repaired: outcome.ok ? outcome.repaired : false,
          evidence_class: "inference",
          input_claim_ids: built.ctx.creativeClaimIds,
          output: outcome.ok ? { verdicts: outcome.data } : null,
          validation_errors: outcome.ok ? [] : outcome.errors,
          prompt_tokens: outcome.ok ? outcome.promptTokens : null,
          completion_tokens: outcome.ok ? outcome.completionTokens : null,
          latency_ms: latencyMs,
          correlation_id: correlationId,
        })
        .select("id")
        .single();

      await writeAudit(
        buildAuditEvent({
          ...auditBase,
          latencyMs,
          validationStatus: status === "validation_failed" ? "schema_violation" : status,
          httpStatus: !outcome.ok ? outcome.status : undefined,
          promptTokens: outcome.ok ? outcome.promptTokens : undefined,
          completionTokens: outcome.ok ? outcome.completionTokens : undefined,
        })
      );

      logEvent(outcome.ok ? "info" : "warn", "claim grounding audit", { correlation_id: correlationId, task_type: taskType, workspace_id: workspaceId, latency_ms: latencyMs, model: groqModel, attempts: outcome.attempts, validation_status: status });
      const common = {
        correlation_id: correlationId,
        latency_ms: latencyMs,
        model: groqModel,
        run_id: runRow?.id ?? null,
        run_persisted: !runError,
        audit_write_failed: auditWriteFailed,
        attempts: outcome.attempts,
      };

      if (!outcome.ok) {
        const httpStatus = outcome.reason === "upstream_error" ? 502 : 502;
        return jsonResponse(
          httpStatus,
          {
            success: false,
            error: outcome.reason === "upstream_error" ? "upstream_provider_error" : "validation_failed",
            validation_errors: outcome.errors,
            ...common,
          },
          corsHeaders
        );
      }

      return jsonResponse(
        200,
        {
          success: true,
          data: {
            verdicts: outcome.data,
            evidence_class: "inference",
            needs_human_review: true,
            prompt_version: CLAIM_GROUNDING_PROMPT_VERSION,
            schema_version: CLAIM_GROUNDING_SCHEMA_VERSION,
            repaired: outcome.repaired,
          },
          ...common,
        },
        corsHeaders
      );
    }

    return fail(400, "invalid_task_type", "Unsupported task.");
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    logEvent("error", "internal error", { correlation_id: correlationId, error: err instanceof Error ? err.name : "unknown", latency_ms: latencyMs });
    return jsonResponse(
      500,
      {
        success: false,
        error: "internal_gateway_error",
        message: "An unexpected server error occurred. Quote the correlation_id when reporting.",
        correlation_id: correlationId,
        latency_ms: latencyMs,
      },
      corsHeaders
    );
  }
});

type GroundingRows = Parameters<typeof buildGroundingContext>[0];

/**
 * Loads the rows for a grounding run through the caller's RLS client.
 * If the twin is not visible to the caller, RLS returns nothing and the
 * task reports twin_not_found rather than leaking existence.
 */
async function loadGroundingRows(
  supabase: SupabaseClient,
  workspaceId: string,
  twinId: string
): Promise<{ ok: true; rows: GroundingRows } | { ok: false; status: number; error: string; message: string }> {
  const { data: twin, error: twinError } = await supabase
    .from("creative_twins")
    .select("id")
    .eq("id", twinId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (twinError) return { ok: false, status: 502, error: "data_read_failed", message: "Could not read the twin." };
  if (!twin) return { ok: false, status: 404, error: "twin_not_found", message: "Twin not found in this workspace." };

  const [claimsRes, brandRes, proofRes] = await Promise.all([
    supabase
      .from("creative_claims")
      .select("id, claim_text, claim_classification, brand_alignment_status, source_excerpt")
      .eq("twin_id", twinId)
      .eq("workspace_id", workspaceId),
    supabase
      .from("brand_claims")
      .select("id, claim_text, claim_type, condition, review_status")
      .eq("workspace_id", workspaceId),
    supabase
      .from("brand_proof_points")
      .select("id, claim_id, proof_text, evidence_class, review_status")
      .eq("workspace_id", workspaceId),
  ]);
  if (claimsRes.error || brandRes.error || proofRes.error) {
    return { ok: false, status: 502, error: "data_read_failed", message: "Could not read grounding inputs." };
  }
  return {
    ok: true,
    rows: {
      creativeClaims: claimsRes.data ?? [],
      brandClaims: brandRes.data ?? [],
      proofPoints: proofRes.data ?? [],
    },
  };
}
