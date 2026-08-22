/**
 * Handler: source_refresh (Upgrade F).
 *
 * Refreshes one `source_registry` row of type `api_feed` whose URL is a
 * permitted public RSS/Atom feed. Writes each new item as a `sourced_claim`
 * evidence row with citation URL and date, then marks the source
 * `connected` with `last_verified_at` (allowed because this runs as
 * service_role, which the trigger permits). Jobs of this type require
 * admin approval before they run (migration 011 CHECK).
 *
 * Official OAuth connectors (Meta, Google, ...) are not implemented here:
 * they need provider apps, review, and credentials that are product and
 * operator decisions. The account table, consent model, token encryption,
 * and access-state helper are ready for them.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isPermittedFeedUrl, parseFeed } from "../../../../shared/connectors/rss.js";
import type { JobHandler } from "../loop.js";

const USER_AGENT = "VantaSourceRefresh/0.1 (+feed reader; contact workspace admin)";
const MAX_BYTES = 2 * 1024 * 1024;

export function makeSourceRefreshHandler(supabase: SupabaseClient): JobHandler {
  return async (job, signal) => {
    const sourceId = (job.payload as { source_id?: string }).source_id;
    if (!sourceId) return { ok: false, failure: { kind: "permanent", message: "payload.source_id required", code: "bad_payload" } };

    const { data: source, error } = await supabase
      .from("source_registry")
      .select("id, workspace_id, source_type, url, created_by")
      .eq("id", sourceId)
      .eq("workspace_id", job.workspace_id)
      .maybeSingle();
    if (error) return { ok: false, failure: { kind: "transient", message: "read source failed", code: "read_failed" } };
    if (!source) return { ok: false, failure: { kind: "permanent", message: "source not found in workspace", code: "not_found" } };
    if (source.source_type !== "api_feed" || !source.url) {
      return { ok: false, failure: { kind: "permanent", message: "source is not an api_feed with a URL", code: "not_a_feed" } };
    }
    if (!isPermittedFeedUrl(source.url)) {
      return { ok: false, failure: { kind: "permanent", message: "feed URL not permitted (https public host only)", code: "url_not_permitted" } };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, signal.deadlineMs - Date.now()));
    let xml: string;
    try {
      const res = await fetch(source.url, { headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" }, signal: controller.signal, redirect: "follow" });
      if (!isPermittedFeedUrl(res.url || source.url)) {
        return { ok: false, failure: { kind: "permanent", message: "feed redirected to a non-permitted host", code: "redirect_not_permitted" } };
      }
      if (!res.ok) {
        return { ok: false, failure: { kind: res.status >= 500 || res.status === 429 ? "transient" : "permanent", message: `feed http ${res.status}`, code: `http_${res.status}` } };
      }
      const buf = await res.arrayBuffer();
      if (buf.byteLength > MAX_BYTES) return { ok: false, failure: { kind: "permanent", message: "feed exceeds 2 MB", code: "too_large" } };
      xml = new TextDecoder().decode(buf);
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      return { ok: false, failure: { kind: "transient", message: aborted ? "feed fetch timeout" : "feed unreachable", code: aborted ? "timeout" : "network" } };
    } finally {
      clearTimeout(timer);
    }

    const feed = parseFeed(xml);
    if (feed.format === "unknown") return { ok: false, failure: { kind: "permanent", message: "URL did not return RSS or Atom", code: "not_a_feed" } };

    // Existing items by citation_url to avoid duplicates.
    const links = feed.items.map((i) => i.link).filter((l): l is string => Boolean(l));
    const { data: existing } = await supabase
      .from("evidence_items")
      .select("citation_url")
      .eq("workspace_id", job.workspace_id)
      .eq("source_id", source.id)
      .in("citation_url", links.length > 0 ? links : ["__none__"]);
    const known = new Set((existing ?? []).map((e: { citation_url: string | null }) => e.citation_url));

    const rows = feed.items
      .filter((i) => i.link && !known.has(i.link))
      .map((i) => ({
        workspace_id: job.workspace_id,
        source_id: source.id,
        created_by: source.created_by,
        evidence_class: "sourced_claim",
        claim_text: i.summary ? `${i.title}: ${i.summary}` : i.title,
        citation_url: i.link,
        citation_date: i.published_at ? i.published_at.slice(0, 10) : null,
        freshness_date: i.published_at ? i.published_at.slice(0, 10) : null,
        completeness: i.published_at ? "complete" : "partial",
        review_status: "draft",
        notes: `Imported from feed "${feed.title ?? source.url}" by source_refresh job ${job.id}`,
      }));

    if (rows.length > 0) {
      const { error: insErr } = await supabase.from("evidence_items").insert(rows);
      if (insErr) return { ok: false, failure: { kind: "transient", message: "insert evidence failed", code: "write_failed" } };
    }

    const { error: upErr } = await supabase
      .from("source_registry")
      .update({ health_status: "connected", last_verified_at: new Date().toISOString(), source_coverage: feed.warnings.length > 0 ? "partial" : "complete", updated_at: new Date().toISOString() })
      .eq("id", source.id)
      .eq("workspace_id", job.workspace_id);
    if (upErr) return { ok: false, failure: { kind: "transient", message: "update source failed", code: "write_failed" } };

    return { ok: true, result: { format: feed.format, items_seen: feed.items.length, items_added: rows.length, warnings: feed.warnings } };
  };
}
