/**
 * Server-Held Task Registry & Health-Check Schema Validation
 *
 * Strict Post-Model Validation Rules:
 * 1. Validates exact required keys and types.
 * 2. Rejects unexpected or unknown keys.
 * 3. Compares expected cryptographic nonce.
 * 4. Fails closed with typed validation errors.
 */

export interface GatewayHealthCheckOutput {
  status: 'healthy';
  service: 'vanta-model-gateway';
  echo_nonce: string;
}

export type TaskType = 'gateway_health_check' | 'claim_grounding_audit';

/** Every task the gateway knows how to run. Knowing is not the same as enabled: see flags.ts. */
export const ALLOWLISTED_TASKS: readonly TaskType[] = ['gateway_health_check', 'claim_grounding_audit'] as const;

/** Tasks that run without any ENABLED_TASKS configuration. User-content tasks are never on by default. */
export const DEFAULT_ENABLED_TASKS: readonly TaskType[] = ['gateway_health_check'] as const;

export interface SchemaValidationResult<T> {
  isValid: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Validates the raw JSON output from Groq against the fixed GatewayHealthCheckOutput schema.
 */
export function validateHealthCheckOutput(
  rawJson: unknown,
  expectedNonce: string
): SchemaValidationResult<GatewayHealthCheckOutput> {
  const errors: string[] = [];

  if (!rawJson || typeof rawJson !== 'object' || Array.isArray(rawJson)) {
    return {
      isValid: false,
      errors: ['Model output must be a non-null JSON object.'],
    };
  }

  const obj = rawJson as Record<string, unknown>;
  const allowedKeys = new Set(['status', 'service', 'echo_nonce']);
  const actualKeys = Object.keys(obj);

  // Reject unexpected or unknown keys
  for (const key of actualKeys) {
    if (!allowedKeys.has(key)) {
      errors.push(`Disallowed unknown key in model output: "${key}".`);
    }
  }

  // Validate status
  if (obj.status !== 'healthy') {
    errors.push(`Expected status "healthy", received "${String(obj.status)}".`);
  }

  // Validate service
  if (obj.service !== 'vanta-model-gateway') {
    errors.push(`Expected service "vanta-model-gateway", received "${String(obj.service)}".`);
  }

  // Validate nonce
  if (typeof obj.echo_nonce !== 'string' || obj.echo_nonce !== expectedNonce) {
    errors.push(`Nonce verification failed. Expected "${expectedNonce}", received "${String(obj.echo_nonce)}".`);
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    data: {
      status: 'healthy',
      service: 'vanta-model-gateway',
      echo_nonce: obj.echo_nonce as string,
    },
  };
}
