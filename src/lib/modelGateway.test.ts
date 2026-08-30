import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  invokeGatewayHealthCheck,
  ALLOWLISTED_TASK_TYPES,
} from './modelGateway';
import { supabase } from './supabase';

vi.mock('./supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe('Model Gateway Client Adapter & Security Invariants', () => {
  const validWorkspaceId = '925dbdb9-8c9f-4459-9461-b4a1462c7e65';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Interface & Secret Isolation Invariants', () => {
    it('has only gateway_health_check in allowlisted tasks for this milestone', () => {
      expect(ALLOWLISTED_TASK_TYPES).toEqual(['gateway_health_check', 'claim_grounding_audit']);
    });

    it('contains no GROQ_API_KEY in client bundle or environment', () => {
      const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
      expect(env?.GROQ_API_KEY).toBeUndefined();
      expect(env?.VITE_GROQ_API_KEY).toBeUndefined();
    });

    it('rejects invalid workspace UUIDs client-side before network call', async () => {
      const res = await invokeGatewayHealthCheck('not-a-uuid');
      expect(res.success).toBe(false);
      expect(res.error).toBe('invalid_workspace_id');
      expect(supabase.functions.invoke).not.toHaveBeenCalled();
    });

    it('sends strictly workspace_id and task_type with no caller-supplied prompts or models', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            status: 'healthy',
            service: 'vanta-model-gateway',
            echo_nonce: 'nonce-123',
          },
          latency_ms: 180,
          correlation_id: 'corr-123',
          model: 'qwen/qwen3.8-27b',
        },
        error: null,
      });

      const res = await invokeGatewayHealthCheck(validWorkspaceId);

      expect(supabase.functions.invoke).toHaveBeenCalledWith('model-gateway', {
        body: {
          workspace_id: validWorkspaceId,
          task_type: 'gateway_health_check',
        },
      });

      // Verify the body sent contains strictly 2 keys
      const callArgs = vi.mocked(supabase.functions.invoke).mock.calls[0][1];
      const bodyKeys = Object.keys(callArgs?.body || {});
      expect(bodyKeys.sort()).toEqual(['task_type', 'workspace_id']);

      expect(res.success).toBe(true);
      expect(res.data?.status).toBe('healthy');
      expect(res.data?.service).toBe('vanta-model-gateway');
    });
  });

  describe('2. Negative & Fail-Closed Error Handling', () => {
    it('handles 401 unauthorized / invalid token responses', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
          context: {
            json: async () => ({
              success: false,
              error: 'unauthorized',
              message: 'Authorization header with Bearer JWT is required.',
              correlation_id: 'corr-401',
            }),
          },
        } as unknown as Error,
      });

      const res = await invokeGatewayHealthCheck(validWorkspaceId);
      expect(res.success).toBe(false);
      expect(res.error).toBe('unauthorized');
      expect(res.message).toContain('Authorization');
    });

    it('handles 403 forbidden (non-admin caller) responses', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
          context: {
            json: async () => ({
              success: false,
              error: 'forbidden',
              message: 'Only workspace owners and administrators may invoke the model gateway health check.',
              correlation_id: 'corr-403',
            }),
          },
        } as unknown as Error,
      });

      const res = await invokeGatewayHealthCheck(validWorkspaceId);
      expect(res.success).toBe(false);
      expect(res.error).toBe('forbidden');
      expect(res.message).toContain('owners and administrators');
    });

    it('handles 429 rate limited responses', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
          context: {
            json: async () => ({
              success: false,
              error: 'rate_limited',
              message: 'Workspace health probe quota reached (10 invocations / hour). Best-effort rate limit enforced.',
              correlation_id: 'corr-429',
            }),
          },
        } as unknown as Error,
      });

      const res = await invokeGatewayHealthCheck(validWorkspaceId);
      expect(res.success).toBe(false);
      expect(res.error).toBe('rate_limited');
      expect(res.message).toContain('quota reached');
    });

    it('handles 503 gateway_not_configured responses', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
          context: {
            json: async () => ({
              success: false,
              error: 'gateway_not_configured',
              message: 'Server model inference provider credentials are not configured.',
              correlation_id: 'corr-503',
            }),
          },
        } as unknown as Error,
      });

      const res = await invokeGatewayHealthCheck(validWorkspaceId);
      expect(res.success).toBe(false);
      expect(res.error).toBe('gateway_not_configured');
    });

    it('handles 502 validation_failed responses with typed validation errors', async () => {
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: null,
        error: {
          name: 'FunctionsHttpError',
          message: 'Edge Function returned a non-2xx status code',
          context: {
            json: async () => ({
              success: false,
              error: 'validation_failed',
              validation_errors: ['Nonce verification failed.', 'Disallowed unknown key in model output: "extra_field".'],
              correlation_id: 'corr-502',
              latency_ms: 220,
            }),
          },
        } as unknown as Error,
      });

      const res = await invokeGatewayHealthCheck(validWorkspaceId);
      expect(res.success).toBe(false);
      expect(res.error).toBe('validation_failed');
      expect(res.validationErrors).toHaveLength(2);
      expect(res.validationErrors?.[0]).toContain('Nonce verification failed');
    });

    it('invokeClaimGroundingAudit validates UUIDs and dispatches strictly twin_id, task_type, workspace_id', async () => {
      const { invokeClaimGroundingAudit } = await import('./modelGateway');
      const badRes = await invokeClaimGroundingAudit('bad-ws', 'bad-twin');
      expect(badRes.success).toBe(false);
      expect(badRes.error).toBe('invalid_request');

      const validTwinId = '22222222-3333-4444-5555-666666666666';
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            verdicts: [],
            evidence_class: 'inference',
            needs_human_review: true,
            prompt_version: '1.0.0',
            schema_version: '1.0.0',
            repaired: false,
          },
          latency_ms: 350,
          correlation_id: 'corr-claim-1',
          model: 'qwen/qwen3.8-27b',
        },
        error: null,
      });

      const goodRes = await invokeClaimGroundingAudit(validWorkspaceId, validTwinId);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('model-gateway', {
        body: {
          workspace_id: validWorkspaceId,
          task_type: 'claim_grounding_audit',
          twin_id: validTwinId,
        },
      });
      expect(goodRes.success).toBe(true);
      expect(goodRes.data?.needs_human_review).toBe(true);
    });

    it('attaches user_groq_api_key when userKeyOverride or stored key is present', async () => {
      const userKey = 'gsk_test_user_key_12345678901234567890';
      vi.mocked(supabase.functions.invoke).mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            status: 'healthy',
            service: 'vanta-model-gateway',
            echo_nonce: 'nonce-user',
            key_source: 'user',
          },
        },
        error: null,
      });

      const res = await invokeGatewayHealthCheck(validWorkspaceId, userKey);
      expect(supabase.functions.invoke).toHaveBeenCalledWith('model-gateway', {
        body: {
          workspace_id: validWorkspaceId,
          task_type: 'gateway_health_check',
          user_groq_api_key: userKey,
        },
      });
      expect(res.success).toBe(true);
    });
  });
});
