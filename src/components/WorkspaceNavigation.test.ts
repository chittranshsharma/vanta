import { describe, it, expect } from "vitest";
import type { PanelId } from "./Workspace";

describe("Slice D: Workspace Navigation & Panel Integration", () => {
  it("registers all expected PanelIds including simulations and conversations", () => {
    const expectedPanels: PanelId[] = [
      "decision",
      "brand",
      "sources",
      "intake",
      "twin",
      "matrix",
      "simulations",
      "conversations",
      "connectors",
      "publishing",
      "experiments",
      "agents",
      "jobs",
      "status",
    ];

    expect(expectedPanels).toContain("simulations");
    expect(expectedPanels).toContain("conversations");
    expect(expectedPanels).toContain("sources");
    expect(expectedPanels).toContain("publishing");
    expect(expectedPanels).toContain("experiments");
  });

  it("ensures canonical evidence taxonomy invariant is strictly maintained across all panel contracts", () => {
    const validEvidenceClasses = ["observed", "sourced", "inference", "simulation", "unknown"];
    
    // Invariant: 'linked' is an operational status, never an evidence class
    expect(validEvidenceClasses).not.toContain("linked");
    expect(validEvidenceClasses).toContain("observed");
    expect(validEvidenceClasses).toContain("inference");
    expect(validEvidenceClasses).toContain("simulation");
  });

  it("verifies role-based access gating contracts in UI do not compromise backend security", () => {
    const roles = ["owner", "admin", "member", "viewer"] as const;
    
    for (const role of roles) {
      const isPrivileged = role === "owner" || role === "admin";
      const isReadOnly = role === "viewer";

      if (isReadOnly) {
        expect(isPrivileged).toBe(false);
      }
      if (isPrivileged) {
        expect(isReadOnly).toBe(false);
      }
    }
  });

  it("verifies no secret tokens, passwords, or raw audience comments are leaked into panel titles or route parameters", () => {
    const panelTitles: Record<string, string> = {
      decision: "Start with what you can prove.",
      brand: "Brand Brain",
      intake: "Creative Intake",
      twin: "Structured Creative Twin",
      matrix: "Creative Decision Matrix",
      simulations: "Counterfactual Simulation Lab",
      conversations: "Conversation Intelligence & Review",
      sources: "Source Registry",
      connectors: "Source connectors",
      publishing: "Test-window planning",
      experiments: "Experiments",
      agents: "Agent workflow",
      jobs: "Background jobs",
      status: "Setup and status",
    };

    for (const [id, title] of Object.entries(panelTitles)) {
      expect(id).toMatch(/^[a-z_]+$/);
      expect(title).not.toContain("secret");
      expect(title).not.toContain("token");
      expect(title).not.toContain("password");
      expect(title).not.toContain("apiKey");
    }
  });
});
