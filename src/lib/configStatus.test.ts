import { describe, expect, it } from "vitest";
import { deriveConfigStatus, gatewayItemFromProbe } from "./configStatus";

describe("deriveConfigStatus", () => {
  it("reports missing Supabase and disabled flags without guessing", () => {
    const items = deriveConfigStatus({ supabaseConfigured: false, flagsOn: new Set(), telemetryEndpoint: undefined, appVersion: undefined });
    expect(items.find((i) => i.id === "supabase")?.state).toBe("missing");
    expect(items.find((i) => i.id === "gateway")?.state).toBe("unknown");
    expect(items.find((i) => i.id === "telemetry")?.state).toBe("disabled");
    expect(items.filter((i) => i.id.startsWith("flag:")).every((i) => i.state === "disabled")).toBe(true);
    expect(items.every((i) => i.basis === "static")).toBe(true);
  });

  it("marks enabled flags as configured", () => {
    const items = deriveConfigStatus({ supabaseConfigured: true, flagsOn: new Set(["jobs_panel"]), telemetryEndpoint: "https://t", appVersion: "1.0" });
    expect(items.find((i) => i.id === "flag:jobs_panel")?.state).toBe("configured");
    expect(items.find((i) => i.id === "flag:video_intake")?.state).toBe("disabled");
    expect(items.find((i) => i.id === "supabase")?.detail).toMatch(/not verified/);
  });

  it("reports retrieval as missing regardless of configuration, because nothing in this build indexes", () => {
    // A configured Supabase project does not make retrieval work: the embedding
    // store exists and stays empty, no provider is chosen, and no worker indexes.
    for (const supabaseConfigured of [false, true]) {
      const items = deriveConfigStatus({ supabaseConfigured, flagsOn: new Set(), telemetryEndpoint: undefined, appVersion: undefined });
      const retrieval = items.find((i) => i.id === "retrieval");
      expect(retrieval?.state).toBe("missing");
      expect(retrieval?.basis).toBe("static");
      expect(retrieval?.detail).toMatch(/covers nothing/);
    }
  });
});

describe("gatewayItemFromProbe", () => {
  it("keeps the typed error visible on failure", () => {
    const item = gatewayItemFromProbe({ success: false, error: "gateway_not_configured", message: "x" });
    expect(item.state).toBe("missing");
    expect(item.basis).toBe("live");
    expect(item.detail).toContain("gateway_not_configured");
  });
  it("treats an unknown error code as unknown, not healthy", () => {
    expect(gatewayItemFromProbe({ success: false, error: "weird", message: "m" }).state).toBe("unknown");
    expect(gatewayItemFromProbe({ success: true }).state).toBe("configured");
  });
});
