import { describe, expect, it } from "vitest";
import { ALL_CLIENT_FLAGS, parseFlags } from "./flags";

describe("client flags", () => {
  it("everything is off by default", () => {
    expect(parseFlags(undefined).size).toBe(0);
    expect(parseFlags("").size).toBe(0);
  });

  it("enables only named, known flags", () => {
    const on = parseFlags(" claim_grounding_panel , video_intake,bogus ");
    expect([...on].sort()).toEqual(["claim_grounding_panel", "video_intake"]);
  });

  it("flag list is closed", () => {
    expect(ALL_CLIENT_FLAGS).toHaveLength(4);
  });
});
