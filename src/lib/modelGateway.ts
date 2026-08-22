/**
 * Client-Side Model Gateway Adapter
 * 
 * Strict Security & Interface Invariants:
 * 1. Sends ONLY { workspace_id, task_type } in the request body.
 * 2. Never accepts or sends client-supplied prompts, schemas, models, or raw text.
 * 3. Never holds, transmits, or logs GROQ_API_KEY.
 * 4. Fails closed with typed error structures.
 */

import { supabase } from './supabase';

export type AllowlistedTaskType = 'gateway_health_check';

export const ALLOWLISTED_TASK_TYPES: readonly AllowlistedTaskType[] = ['gateway_health_check'] as const;

export interface GatewayHealthCheckData {
  status: 'healthy';
  service: 'vanta-model-gateway';
  echo_nonce: string;
}

export interface GatewayHealthResult {
  success: boolean;
  data?: GatewayHealthCheckData;
  error?: string;
  message?: string;
  validationErrors?: string[];
  latencyMs?: number;
  correlationId?: string;
  model?: string;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Invokes the server-side model gateway health probe.
 * Restricted to workspace owners and administrators.
 */
export async function invokeGatewayHealthCheck(
  workspaceId: string
): Promise<GatewayHealthResult> {
  // Client-side input validation
  if (!workspaceId || typeof workspaceId !== 'string' || !UUID_REGEX.test(workspaceId)) {
    return {
      success: false,
      error: 'invalid_workspace_id',
      message: 'A valid workspace UUID is required to invoke the gateway health probe.',
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('model-gateway', {
      body: {
        workspace_id: workspaceId,
        task_type: 'gateway_health_check',
      },
    });

    if (error) {
      // Supabase FunctionsClient error handling
      const context = (error as any).context;
      let errorBody: any = null;
      if (context && typeof context.json === 'function') {
        try {
          errorBody = await context.json();
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
      };
    }

    if (!data || typeof data !== 'object') {
      return {
        success: false,
        error: 'invalid_gateway_response',
        message: 'Gateway returned empty or unparseable response.',
      };
    }

    if (!data.success) {
      return {
        success: false,
        error: data.error || 'gateway_failure',
        message: data.message || 'Model gateway returned failure status.',
        validationErrors: data.validation_errors,
        correlationId: data.correlation_id,
        latencyMs: data.latency_ms,
      };
    }

    return {
      success: true,
      data: data.data,
      latencyMs: data.latency_ms,
      correlationId: data.correlation_id,
      model: data.model,
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: 'network_error',
      message: err instanceof Error ? err.message : 'An unexpected client network error occurred.',
    };
  }
}
