/**
 * Handler: embedding_refresh (Upgrade E).
 *
 * Embeds approved Brand Codex rows for one workspace through an
 * OpenAI-compatible /embeddings endpoint chosen by the operator
 * (EMBEDDING_PROVIDER_URL, EMBEDDING_PROVIDER_TOKEN, EMBEDDING_MODEL).
 * Rows are written with service_role. Unconfigured provider = permanent
 * failure; nothing is embedded locally or faked.
 */

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { chunkText } from "../../../../shared/retrieval/gate.js";
import type { JobHandler } from "../loop.js";

const SOURCES: Array<{ table: "brand_claims" | "brand_proof_points" | "evidence_items"; textColumn: string }> = [
  { table: "brand_claims", textColumn: "claim_text" },
  { table: "brand_proof_points", textColumn: "proof_text" },
  { table: "evidence_items", textColumn: "claim_text" },
];

export function makeEmbeddingRefreshHandler(supabase: SupabaseClient): JobHandler {
  return async (job, signal) => {
    const url = process.env.EMBEDDING_PROVIDER_URL;
    const token = process.env.EMBEDDING_PROVIDER_TOKEN;
    const model = process.env.EMBEDDING_MODEL;
    const modelVersion = process.env.EMBEDDING_MODEL_VERSION ?? "unversioned";
    if (!url || !token || !model) {
      return { ok: false, failure: { kind: "permanent", message: "embedding provider not configured", code: "embedding_unconfigured" } };
    }

    let embedded = 0;
    let skipped = 0;
    for (const src of SOURCES) {
      const { data: rows, error } = await supabase
        .from(src.table)
        .select("*")
        .eq("workspace_id", job.workspace_id)
        .eq("review_status", "approved");
      if (error) return { ok: false, failure: { kind: "transient", message: `read ${src.table} failed`, code: "read_failed" } };

      for (const row of (rows ?? []) as unknown as Array<Record<string, unknown>>) {
        if (Date.now() > signal.deadlineMs) {
          return { ok: false, failure: { kind: "transient", message: "deadline reached mid-refresh", code: "timeout" } };
        }
        const text = String(row[src.textColumn] ?? "");
        const chunks = chunkText(text);
        for (let i = 0; i < chunks.length; i += 1) {
          const sha = createHash("sha256").update(chunks[i]).digest("hex");
          const { data: existing } = await supabase
            .from("retrieval_embeddings")
            .select("id")
            .eq("workspace_id", job.workspace_id)
            .eq("source_table", src.table)
            .eq("source_id", row.id as string)
            .eq("chunk_index", i)
            .eq("embedding_model", model)
            .eq("content_sha256", sha)
            .maybeSingle();
          if (existing) { skipped += 1; continue; }

          const vector = await embed(url, token, model, chunks[i]);
          if (!vector) return { ok: false, failure: { kind: "transient", message: "embedding request failed", code: "provider_failed" } };

          const { error: upErr } = await supabase.from("retrieval_embeddings").upsert(
            {
              workspace_id: job.workspace_id,
              source_table: src.table,
              source_id: row.id,
              chunk_index: i,
              content_sha256: sha,
              embedding: vector,
              embedding_model: model,
              embedding_model_version: modelVersion,
              job_id: job.id,
            },
            { onConflict: "workspace_id,source_table,source_id,chunk_index,embedding_model" }
          );
          if (upErr) return { ok: false, failure: { kind: "transient", message: "write embedding failed", code: "write_failed" } };
          embedded += 1;
        }
      }
    }
    return { ok: true, result: { embedded, skipped, model, model_version: modelVersion } };
  };
}

async function embed(url: string, token: string, model: string, input: string): Promise<number[] | null> {
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ model, input }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: Array<{ embedding?: unknown }> };
    const vec = data.data?.[0]?.embedding;
    if (!Array.isArray(vec) || vec.length !== 1536 || !vec.every((n) => typeof n === "number")) return null;
    return vec as number[];
  } catch {
    return null;
  }
}
