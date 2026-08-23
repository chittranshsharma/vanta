import { describe, expect, it } from "vitest";
import { isMissingRelationError, jsonObject, jsonObjectArray, narrow } from "./rows";

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
