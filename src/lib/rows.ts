import type { Json } from "../types/database.types";

/**
 * Boundary readers for generated Supabase row types.
 *
 * Generated types cannot express CHECK constraints or jsonb shape: every
 * constrained text column arrives as `string` and every jsonb column arrives as
 * `Json`. Casting those to a domain union would be the client asserting
 * something it has not checked, which is the one thing Vanta must not do with
 * data. These helpers check instead, and hand back `null` when the value is not
 * one this build understands, so the caller can report the disagreement rather
 * than render a guess.
 */

/**
 * A jsonb value the client is allowed to write. Reads widen to
 * `Record<string, unknown>`, but a write has to be something Postgres can
 * actually store, so callers that build a payload must satisfy this.
 */
export type JsonObject = { [key: string]: Json | undefined };

/**
 * Returns the matching member of `allowed`, or `null` when `value` is not one of
 * them. Used to narrow a DB text column to its domain union.
 */
export function narrow<T extends string>(allowed: readonly T[], value: string | null | undefined): T | null {
  if (value === null || value === undefined) return null;
  for (const candidate of allowed) {
    if (candidate === value) return candidate;
  }
  return null;
}

/** A jsonb column read as an object. Arrays, scalars and null all read as `null`. */
export function jsonObject(value: Json | null | undefined): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}

/** A jsonb column read as a list of objects. Non-array input reads as `[]`; non-object members are dropped. */
export function jsonObjectArray(value: Json | null | undefined): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  const out: Array<Record<string, unknown>> = [];
  for (const item of value) {
    const object = jsonObject(item);
    if (object) out.push(object);
  }
  return out;
}

/**
 * True when a Postgres error means the relation is absent, i.e. a migration
 * this build expects has not been applied to the environment it is talking to.
 * That is a known repository state, not a read failure, and the UI says so.
 */
export function isMissingRelationError(error: { message: string; code?: string } | null): boolean {
  if (!error) return false;
  return error.code === "42P01" || /does not exist|42P01|schema cache/i.test(error.message);
}
