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

/**
 * True when a Postgres or PostgREST error means the caller is not allowed to see
 * the rows, as opposed to the rows being absent. Row-level security makes those
 * two look alike from the browser — a denied SELECT usually returns an empty set
 * rather than an error — so the cases that *do* raise are worth naming: a
 * revoked grant, a `SECURITY DEFINER` function that checks membership itself, or
 * an expired token. "No rows" and "not allowed to see rows" must never be shown
 * as the same thing.
 */
export function isPermissionDeniedError(error: { message: string; code?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "42501" || error.code === "PGRST301") return true;
  return /permission denied|access denied|not a workspace member|row-level security|jwt (expired|expired signature)/i.test(error.message);
}

/**
 * True when the request never reached Postgres: the browser is offline, the
 * fetch was refused, or the connection timed out. `supabase-js` surfaces these
 * as an error with a message from the platform and no Postgres code, which is
 * why they are matched on text.
 *
 * This is the only failure class the caller can honestly invite a retry on. A
 * denied read will be denied again and an absent relation stays absent, so
 * offering "try again" for those wastes the one action the user has.
 */
export function isTransientReadError(error: { message: string; code?: string } | null): boolean {
  if (!error) return false;
  if (error.code === "502" || error.code === "503" || error.code === "504") return true;
  // Deliberately not a bare /timeout/: "canceling statement due to statement
  // timeout" is a server-side abort. The request arrived and Postgres did work,
  // so calling it offline would state something untrue about what was attempted.
  return /failed to fetch|fetch failed|networkerror|network request failed|load failed|connection appears to be offline|etimedout|econnreset|econnrefused|socket hang up|network timeout|connection timed out|request timed out/i.test(
    error.message
  );
}

/**
 * Why a workspace-scoped read produced no rows.
 *
 * `absent` is a repository state (a migration this build expects has not been
 * applied), `denied` is an authorization state, `offline` is a request that
 * never arrived and is worth retrying, `failed` is everything else and keeps its
 * message. Callers report the distinction instead of collapsing all four into an
 * empty list.
 */
export type ReadFailure = "absent" | "denied" | "offline" | "failed";

/** The failure classes where retrying the same read can plausibly succeed. */
export function isRetryable(failure: ReadFailure): boolean {
  // `failed` is included because it is the unclassified bucket: a 500 from a
  // trigger, a malformed filter, a statement timeout. Some of those clear on a
  // second attempt, and none of them are answered by another action.
  return failure === "offline" || failure === "failed";
}

export function classifyReadError(error: { message: string; code?: string }): ReadFailure {
  if (isPermissionDeniedError(error)) return "denied";
  if (isTransientReadError(error)) return "offline";
  if (isMissingRelationError(error)) return "absent";
  return "failed";
}
