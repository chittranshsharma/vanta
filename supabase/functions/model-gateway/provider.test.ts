import { describe, expect, it, vi } from "vitest";
import {
  GROQ_CHAT_URL,
  isTransientStatus,
  runStructuredCompletion,
  runWithBoundedRetry,
  withRepairFeedback,
  type ChatMessage,
  type ProviderResult,
} from "./provider.ts";

function fakeFetch(responses: Array<{ status: number; body: unknown } | "network">): typeof fetch & { calls: RequestInit[] } {
  const calls: RequestInit[] = [];
  let i = 0;
  const fn = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    calls.push(init ?? {});
    const r = responses[Math.min(i, responses.length - 1)];
    i += 1;
    if (r === "network") throw new Error("ECONNRESET");
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch & { calls: RequestInit[] };
  fn.calls = calls;
  return fn;
}

const messages: ChatMessage[] = [{ role: "system", content: "s" }, { role: "user", content: "u" }];

describe("runStructuredCompletion", () => {
  it("posts to the provider with the key only in the Authorization header and returns content + usage", async () => {
    const f = fakeFetch([{ status: 200, body: { choices: [{ message: { content: '{"a":1}' } }], usage: { prompt_tokens: 3, completion_tokens: 2 } } }]);
    const res = await runStructuredCompletion({ apiKey: "k", model: "m", messages, maxTokens: 10, jsonSchema: { type: "object" } }, f);
    expect(res).toEqual({ ok: true, content: '{"a":1}', promptTokens: 3, completionTokens: 2 });
    const init = f.calls[0];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("m");
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(String(init.body)).not.toContain('"k"');
  });

  it("reports http, network, and malformed outcomes distinctly", async () => {
    expect(await runStructuredCompletion({ apiKey: "k", model: "m", messages, maxTokens: 10 }, fakeFetch([{ status: 500, body: {} }]))).toEqual({ ok: false, kind: "http", status: 500 });
    expect(await runStructuredCompletion({ apiKey: "k", model: "m", messages, maxTokens: 10 }, fakeFetch(["network"]))).toEqual({ ok: false, kind: "network" });
    expect(await runStructuredCompletion({ apiKey: "k", model: "m", messages, maxTokens: 10 }, fakeFetch([{ status: 200, body: { choices: [] } }]))).toEqual({ ok: false, kind: "malformed" });
  });

  it("targets the documented provider URL", () => {
    expect(GROQ_CHAT_URL).toBe("https://api.groq.com/openai/v1/chat/completions");
  });
});

describe("isTransientStatus", () => {
  it("treats 408/429/5xx as transient and 4xx auth/validation as final", () => {
    for (const s of [408, 429, 500, 502, 503, 504]) expect(isTransientStatus(s)).toBe(true);
    for (const s of [400, 401, 403, 404, 413]) expect(isTransientStatus(s)).toBe(false);
  });
});

describe("runWithBoundedRetry", () => {
  const ok = (content: string): ProviderResult => ({ ok: true, content, promptTokens: 1, completionTokens: 1 });
  const validate = (parsed: unknown) =>
    parsed && typeof parsed === "object" && (parsed as { good?: boolean }).good === true
      ? ({ isValid: true, data: parsed } as const)
      : ({ isValid: false, errors: ["good must be true"] } as const);

  it("succeeds first time with attempts = 1 and no repair", async () => {
    const call = vi.fn().mockResolvedValue(ok('{"good":true}'));
    const res = await runWithBoundedRetry({ call, messages, validate });
    expect(res).toMatchObject({ ok: true, attempts: 1, repaired: false, promptTokens: 1, completionTokens: 1 });
    expect(call).toHaveBeenCalledTimes(1);
  });

  it("retries exactly once on a transient provider error, then gives up", async () => {
    const call = vi.fn().mockResolvedValue({ ok: false, kind: "http", status: 503 } satisfies ProviderResult);
    const res = await runWithBoundedRetry({ call, messages, validate });
    expect(res).toMatchObject({ ok: false, reason: "upstream_error", attempts: 2, status: 503 });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("does not retry a non-transient provider error", async () => {
    const call = vi.fn().mockResolvedValue({ ok: false, kind: "http", status: 401 } satisfies ProviderResult);
    const res = await runWithBoundedRetry({ call, messages, validate });
    expect(res).toMatchObject({ ok: false, attempts: 1, status: 401 });
  });

  it("repairs exactly once on validation failure, appending validator errors as a user turn", async () => {
    const call = vi.fn().mockResolvedValueOnce(ok('{"good":false}')).mockResolvedValueOnce(ok('{"good":true}'));
    const res = await runWithBoundedRetry({ call, messages, validate });
    expect(res).toMatchObject({ ok: true, attempts: 2, repaired: true, promptTokens: 2 });
    const repairMessages = call.mock.calls[1][0] as ChatMessage[];
    expect(repairMessages).toHaveLength(3);
    expect(repairMessages[2].role).toBe("user");
    expect(repairMessages[2].content).toContain("good must be true");
  });

  it("stops after one repair and reports validation_failed with the last errors", async () => {
    const call = vi.fn().mockResolvedValue(ok('{"good":false}'));
    const res = await runWithBoundedRetry({ call, messages, validate });
    expect(res).toMatchObject({ ok: false, reason: "validation_failed", attempts: 2, errors: ["good must be true"] });
    expect(call).toHaveBeenCalledTimes(2);
  });

  it("treats unparseable JSON as a repairable failure, then malformed_json", async () => {
    const call = vi.fn().mockResolvedValue(ok("not json"));
    const res = await runWithBoundedRetry({ call, messages, validate });
    expect(res).toMatchObject({ ok: false, reason: "malformed_json", attempts: 2 });
  });

  it("never exceeds three provider calls in any combination", async () => {
    const call = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, kind: "network" } satisfies ProviderResult)
      .mockResolvedValueOnce(ok('{"good":false}'))
      .mockResolvedValueOnce(ok('{"good":false}'))
      .mockResolvedValue(ok('{"good":true}'));
    const res = await runWithBoundedRetry({ call, messages, validate });
    expect(res.ok).toBe(false);
    expect(res.attempts).toBe(3);
    expect(call).toHaveBeenCalledTimes(3);
  });
});

describe("withRepairFeedback", () => {
  it("caps the number of errors echoed back", () => {
    const errs = Array.from({ length: 100 }, (_, i) => `e${i}`);
    const out = withRepairFeedback(messages, errs);
    expect(out[2].content.split("\n").length).toBeLessThanOrEqual(42);
  });
});
