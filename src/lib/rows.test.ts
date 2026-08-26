import { describe, expect, it } from "vitest";
import {
  classifyReadError,
  isMissingRelationError,
  isPermissionDeniedError,
  isRetryable,
  isRetryableRead,
  isTransientReadError,
  jsonObject,
  jsonObjectArray,
  narrow,
  readFailureSummary,
  readRows,
  UNCONFIGURED_READ,
  type ReadFailure
} from "./rows";

const STATUSES = ["queued", "running", "succeeded"] as const;

describe("narrow", () => {
  it("returns the allowed member for a known value", () => {
    expect(narrow(STATUSES, "running")).toBe("running");
  });

  it("returns null for a value this build does not know", () => {
    // A status added by a later migration must not be reported as some nearby
    // status the client happens to understand.
    expect(narrow(STATUSES, "quarantined")).toBeNull();
  });

  it("returns null for null and undefined", () => {
    expect(narrow(STATUSES, null)).toBeNull();
    expect(narrow(STATUSES, undefined)).toBeNull();
  });

  it("does not match on case or whitespace", () => {
    expect(narrow(STATUSES, "Running")).toBeNull();
    expect(narrow(STATUSES, " running")).toBeNull();
  });
});

describe("jsonObject", () => {
  it("reads an object", () => {
    expect(jsonObject({ a: 1 })).toEqual({ a: 1 });
  });

  it("rejects arrays, scalars, and null", () => {
    expect(jsonObject([1, 2])).toBeNull();
    expect(jsonObject("text")).toBeNull();
    expect(jsonObject(7)).toBeNull();
    expect(jsonObject(false)).toBeNull();
    expect(jsonObject(null)).toBeNull();
    expect(jsonObject(undefined)).toBeNull();
  });
});

