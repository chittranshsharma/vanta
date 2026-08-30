import { describe, expect, it } from "vitest";
import {
  JOB_STATUSES,
  JOB_TYPES,
  TERMINAL_STATUSES,
  TRANSITIONS,
  canTransition,
  decideOnFailure,
  idempotencyKey,
  initialStatus,
  requiresApproval,
  retryDelaySeconds,
  type JobStatus,
} from "./policy";

/**
 * The permitted transition set, frozen.
 *
 * This is deliberately a second copy of `TRANSITIONS`, not a derivation of it: a
 * test that reads the table it is checking proves only that the table equals
 * itself. Editing `TRANSITIONS` therefore fails these tests until this literal
 * is edited too, which is the point — a status change is a contract change, and
 * migration 011 enforces the same machine in SQL. Changing one without the other
 * puts the browser and the database into disagreement about what a job may do.
 *
 * Typed as plain strings so a status added to the `JobStatus` union fails the
 * test run, not only the typecheck.
 */
const PERMITTED: Readonly<Record<string, readonly string[]>> = {
  awaiting_approval: ["queued", "cancelled"],
  queued: ["running", "cancelled"],
  running: ["succeeded", "queued", "dead"],
  succeeded: [],
  failed: ["queued", "dead"],
  dead: [],
  cancelled: [],
};

/** Statuses that must never have an outgoing transition. */
const PERMITTED_TERMINAL: readonly string[] = ["succeeded", "dead", "cancelled"];

describe("job status contract", () => {
  it("declares transition behaviour for exactly the known statuses", () => {
    // A status added to JOB_STATUSES without an entry here (or in TRANSITIONS)
    // would otherwise reach `TRANSITIONS[from]` as undefined and throw at
    // runtime inside canTransition.
    expect([...JOB_STATUSES].sort()).toEqual(Object.keys(PERMITTED).sort());
    expect(Object.keys(TRANSITIONS).sort()).toEqual(Object.keys(PERMITTED).sort());
  });

  it("permits exactly the recorded transitions and no others", () => {
    for (const from of JOB_STATUSES) {
      expect([...TRANSITIONS[from]].sort()).toEqual([...PERMITTED[from]].sort());
    }
  });

  it("never targets a status this build does not know", () => {
    for (const targets of Object.values(TRANSITIONS)) {
      for (const to of targets) expect(JOB_STATUSES).toContain(to);
    }
  });

  it("agrees with canTransition on every ordered pair", () => {
    // Guards the function as well as the table: a permissive canTransition would
    // accept an illegal transition even with the table untouched.
    for (const from of JOB_STATUSES) {
      for (const to of JOB_STATUSES) {
        expect(canTransition(from, to)).toBe(PERMITTED[from].includes(to));
      }
    }
  });

  it("keeps terminal status and transitionability in step, in both directions", () => {
    expect([...TERMINAL_STATUSES].sort()).toEqual([...PERMITTED_TERMINAL].sort());
    for (const status of JOB_STATUSES) {
      const terminal = TERMINAL_STATUSES.has(status);
      expect(TRANSITIONS[status].length === 0).toBe(terminal);
      if (terminal) {
        for (const to of JOB_STATUSES) expect(canTransition(status, to)).toBe(false);
      }
    }
  });

  it("has no status that can never be reached or left", () => {
    // `failed` is reachable only from the worker's fail path, which writes it
    // directly rather than transitioning into it, so it is exempt.
    const reachable = new Set<JobStatus>(["awaiting_approval", "queued", "failed"]);
    for (const targets of Object.values(TRANSITIONS)) for (const to of targets) reachable.add(to);
    for (const status of JOB_STATUSES) expect(reachable.has(status)).toBe(true);
  });
});

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
    expect(JOB_TYPES).toHaveLength(14);
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
