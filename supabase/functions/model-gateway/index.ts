import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  validateHealthCheckOutput,
  ALLOWLISTED_TASKS,
  type TaskType,
} from "./schemas.ts";

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
  const allowed =
    requestOrigin &&
    (DEFAULT_ORIGINS.includes(requestOrigin) || ALLOWED_ORIGINS.includes(requestOrigin))
      ? requestOrigin
      : DEFAULT_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Method check
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "method_not_allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const correlationId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    // 1. Request body size check (max 8KB)
    const contentLength = parseInt(req.headers.get("Content-Length") || "0", 10);
    if (contentLength > 8192) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "payload_too_large",
          message: "Request body exceeds maximum allowed size (8KB).",
          correlation_id: correlationId,
        }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Parse request JSON
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: "invalid_json",
          message: "Request body must be valid JSON.",
          correlation_id: correlationId,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Strict field whitelist validation: reject any extra or unknown fields
    const allowedKeys = new Set(["workspace_id", "task_type"]);
    const bodyKeys = Object.keys(body);
    const disallowedKeys = bodyKeys.filter((k) => !allowedKeys.has(k));

    if (disallowedKeys.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "invalid_request",
          message: `Disallowed fields in request body: ${disallowedKeys.join(", ")}. Client-supplied prompts, models, schemas, or arbitrary keys are strictly forbidden.`,
          correlation_id: correlationId,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { workspace_id, task_type } = body;

    if (!workspace_id || typeof workspace_id !== "string") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "missing_workspace_id",
          message: "A valid workspace_id UUID string is required.",
          correlation_id: correlationId,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!task_type || typeof task_type !== "string" || !ALLOWLISTED_TASKS.includes(task_type as TaskType)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "invalid_task_type",
          message: `Task type "${String(task_type)}" is not allowlisted. Supported tasks: ${ALLOWLISTED_TASKS.join(", ")}.`,
          correlation_id: correlationId,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Authenticate caller via Supabase JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "unauthorized",
          message: "Authorization header with Bearer JWT is required.",
          correlation_id: correlationId,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "gateway_not_configured",
          message: "Supabase environment configuration missing.",
          correlation_id: correlationId,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "invalid_token",
          message: "Caller JWT token is invalid or expired.",
          correlation_id: correlationId,
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = userData.user.id;

    // 5. Authorize caller role (admin / owner only for gateway health probes)
    const { data: memberData, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", userId)
      .single();

    if (memberError || !memberData || !["owner", "admin"].includes(memberData.role)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "forbidden",
          message: "Only workspace owners and administrators may invoke the model gateway health check.",
          correlation_id: correlationId,
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Check server configuration for Groq credentials
    const groqApiKey = Deno.env.get("GROQ_API_KEY");
    if (!groqApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "gateway_not_configured",
          message: "Server model inference provider credentials are not configured.",
          correlation_id: correlationId,
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groqModel = Deno.env.get("GROQ_MODEL") || "llama-3.3-70b-versatile";

    // 7. Best-effort rate limiter guard via audit_events check (max 10 health checks per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentInvocations, error: countError } = await supabase
      .from("audit_events")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspace_id)
      .eq("action", "model_gateway.invocation")
      .gte("created_at", oneHourAgo);

    if (!countError && recentInvocations !== null && recentInvocations >= 10) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "rate_limited",
          message: "Workspace health probe quota reached (10 invocations / hour). Best-effort rate limit enforced.",
          correlation_id: correlationId,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 8. Generate random cryptographic nonce & execute fixed server-owned probe
    const nonce = crypto.randomUUID();

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: groqModel,
        temperature: 0.0,
        max_tokens: 100,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `You are an internal health check probe for Vanta. Verify gateway responsiveness and output the required JSON format exactly: {"status": "healthy", "service": "vanta-model-gateway", "echo_nonce": "${nonce}"}. Output only valid JSON with these exact keys. Do not include any other text or keys.`,
          },
          {
            role: "user",
            content: `Perform gateway probe for nonce: ${nonce}`,
          },
        ],
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      // Record failed invocation audit event (sanitized)
      await supabase.from("audit_events").insert({
        workspace_id,
        user_id: userId,
        action: "model_gateway.invocation",
        metadata: {
          task_type: "gateway_health_check",
          model: groqModel,
          correlation_id: correlationId,
          latency_ms: latencyMs,
          validation_status: "upstream_error",
          http_status: groqResponse.status,
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "upstream_provider_error",
          message: "Upstream model inference provider returned an error status.",
          correlation_id: correlationId,
          latency_ms: latencyMs,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groqData = await groqResponse.json();
    const rawContent = groqData.choices?.[0]?.message?.content;

    // 9. Defensive JSON parse and strict schema validation
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawContent);
    } catch {
      // Record failed parse audit event
      await supabase.from("audit_events").insert({
        workspace_id,
        user_id: userId,
        action: "model_gateway.invocation",
        metadata: {
          task_type: "gateway_health_check",
          model: groqModel,
          correlation_id: correlationId,
          latency_ms: latencyMs,
          validation_status: "malformed_json",
        },
      });

      return new Response(
        JSON.stringify({
          success: false,
          error: "validation_failed",
          validation_errors: ["Model output was not valid parseable JSON."],
          correlation_id: correlationId,
          latency_ms: latencyMs,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validationResult = validateHealthCheckOutput(parsedJson, nonce);

    // 10. Record sanitized audit event
    await supabase.from("audit_events").insert({
      workspace_id,
      user_id: userId,
      action: "model_gateway.invocation",
      metadata: {
        task_type: "gateway_health_check",
        model: groqModel,
        correlation_id: correlationId,
        latency_ms: latencyMs,
        validation_status: validationResult.isValid ? "passed" : "schema_violation",
        prompt_tokens: groqData.usage?.prompt_tokens ?? null,
        completion_tokens: groqData.usage?.completion_tokens ?? null,
      },
    });

    if (!validationResult.isValid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "validation_failed",
          validation_errors: validationResult.errors,
          correlation_id: correlationId,
          latency_ms: latencyMs,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 11. Return validated, fail-closed result
    return new Response(
      JSON.stringify({
        success: true,
        data: validationResult.data,
        latency_ms: latencyMs,
        model: groqModel,
        correlation_id: correlationId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    return new Response(
      JSON.stringify({
        success: false,
        error: "internal_gateway_error",
        message: err instanceof Error ? err.message : "An unexpected server error occurred.",
        correlation_id: correlationId,
        latency_ms: latencyMs,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
