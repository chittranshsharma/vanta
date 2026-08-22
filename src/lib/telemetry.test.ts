import { describe, expect, it, vi } from "vitest";
import { buildClientErrorEvent, reportClientError, scrub } from "./telemetry";

describe("scrub", () => {
  it("redacts emails, JWTs, and bearer tokens", () => {
    const s = scrub("user a@b.co token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abcdefghijklmnop Bearer abc.def");
    expect(s).not.toContain("a@b.co");
    expect(s).toContain("[email]");
    expect(s).toContain("[jwt]");
    expect(s).toMatch(/bearer \[redacted\]/i);
  });
});

describe("buildClientErrorEvent", () => {
  it("keeps the event small, scrubbed, and id-free in routes", () => {
    const err = new Error("failed for x@y.z");
    const ev = buildClientErrorEvent(err, "corr", "/w/11111111-2222-3333-4444-555555555555/twin", "1.2.3", new Date("2026-08-23T00:00:00Z"));
    expect(ev.message).toBe("failed for [email]");
    expect(ev.route).toBe("/w/[id]/twin");
    expect(ev.stack_head?.split("\n").length).toBeLessThanOrEqual(5);
    expect(ev.at).toBe("2026-08-23T00:00:00.000Z");
  });
});

describe("reportClientError", () => {
  it("posts to the endpoint when configured and swallows failures", async () => {
    const ev = buildClientErrorEvent(new Error("x"), "c", "/", "v");
    const ok = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await reportClientError(ev, "https://t.example/ingest", ok as unknown as typeof fetch);
    expect(ok).toHaveBeenCalledTimes(1);
    const failing = vi.fn().mockRejectedValue(new Error("net"));
    await expect(reportClientError(ev, "https://t.example/ingest", failing as unknown as typeof fetch)).resolves.toBeUndefined();
  });

  it("does nothing beyond the console without an endpoint", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const f = vi.fn();
    await reportClientError(buildClientErrorEvent(new Error("x"), "c", "/", "v"), undefined, f as unknown as typeof fetch);
    expect(f).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
  });
});
