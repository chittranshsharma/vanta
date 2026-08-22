import { describe, expect, it, vi } from "vitest";
import { processJob, runLoop, type WorkerDeps, type WorkerJob } from "./loop.js";

function job(overrides: Partial<WorkerJob> = {}): WorkerJob {
  return {
    id: "j1",
    workspace_id: "w1",
    job_type: "campaign_csv_normalize",
    status: "running",
    payload: {},
    attempts: 1,
    max_attempts: 3,
    correlation_id: "c1",
    ...overrides,
  };
}

function deps(overrides: Partial<WorkerDeps> = {}): WorkerDeps {
  return {
    workerId: "w-test",
    jobTypes: ["campaign_csv_normalize"],
    releaseStale: vi.fn().mockResolvedValue(0),
    claim: vi.fn().mockResolvedValue(null),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
    handlers: {},
    log: vi.fn(),
    sleep: vi.fn().mockResolvedValue(undefined),
    now: () => 0,
    ...overrides,
  };
}

describe("processJob", () => {
  it("completes with the handler result", async () => {
    const d = deps({ handlers: { campaign_csv_normalize: async () => ({ ok: true, result: { rows: 3 } }) } });
    expect(await processJob(d, job(), 1000)).toBe("succeeded");
    expect(d.complete).toHaveBeenCalledWith(expect.objectContaining({ id: "j1" }), { rows: 3 });
    expect(d.fail).not.toHaveBeenCalled();
  });

  it("fails with the handler's failure kind", async () => {
    const d = deps({ handlers: { campaign_csv_normalize: async () => ({ ok: false, failure: { kind: "permanent", message: "bad csv" } }) } });
    expect(await processJob(d, job(), 1000)).toBe("failed");
    expect(d.fail).toHaveBeenCalledWith(expect.anything(), { kind: "permanent", message: "bad csv" });
  });

  it("converts a thrown handler error into a transient failure", async () => {
    const d = deps({ handlers: { campaign_csv_normalize: async () => { throw new Error("boom"); } } });
    await processJob(d, job(), 1000);
    expect(d.fail).toHaveBeenCalledWith(expect.anything(), { kind: "transient", message: "boom", code: "exception" });
  });

  it("fails permanently when no handler is registered so the job cannot loop", async () => {
    const d = deps();
    expect(await processJob(d, job(), 1000)).toBe("unhandled");
    expect(d.fail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ kind: "permanent" }));
  });

  it("times out a slow handler as a transient failure", async () => {
    const never = () => new Promise<never>(() => {});
    const d = deps({
      handlers: { campaign_csv_normalize: never },
      // sleep resolves immediately, simulating the timeout firing first
      sleep: vi.fn().mockResolvedValue(undefined),
    });
    expect(await processJob(d, job(), 10)).toBe("failed");
    expect(d.fail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ code: "timeout", kind: "transient" }));
  });
});

describe("runLoop", () => {
  it("releases stale locks on startup, polls, and stops", async () => {
    const d = deps({ releaseStale: vi.fn().mockResolvedValue(2) });
    await runLoop(d, { pollIntervalMs: 1, shouldStop: () => false, maxIterations: 3 });
    expect(d.releaseStale).toHaveBeenCalledTimes(1);
    expect(d.claim).toHaveBeenCalledTimes(3);
    expect(d.log).toHaveBeenCalledWith("warn", "released stale locks", { count: 2 });
  });

  it("processes a claimed job and keeps going after a claim error", async () => {
    const claim = vi.fn().mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce(job()).mockResolvedValue(null);
    const d = deps({ claim, handlers: { campaign_csv_normalize: async () => ({ ok: true, result: {} }) } });
    await runLoop(d, { pollIntervalMs: 1, shouldStop: () => false, maxIterations: 3 });
    expect(d.complete).toHaveBeenCalledTimes(1);
    expect(d.log).toHaveBeenCalledWith("error", "claim failed", expect.anything());
  });

  it("does not crash when finalization fails; logs and continues", async () => {
    const d = deps({
      claim: vi.fn().mockResolvedValueOnce(job()).mockResolvedValue(null),
      complete: vi.fn().mockRejectedValue(new Error("rpc failed")),
      handlers: { campaign_csv_normalize: async () => ({ ok: true, result: {} }) },
    });
    await runLoop(d, { pollIntervalMs: 1, shouldStop: () => false, maxIterations: 2 });
    expect(d.log).toHaveBeenCalledWith("error", "job finalization failed", expect.anything());
  });
});
