import { describe, expect, it } from "vitest";
import {
  JOB_TYPES,
  TERMINAL_STATUSES,
  TRANSITIONS,
  canTransition,
  decideOnFailure,
  idempotencyKey,
  initialStatus,
  requiresApproval,
  retryDelaySeconds,
} from "./policy";

describe("job state machine", () => {
  it("terminal states have no outgoing transitions", () => {
    for (const s of TERMINAL_STATUSES) expect(TRANSITIONS[s]).toEqual([]);
  });

  it("running can only succeed, requeue, or die", () => {
    expect(canTransition("running", "succeeded")).toBe(true);
    expect(canTransition("running", "queued")).toBe(true);
    expect(canTransition("running", "dead")).toBe(true);
    expect(canTransition("running", "cancelled")).toBe(false);
    expect(canTransition("running", "awaiting_approval")).toBe(false);
  });

  it("only queued or awaiting jobs can be cancelled", () => {
    expect(canTransition("queued", "cancelled")).toBe(true);
    expect(canTransition("awaiting_approval", "cancelled")).toBe(true);
    expect(canTransition("succeeded", "cancelled")).toBe(false);
  });
});

describe("approval gate", () => {
  it("external-side-effect job types start awaiting approval", () => {
    expect(requiresApproval("source_refresh")).toBe(true);
    expect(initialStatus("source_refresh")).toBe("awaiting_approval");
    expect(initialStatus("model_task")).toBe("queued");
  });

  it("every job type is known", () => {
    expect(JOB_TYPES).toHaveLength(5);
  });
});

describe("retry policy", () => {
  it("backoff grows exponentially and is capped at 15 minutes", () => {
    const max = () => 0.999999;
    expect(retryDelaySeconds(1, max)).toBe(29);
    expect(retryDelaySeconds(2, max)).toBe(59);
    expect(retryDelaySeconds(3, max)).toBe(119);
    expect(retryDelaySeconds(20, max)).toBe(899);
  });

  it("never returns less than one second", () => {
    expect(retryDelaySeconds(1, () => 0)).toBe(1);
  });

  it("permanent failures go dead immediately", () => {
    expect(decideOnFailure({ attempts: 1, maxAttempts: 3, kind: "permanent" })).toEqual({ nextStatus: "dead", retryDelaySeconds: 0 });
  });

  it("transient failures requeue until max attempts, then dead", () => {
    const r = () => 0.5;
    expect(decideOnFailure({ attempts: 1, maxAttempts: 3, kind: "transient", random: r }).nextStatus).toBe("queued");
    expect(decideOnFailure({ attempts: 2, maxAttempts: 3, kind: "transient", random: r }).nextStatus).toBe("queued");
    expect(decideOnFailure({ attempts: 3, maxAttempts: 3, kind: "transient", random: r })).toEqual({ nextStatus: "dead", retryDelaySeconds: 0 });
  });
});

describe("idempotencyKey", () => {
  it("is stable regardless of key order", () => {
    expect(idempotencyKey("model_task", { twin: "t1", task: "x" })).toBe(idempotencyKey("model_task", { task: "x", twin: "t1" }));
  });

  it("differs across job types and inputs", () => {
    expect(idempotencyKey("model_task", { a: 1 })).not.toBe(idempotencyKey("media_probe", { a: 1 }));
    expect(idempotencyKey("model_task", { a: 1 })).not.toBe(idempotencyKey("model_task", { a: 2 }));
  });
});
