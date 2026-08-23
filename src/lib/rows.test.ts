import { describe, expect, it } from "vitest";
import { classifyReadError, isMissingRelationError, isPermissionDeniedError, jsonObject, jsonObjectArray, narrow } from "./rows";

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
    expect(classifyReadError({ message: "TypeError: Failed to fetch" })).toBe("failed");
  });
});
