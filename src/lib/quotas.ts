import { isSupabaseConfigured, supabase } from "./supabase";
import { classifyReadError, narrow, type ReadFailure } from "./rows";

/**
 * Per-workspace daily quotas (Upgrade G), read-only.
 *
 * `consume_quota` is the only write path and it is called by the action that
 * needs the budget, never to display one. Until this reader existed the only way
 * to learn a quota was to hit it: an enqueue failed and the error named a limit
 * the operator had never been shown. `workspace_quotas` grants members SELECT,
 * so the budget can be reported without spending any of it.
 *
 * A row is created lazily on first consume, so "no row" is a real and common
 * state. This module reports it as such and does not invent the limit
 * `default_quota` would apply, because that value lives in migration 015 and
 * copying it here would drift the moment an operator changed it.
 */

/** Mirrors the CHECK constraint on `workspace_quotas.kind` in migration 015. */
export const QUOTA_KINDS = ["model_call", "job_enqueue", "media_probe", "feed_refresh"] as const;
export type QuotaKind = (typeof QUOTA_KINDS)[number];

export interface QuotaRow {
  kind: QuotaKind;
  daily_limit: number;
  used_today: number;
  /** The day the counter belongs to, as stored (`YYYY-MM-DD`). */
  window_date: string;
}

export type QuotaRead =
  | { state: "unconfigured" }
  | { state: "unreadable"; failure: ReadFailure; reason: string }
  | { state: "read"; rows: QuotaRow[] };

export type QuotaState =
  /** The quota table is not reachable, so the browser cannot report a budget. */
  | { state: "not_applied" }
  | { state: "denied" }
  | { state: "unreadable"; reason: string }
  /** No row for this kind: nothing has ever consumed it, and the limit is set on first use. */
  | { state: "never_consumed" }
  /** A row from an earlier day. The stored count is not today's and resets on the next consume. */
  | { state: "reset_pending"; limit: number; storedDate: string }
  | { state: "available"; used: number; limit: number; remaining: number }
  | { state: "exhausted"; used: number; limit: number };

export async function fetchQuotas(workspaceId: string): Promise<QuotaRead> {
  if (!isSupabaseConfigured) return { state: "unconfigured" };
  const { data, error } = await supabase
    .from("workspace_quotas")
    .select("kind,daily_limit,used_today,window_date")
    .eq("workspace_id", workspaceId);
  if (error) return { state: "unreadable", failure: classifyReadError(error), reason: error.message };
  const rows: QuotaRow[] = [];
  for (const row of data ?? []) {
    // `kind` is CHECK-constrained but generated as `string`. A kind this build
    // does not know is dropped rather than shown under a nearby label; the
    // per-kind view only ever asks about kinds it named itself.
    const kind = narrow(QUOTA_KINDS, row.kind);
    if (kind) rows.push({ kind, daily_limit: row.daily_limit, used_today: row.used_today, window_date: row.window_date });
  }
  return { state: "read", rows };
}

/**
 * Resolves one kind's state. Pure.
 *
 * `today` is the UTC date because `consume_quota` compares against Postgres
 * `CURRENT_DATE`, which is UTC on a default Supabase project. Comparing the
 * operator's local date instead would report a reset that has not happened.
 */
export function describeQuota(kind: QuotaKind, read: QuotaRead, now: Date): QuotaState {
  if (read.state === "unconfigured") return { state: "unreadable", reason: "Supabase is not configured." };
  if (read.state === "unreadable") {
    if (read.failure === "absent") return { state: "not_applied" };
    if (read.failure === "denied") return { state: "denied" };
    return { state: "unreadable", reason: read.reason };
  }
  const row = read.rows.find((r) => r.kind === kind);
  if (!row) return { state: "never_consumed" };
  const today = now.toISOString().slice(0, 10);
  if (row.window_date < today) return { state: "reset_pending", limit: row.daily_limit, storedDate: row.window_date };
  if (row.used_today >= row.daily_limit) return { state: "exhausted", used: row.used_today, limit: row.daily_limit };
  return { state: "available", used: row.used_today, limit: row.daily_limit, remaining: row.daily_limit - row.used_today };
}

/** One line for the UI. Never claims a budget the read did not prove. */
export function quotaSummary(state: QuotaState): string {
  switch (state.state) {
    case "not_applied":
      // Migration 015 is applied on the reference project, so an absent table
      // means this environment is a different one. It does not mean "no limit":
      // `enqueueJob` consumes the quota first and fails closed, so an absent
      // `consume_quota` blocks the action rather than freeing it.
      return "Quota is unknown: the quota table and its consume function (migration 015) are not reachable here, and enqueuing fails closed while that is true.";
    case "denied":
      return "You are not allowed to read this workspace's quotas.";
    case "unreadable":
      return `Quota could not be read: ${state.reason}`;
    case "never_consumed":
      return "No quota row yet: nothing has consumed this budget, and the limit is set on first use.";
    case "reset_pending":
      return `Limit ${state.limit} per day. The stored counter is from ${state.storedDate} and resets on the next use.`;
    case "available":
      return `${state.used} of ${state.limit} used today, ${state.remaining} left.`;
    case "exhausted":
      return `${state.used} of ${state.limit} used today. Nothing further can be queued until the window rolls over.`;
  }
}
