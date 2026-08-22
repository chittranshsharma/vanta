/**
 * Provider adapter for structured completions (Upgrade A).
 *
 * fetch is injected so the retry and parsing logic is unit-testable without
 * network access. The adapter never logs request bodies or API keys.
 */

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface StructuredCompletionRequest {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  /** JSON schema passed as response_format; the server validator remains the authority. */
  jsonSchema?: Record<string, unknown>;
  maxTokens: number;
  temperature?: number;
}

export type ProviderResult =
  | { ok: true; content: string; promptTokens: number | null; completionTokens: number | null }
  | { ok: false; kind: "http"; status: number }
  | { ok: false; kind: "network" }
  | { ok: false; kind: "malformed" };

export const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function runStructuredCompletion(
  req: StructuredCompletionRequest,
  fetchImpl: typeof fetch
): Promise<ProviderResult> {
  let response: Response;
  try {
    response = await fetchImpl(GROQ_CHAT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${req.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: req.model,
        temperature: req.temperature ?? 0,
        max_tokens: req.maxTokens,
        response_format: req.jsonSchema
          ? { type: "json_schema", json_schema: { name: "vanta_task", strict: true, schema: req.jsonSchema } }
          : { type: "json_object" },
        messages: req.messages,
      }),
    });
  } catch {
    return { ok: false, kind: "network" };
  }

  if (!response.ok) {
    await response.text().catch(() => "");
    return { ok: false, kind: "http", status: response.status };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return { ok: false, kind: "malformed" };
  }
  const content = extractMessageContent(data);
  if (typeof content !== "string") return { ok: false, kind: "malformed" };
  const usage = extractUsage(data);
  return { ok: true, content, ...usage };
}

export function extractMessageContent(data: unknown): unknown {
  if (!data || typeof data !== "object") return undefined;
  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const first = choices[0];
  if (!first || typeof first !== "object") return undefined;
  const message = (first as { message?: unknown }).message;
  if (!message || typeof message !== "object") return undefined;
  return (message as { content?: unknown }).content;
}

export function extractUsage(data: unknown): { promptTokens: number | null; completionTokens: number | null } {
  if (!data || typeof data !== "object") return { promptTokens: null, completionTokens: null };
  const usage = (data as { usage?: unknown }).usage;
  if (!usage || typeof usage !== "object") return { promptTokens: null, completionTokens: null };
  const u = usage as { prompt_tokens?: unknown; completion_tokens?: unknown };
  return {
    promptTokens: typeof u.prompt_tokens === "number" ? u.prompt_tokens : null,
    completionTokens: typeof u.completion_tokens === "number" ? u.completion_tokens : null,
  };
}

/** Transient HTTP statuses worth exactly one retry. */
export function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export type AttemptOutcome<T> =
  | { ok: true; data: T; attempts: number; repaired: boolean; promptTokens: number; completionTokens: number }
  | { ok: false; reason: "upstream_error" | "validation_failed" | "malformed_json"; attempts: number; errors: string[]; status?: number };

/**
 * Bounded execution policy from the specification: one transient retry,
 * one schema repair (the validator's errors are appended as untrusted
 * feedback), then stop. Never loops.
 */
export async function runWithBoundedRetry<T>(input: {
  call: (messages: ChatMessage[]) => Promise<ProviderResult>;
  messages: ChatMessage[];
  validate: (parsed: unknown) => { isValid: true; data: T } | { isValid: false; errors: string[] };
}): Promise<AttemptOutcome<T>> {
  let attempts = 0;
  let transientRetried = false;
  let repaired = false;
  let messages = input.messages;
  let promptTokens = 0;
  let completionTokens = 0;
  let lastErrors: string[] = [];

  while (attempts < 3) {
    attempts += 1;
    const result = await input.call(messages);

    if (!result.ok) {
      const transient = result.kind === "network" || (result.kind === "http" && isTransientStatus(result.status));
      if (transient && !transientRetried) {
        transientRetried = true;
        continue;
      }
      return {
        ok: false,
        reason: "upstream_error",
        attempts,
        errors: [result.kind === "http" ? `provider http ${result.status}` : `provider ${result.kind}`],
        status: result.kind === "http" ? result.status : undefined,
      };
    }

    promptTokens += result.promptTokens ?? 0;
    completionTokens += result.completionTokens ?? 0;

    let parsed: unknown;
    try {
      parsed = JSON.parse(result.content);
    } catch {
      lastErrors = ["Model output was not valid parseable JSON."];
      if (!repaired) {
        repaired = true;
        messages = withRepairFeedback(input.messages, lastErrors);
        continue;
      }
      return { ok: false, reason: "malformed_json", attempts, errors: lastErrors };
    }

    const validation = input.validate(parsed);
    if (validation.isValid) {
      return { ok: true, data: validation.data, attempts, repaired, promptTokens, completionTokens };
    }
    lastErrors = validation.errors;
    if (!repaired) {
      repaired = true;
      messages = withRepairFeedback(input.messages, lastErrors);
      continue;
    }
    return { ok: false, reason: "validation_failed", attempts, errors: lastErrors };
  }

  return { ok: false, reason: "validation_failed", attempts, errors: lastErrors };
}

/** Appends validator errors as a user turn. Errors are treated as untrusted text by the next validation anyway. */
export function withRepairFeedback(original: ChatMessage[], errors: string[]): ChatMessage[] {
  return [
    ...original,
    {
      role: "user",
      content:
        "Your previous output was rejected by the schema validator. Fix every listed problem and return the full JSON again with no other text:\n" +
        errors.slice(0, 40).map((e) => `- ${e}`).join("\n"),
    },
  ];
}
