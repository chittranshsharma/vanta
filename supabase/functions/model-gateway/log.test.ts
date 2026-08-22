import { describe, expect, it, vi } from "vitest";
import { logEvent } from "./log.ts";

describe("logEvent", () => {
  it("emits single-line JSON with correlation id and drops forbidden keys", () => {
    const sink = vi.fn();
    logEvent("info", "done", { correlation_id: "c1", task_type: "gateway_health_check", latency_ms: 5, ...({ prompt: "secret", authorization: "Bearer x" } as object) } as never, sink);
    expect(sink).toHaveBeenCalledTimes(1);
    const line = sink.mock.calls[0][0] as string;
    expect(line.split("\n")).toHaveLength(1);
    const parsed = JSON.parse(line);
    expect(parsed.correlation_id).toBe("c1");
    expect(parsed.service).toBe("model-gateway");
    expect(parsed.prompt).toBeUndefined();
    expect(parsed.authorization).toBeUndefined();
    expect(line).not.toContain("secret");
  });
});