describe("jsonObjectArray", () => {
  it("reads a list of objects", () => {
    expect(jsonObjectArray([{ a: 1 }, { b: 2 }])).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("drops members that are not objects", () => {
    expect(jsonObjectArray([{ a: 1 }, "text", 3, null, [4]])).toEqual([{ a: 1 }]);
  });

  it("reads non-array input as empty", () => {
    expect(jsonObjectArray({ a: 1 })).toEqual([]);
    expect(jsonObjectArray(null)).toEqual([]);
    expect(jsonObjectArray(undefined)).toEqual([]);
  });
});

describe("isMissingRelationError", () => {
  it("matches the Postgres undefined_table code", () => {
    expect(isMissingRelationError({ message: "boom", code: "42P01" })).toBe(true);
  });

  it("matches the messages PostgREST returns when a relation is absent", () => {
    expect(isMissingRelationError({ message: 'relation "public.experiments" does not exist' })).toBe(true);
    expect(isMissingRelationError({ message: "Could not find the table in the schema cache" })).toBe(true);
  });

  it("does not match an ordinary failure", () => {
    // A permission denial is not a pending migration, and must not be reported
    // as one: the row exists and the caller is not allowed to read it.
    expect(isMissingRelationError({ message: "permission denied for table experiments", code: "42501" })).toBe(false);
  });

  it("is false for no error", () => {
    expect(isMissingRelationError(null)).toBe(false);
  });
});

describe("isPermissionDeniedError", () => {
  it("matches the Postgres insufficient_privilege code", () => {
    expect(isPermissionDeniedError({ message: "boom", code: "42501" })).toBe(true);
  });

  it("matches the PostgREST JWT-rejected code", () => {
    expect(isPermissionDeniedError({ message: "JWT expired", code: "PGRST301" })).toBe(true);
  });

  it("matches the membership check raised by SECURITY DEFINER functions", () => {
    // consume_quota, cancel_job and approve_job all raise this text rather than
    // relying on a policy, so the message is the only signal.
    expect(isPermissionDeniedError({ message: "Access denied: not a workspace member" })).toBe(true);
  });

  it("does not match a pending migration", () => {
    expect(isPermissionDeniedError({ message: 'relation "public.jobs" does not exist', code: "42P01" })).toBe(false);
  });

  it("is false for no error", () => {
    expect(isPermissionDeniedError(null)).toBe(false);
  });
});

describe("classifyReadError", () => {
  it("classifies an absent relation as absent", () => {
    expect(classifyReadError({ message: "Could not find the table in the schema cache" })).toBe("absent");
  });

  it("classifies a missing function as absent, because PostgREST reports it the same way", () => {
    expect(classifyReadError({ message: "Could not find the function public.retrieval_coverage in the schema cache" })).toBe("absent");
  });

  it("classifies an authorization refusal as denied", () => {
    expect(classifyReadError({ message: "permission denied for table workspace_quotas", code: "42501" })).toBe("denied");
  });

  it("prefers denied when an error looks like both", () => {
    // A revoked grant on a table the caller cannot see can produce a message
    // naming both. Reporting "not applied" would send an operator to apply a
    // migration that is already there.
    expect(classifyReadError({ message: "permission denied for relation that does not exist", code: "42501" })).toBe("denied");
  });

  it("classifies anything else as failed, so the message survives", () => {
    expect(classifyReadError({ message: "canceling statement due to statement timeout" })).toBe("failed");
  });

  it("classifies a request that never arrived as offline", () => {
    // The browser produced this without reaching Postgres, so nothing was read
    // and nothing was written. Retrying is the recovery.
    expect(classifyReadError({ message: "TypeError: Failed to fetch" })).toBe("offline");
    expect(classifyReadError({ message: "NetworkError when attempting to fetch resource." })).toBe("offline");
    expect(classifyReadError({ message: "Load failed" })).toBe("offline");
    expect(classifyReadError({ message: "connect ECONNREFUSED 127.0.0.1:54321" })).toBe("offline");
    expect(classifyReadError({ message: "Bad gateway", code: "502" })).toBe("offline");
  });

  it("prefers denied over offline, because an expired token is not a network problem", () => {
    // Retrying an expired JWT fails the same way. The recovery is a new session,
    // not another attempt.
    expect(classifyReadError({ message: "JWT expired: failed to fetch key", code: "PGRST301" })).toBe("denied");
  });
});

describe("isTransientReadError", () => {
  it("is false for no error and for a database-side failure", () => {
    expect(isTransientReadError(null)).toBe(false);
    expect(isTransientReadError({ message: "permission denied for table brands", code: "42501" })).toBe(false);
    expect(isTransientReadError({ message: 'relation "public.jobs" does not exist', code: "42P01" })).toBe(false);
  });

  it("does not treat a server-side statement timeout as offline", () => {
    // The request arrived and Postgres did work before aborting, so the "nothing
    // was attempted" copy an offline state licenses would be false.
    expect(isTransientReadError({ message: "canceling statement due to statement timeout", code: "57014" })).toBe(false);
  });
});

describe("isRetryable", () => {
  it("invites a retry only where another attempt can plausibly succeed", () => {
    expect(isRetryable("offline")).toBe(true);
    // `failed` is the unclassified bucket; some of it clears on a second attempt.
    expect(isRetryable("failed")).toBe(true);
  });

  it("does not invite a retry for a refusal or a missing relation", () => {
    // Offering "try again" here spends the user's one action on an attempt that
    // is guaranteed to fail the same way.
    expect(isRetryable("denied")).toBe(false);
    expect(isRetryable("absent")).toBe(false);
  });

  it("covers every failure class, so a new one must decide deliberately", () => {
    const classes: ReadFailure[] = ["absent", "denied", "offline", "failed"];
    for (const c of classes) expect(typeof isRetryable(c)).toBe("boolean");
    expect(classes.filter(isRetryable)).toEqual(["offline", "failed"]);
  });
});

describe("readRows", () => {
  it("returns the rows a successful read produced", () => {
    const result = readRows({ data: [{ id: "a" }], error: null }, []);
    expect(result.error).toBeNull();
    expect(result.data).toEqual([{ id: "a" }]);
  });

  it("treats a null payload on a successful read as genuinely no rows", () => {
    // PostgREST returns null rather than [] for some shapes. That is a real
    // empty result, not a failure, and must not be reported as one.
    const result = readRows<{ id: string }[]>({ data: null, error: null }, []);
    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  it("never reports a failed read as an empty list", () => {
    const result = readRows({ data: null, error: { message: "permission denied for table source_registry", code: "42501" } }, []);
    expect(result.data).toBeNull();
    expect(result.error).toEqual({ failure: "denied", message: "permission denied for table source_registry" });
  });

  it("keeps the failure class the error text implies", () => {
    expect(readRows({ data: null, error: { message: "Failed to fetch" } }, []).error?.failure).toBe("offline");
    expect(readRows({ data: null, error: { message: "relation does not exist", code: "42P01" } }, []).error?.failure).toBe("absent");
    expect(readRows({ data: null, error: { message: "unexpected trigger error" } }, []).error?.failure).toBe("failed");
  });

  it("reports an unconfigured build as its own class, not as a failed query", () => {
    // Nothing was asked, so nothing failed. Copy for a query error would blame
    // the wrong thing and offer the wrong recovery.
    expect(UNCONFIGURED_READ.data).toBeNull();
    expect(UNCONFIGURED_READ.error.failure).toBe("unconfigured");
  });
});

describe("readFailureSummary", () => {
  it("names the recovery that applies instead of a generic retry", () => {
    expect(readFailureSummary({ failure: "denied", message: "permission denied" }, "the source registry")).toContain("Ask an admin");
    expect(readFailureSummary({ failure: "unconfigured", message: "no project" }, "the source registry")).toContain("not configured");
    expect(readFailureSummary({ failure: "offline", message: "Failed to fetch" }, "the source registry")).toContain("try again");
  });

  it("states that nothing changed when the request never arrived", () => {
    const summary = readFailureSummary({ failure: "offline", message: "Failed to fetch" }, "this workspace's intake records");
    expect(summary).toContain("nothing was changed");
  });

  it("keeps the underlying message for the classes where it is the only detail", () => {
    expect(readFailureSummary({ failure: "failed", message: "statement timeout" }, "the registry")).toContain("statement timeout");
    expect(readFailureSummary({ failure: "absent", message: "relation does not exist" }, "the registry")).toContain("relation does not exist");
  });

  it("never renders a failed read as an empty result", () => {
    const classes = ["absent", "denied", "offline", "failed", "unconfigured"] as const;
    for (const failure of classes) {
      const summary = readFailureSummary({ failure, message: "detail" }, "the source registry");
      expect(summary.length).toBeGreaterThan(0);
      expect(summary).not.toMatch(/^no sources|no evidence|no assets/i);
    }
  });
});

describe("isRetryableRead", () => {
  it("offers a retry for a request that may succeed on a second attempt", () => {
    expect(isRetryableRead({ failure: "offline", message: "Failed to fetch" })).toBe(true);
    expect(isRetryableRead({ failure: "failed", message: "statement timeout" })).toBe(true);
  });

  it("does not offer a retry for a refusal, a missing relation, or a missing project", () => {
    expect(isRetryableRead({ failure: "denied", message: "permission denied" })).toBe(false);
    expect(isRetryableRead({ failure: "absent", message: "does not exist" })).toBe(false);
    // No amount of retrying gives this build a Supabase project to read from.
    expect(isRetryableRead({ failure: "unconfigured", message: "not configured" })).toBe(false);
  });
});
