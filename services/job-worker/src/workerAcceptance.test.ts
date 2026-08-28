import { describe, expect, it, vi } from "vitest";
import { decideOnFailure, type JobType } from "../../../shared/jobs/policy.js";
import { processJob, runLoop, type WorkerDeps, type WorkerJob } from "./loop.js";

function makeTestJob(overrides: Partial<WorkerJob> = {}): WorkerJob {
  return {
    id: "job-acc-101",
    workspace_id: "ws-test-1",
    job_type: "conversation_import_validate",
    status: "running",
    payload: { batch_id: "b-test-1" },
    attempts: 1,
    max_attempts: 3,
    correlation_id: "corr-test-101",
    ...overrides,
  };
}

function makeMockDeps(overrides: Partial<WorkerDeps> = {}): WorkerDeps {
  return {
    workerId: "test-worker-node",
    jobTypes: [
      "campaign_csv_normalize",
      "media_probe",
      "embedding_refresh",
      "source_refresh",
      "conversation_import_validate",
      "conversation_deduplicate",
      "conversation_interpretation_proposal",
      "conversation_attribution",
      "conversation_aggregate",
    ] as JobType[],
    releaseStale: vi.fn().mockResolvedValue(0),
    claim: vi.fn().mockResolvedValue(null),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
    handlers: {},
    log: vi.fn(),
    sleep: vi.fn().mockResolvedValue(undefined),
    now: () => Date.now(),
    ...overrides,
  };
}

describe("Worker Acceptance: Handler Registry and Job Safety", () => {
  it("rejects unknown job types permanently so they never enter an infinite loop", async () => {
    const deps = makeMockDeps({ handlers: {} });
    const unknownJob = makeTestJob({ job_type: "unknown_future_job" as unknown as JobType });

    const outcome = await processJob(deps, unknownJob, 1000);

    expect(outcome).toBe("unhandled");
    expect(deps.fail).toHaveBeenCalledWith(
      unknownJob,
      expect.objectContaining({ kind: "permanent", message: expect.stringContaining("no handler") })
    );
    expect(deps.log).toHaveBeenCalledWith("error", "no handler registered", expect.anything());
  });

  it("classifies transient failures as retryable and calculates exponential backoff", () => {
    const fixedRandom = () => 0.5;
    const attempt1 = decideOnFailure({ attempts: 1, maxAttempts: 3, kind: "transient", random: fixedRandom });
    expect(attempt1.nextStatus).toBe("queued");
    expect(attempt1.retryDelaySeconds).toBe(15);

    const attempt2 = decideOnFailure({ attempts: 2, maxAttempts: 3, kind: "transient", random: fixedRandom });
    expect(attempt2.nextStatus).toBe("queued");
    expect(attempt2.retryDelaySeconds).toBe(30);

    const attempt3 = decideOnFailure({ attempts: 3, maxAttempts: 3, kind: "transient", random: fixedRandom });
    expect(attempt3.nextStatus).toBe("dead");
    expect(attempt3.retryDelaySeconds).toBe(0);
  });

  it("classifies permanent failures as immediate dead-letter states without retry", () => {
    const decision = decideOnFailure({ attempts: 1, maxAttempts: 3, kind: "permanent" });
    expect(decision.nextStatus).toBe("dead");
    expect(decision.retryDelaySeconds).toBe(0);
  });

  it("releases stale locks on startup", async () => {
    const releaseStale = vi.fn().mockResolvedValue(3);
    const deps = makeMockDeps({ releaseStale });

    await runLoop(deps, { pollIntervalMs: 1, shouldStop: () => true, maxIterations: 1 });

    expect(releaseStale).toHaveBeenCalledTimes(1);
    expect(deps.log).toHaveBeenCalledWith("warn", "released stale locks", { count: 3 });
  });

  it("shuts down gracefully when shouldStop returns true without crashing", async () => {
    let stop = false;
    const claim = vi.fn().mockImplementation(async () => {
      stop = true;
      return null;
    });

    const deps = makeMockDeps({ claim });
    await runLoop(deps, { pollIntervalMs: 1, shouldStop: () => stop, maxIterations: 5 });

    expect(claim).toHaveBeenCalledTimes(1);
  });

  it("sanitizes logged metadata and never includes raw customer content or secrets", async () => {
    const logs: Array<{ level: string; msg: string; fields?: Record<string, unknown> }> = [];
    const deps = makeMockDeps({
      handlers: {
        conversation_import_validate: async () => ({
          ok: true,
          result: { valid_count: 5, status: "completed" },
        }),
      },
      log: (level, msg, fields) => logs.push({ level, msg, fields }),
    });

    const job = makeTestJob({
      payload: { raw_secret: "secret-token-123", raw_customer_text: "Very confidential comment" },
    });

    const outcome = await processJob(deps, job, 1000);

    expect(outcome).toBe("succeeded");
    expect(logs).toHaveLength(1);
    const entry = logs[0];
    expect(entry.level).toBe("info");
    expect(entry.msg).toBe("job succeeded");
    expect(entry.fields).toEqual({
      job_id: "job-acc-101",
      job_type: "conversation_import_validate",
      workspace_id: "ws-test-1",
      attempt: 1,
      correlation_id: "corr-test-101",
    });
    // Ensure no payload fields leaked
    expect(JSON.stringify(entry)).not.toContain("secret-token-123");
    expect(JSON.stringify(entry)).not.toContain("Very confidential comment");
  });
});
