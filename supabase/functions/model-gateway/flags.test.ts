import { describe, expect, it } from "vitest";
import { isTaskEnabled, parseEnabledTasks } from "./flags.ts";

describe("task flags", () => {
  it("enables only the health check when ENABLED_TASKS is unset or empty", () => {
    expect([...parseEnabledTasks(undefined)]).toEqual(["gateway_health_check"]);
    expect([...parseEnabledTasks("")]).toEqual(["gateway_health_check"]);
    expect(isTaskEnabled("claim_grounding_audit", undefined)).toBe(false);
  });

  it("enables a user-content task only when the operator names it", () => {
    expect(isTaskEnabled("claim_grounding_audit", "claim_grounding_audit")).toBe(true);
    expect(isTaskEnabled("claim_grounding_audit", " gateway_health_check , claim_grounding_audit ")).toBe(true);
  });

  it("ignores unknown names so a typo cannot enable anything", () => {
    expect([...parseEnabledTasks("claim_grounding_audti,persona_simulation")]).toEqual(["gateway_health_check"]);
  });

  it("health check cannot be disabled", () => {
    expect(isTaskEnabled("gateway_health_check", "claim_grounding_audit")).toBe(true);
  });
});
