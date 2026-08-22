/**
 * Client-Side Model Gateway Adapter
 *
 * Strict Security & Interface Invariants:
 * 1. Sends ONLY { workspace_id, task_type } plus the task's declared id fields.
 * 2. Never accepts or sends client-supplied prompts, schemas, models, or raw text.
 * 3. Never holds, transmits, or logs GROQ_API_KEY.
 * 4. Fails closed with typed error structures.
 */

import { supabase } from './supabase';

export type AllowlistedTaskType = 'gateway_health_check' | 'claim_grounding_audit';

export const ALLOWLISTED_TASK_TYPES: readonly AllowlistedTaskType[] = [
  'gateway_health_check',
  'claim_grounding_audit',
] as const;

export interface GatewayHealthCheckData {
  status: 'healthy';
  service: 'vanta-model-gateway';
  echo_nonce: string;
}

export type GroundingVerdictKind =
  | 'backed_by_proof'
  | 'approved_no_proof'
  | 'conditional'
  | 'prohibited'
  | 'unmatched';

export interface ClaimGroundingVerdict {
  creative_claim_id: string;
  verdict: GroundingVerdictKind;
  matched_brand_claim_id: string | null;
  cited_proof_point_ids: string[];
  rationale: string;
  confidence: 'low' | 'medium' | 'high';
  evidence_class: 'inference' | 'unknown';
}

export interface ClaimGroundingData {
  verdicts: ClaimGroundingVerdict[];
  evidence_class: 'inference';
  needs_human_review: true;
  prompt_version: string;
  schema_version: string;
  repaired: boolean;
}

export interface GatewayResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  validationErrors?: string[];
  latencyMs?: number;
  correlationId?: string;
  model?: string;
  runId?: string | null;
  attempts?: number;
}

export type GatewayHealthResult = GatewayResult<GatewayHealthCheckData>;
export type ClaimGroundingResult = GatewayResult<ClaimGroundingData>;

/** Shape of the JSON body the gateway returns. All fields optional; never trusted beyond display. */
interface GatewayBody {
  success?: boolean;
  data?: unknown;
  error?: string;
  message?: string;
  validation_errors?: string[];
  correlation_id?: string;
  latency_ms?: number;
  model?: string;
  run_id?: string | null;
  attempts?: number;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function invokeTask<T>(body: Record<string, string>): Promise<GatewayResult<T>> {
  try {
    const { data, error } = await supabase.functions.invoke('model-gateway', { body });

    if (error) {
      const context = (error as { context?: { json?: () => Promise<unknown> } }).context;
      let errorBody: GatewayBody | null = null;
      if (context && typeof context.json === 'function') {
        try {
          errorBody = (await context.json()) as GatewayBody;
        } catch {
          // ignore json parse error
        }
      }
      return {
        success: false,
        error: errorBody?.error || 'function_invocation_error',
        message: errorBody?.message || error.message || 'Failed to invoke model gateway function.',
        validationErrors: errorBody?.validation_errors,
        correlationId: errorBody?.correlation_id,
        latencyMs: errorBody?.latency_ms,
        runId: errorBody?.run_id,
        attempts: errorBody?.attempts,
      };
    }

    if (!data || typeof data !== 'object') {
      return { success: false, error: 'invalid_gateway_response', message: 'Gateway returned empty or unparseable response.' };
    }
    const parsed = data as GatewayBody;

    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error || 'gateway_failure',
        message: parsed.message || 'Model gateway returned failure status.',
        validationErrors: parsed.validation_errors,
        correlationId: parsed.correlation_id,
        latencyMs: parsed.latency_ms,
        runId: parsed.run_id,
        attempts: parsed.attempts,
      };
    }

    return {
      success: true,
      data: parsed.data as T,
      latencyMs: parsed.latency_ms,
      correlationId: parsed.correlation_id,
      model: parsed.model,
      runId: parsed.run_id,
      attempts: parsed.attempts,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: 'network_error',
      message: err instanceof Error ? err.message : 'An unexpected client network error occurred.',
    };
  }
}

/**
 * Invokes the server-side model gateway health probe.
 * Restricted to workspace owners and administrators.
 */
export async function invokeGatewayHealthCheck(workspaceId: string): Promise<GatewayHealthResult> {
  if (!workspaceId || typeof workspaceId !== 'string' || !UUID_REGEX.test(workspaceId)) {
    return {
      success: false,
      error: 'invalid_workspace_id',
      message: 'A valid workspace UUID is required to invoke the gateway health probe.',
    };
  }
  return invokeTask<GatewayHealthCheckData>({ workspace_id: workspaceId, task_type: 'gateway_health_check' });
}

/**
 * Runs the Ticket 5.1 claim-grounding audit for one twin. The server loads
 * every row through the caller's RLS context; the browser sends ids only.
 * Results are model inference and always require human review.
 */
export async function invokeClaimGroundingAudit(workspaceId: string, twinId: string): Promise<ClaimGroundingResult> {
  if (!UUID_REGEX.test(workspaceId ?? '') || !UUID_REGEX.test(twinId ?? '')) {
    return { success: false, error: 'invalid_request', message: 'Valid workspace and twin UUIDs are required.' };
  }
  return invokeTask<ClaimGroundingData>({
    workspace_id: workspaceId,
    task_type: 'claim_grounding_audit',
    twin_id: twinId,
  });
}
