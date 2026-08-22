/**
 * Retrieval gate (Upgrade E).
 *
 * Vector search returns candidates. Nothing becomes prompt context or a
 * user-facing citation until it passes this gate: workspace scope, review
 * status, evidence class, source freshness, minimum similarity, and a
 * per-source cap. Pure; shared by the gateway and the UI.
 */

export type EvidenceClass = "observed" | "sourced_claim" | "inference" | "simulation" | "unknown";
export type Citability = "verified" | "citable_unverified" | "citable_stale" | "blocked";

export interface RetrievalCandidate {
  source_table: "brand_claims" | "brand_proof_points" | "evidence_items" | "creative_claims";
  source_id: string;
  chunk_index: number;
  similarity: number;
  embedding_model: string;
  /** Joined from the source row under RLS. Null when the join returned nothing (row gone or not visible). */
  row: {
    workspace_id: string;
    review_status: "draft" | "in_review" | "approved" | "archived";
    evidence_class: EvidenceClass | null;
    citability: Citability | null;
    text: string;
  } | null;
}

export interface GatePolicy {
  workspaceId: string;
  minSimilarity: number;
  allowedEvidenceClasses: readonly EvidenceClass[];
  /** Citability statuses that may be cited. Stale sources may be context but never numeric support. */
  allowedCitability: readonly Citability[];
  requireApproved: boolean;
  maxPerSource: number;
  maxTotal: number;
  /** Rows must come from the same embedding model as the query, otherwise similarity is meaningless. */
  expectedModel: string;
}

export const DEFAULT_GATE_POLICY: Omit<GatePolicy, "workspaceId" | "expectedModel"> = {
  minSimilarity: 0.75,
  allowedEvidenceClasses: ["observed", "sourced_claim"],
  allowedCitability: ["verified", "citable_unverified"],
  requireApproved: true,
  maxPerSource: 1,
  maxTotal: 8,
};

export type GateReason =
  | "row_not_visible"
  | "workspace_mismatch"
  | "model_mismatch"
  | "below_similarity"
  | "not_approved"
  | "evidence_class"
  | "citability"
  | "per_source_cap"
  | "total_cap";

export interface GatedCandidate extends RetrievalCandidate {
  /** Always 'candidate' so consumers cannot mistake it for evidence. */
  kind: "retrieval_candidate";
}

export interface GateResult {
  accepted: GatedCandidate[];
  rejected: Array<{ candidate: RetrievalCandidate; reason: GateReason }>;
}

export function gateCandidates(candidates: readonly RetrievalCandidate[], policy: GatePolicy): GateResult {
  const accepted: GatedCandidate[] = [];
  const rejected: GateResult["rejected"] = [];
  const perSource = new Map<string, number>();

  const sorted = [...candidates].sort((a, b) => b.similarity - a.similarity);

  for (const c of sorted) {
    const reject = (reason: GateReason) => rejected.push({ candidate: c, reason });

    if (!c.row) { reject("row_not_visible"); continue; }
    if (c.row.workspace_id !== policy.workspaceId) { reject("workspace_mismatch"); continue; }
    if (c.embedding_model !== policy.expectedModel) { reject("model_mismatch"); continue; }
    if (c.similarity < policy.minSimilarity) { reject("below_similarity"); continue; }
    if (policy.requireApproved && c.row.review_status !== "approved") { reject("not_approved"); continue; }
    // brand_claims carry no evidence class of their own; they are policy rows, allowed when approved.
    if (c.source_table !== "brand_claims") {
      if (!c.row.evidence_class || !policy.allowedEvidenceClasses.includes(c.row.evidence_class)) { reject("evidence_class"); continue; }
      if (!c.row.citability || !policy.allowedCitability.includes(c.row.citability)) { reject("citability"); continue; }
    }
    const key = `${c.source_table}:${c.source_id}`;
    const seen = perSource.get(key) ?? 0;
    if (seen >= policy.maxPerSource) { reject("per_source_cap"); continue; }
    if (accepted.length >= policy.maxTotal) { reject("total_cap"); continue; }
    perSource.set(key, seen + 1);
    accepted.push({ ...c, kind: "retrieval_candidate" });
  }

  return { accepted, rejected };
}

/** Splits text into overlapping chunks for embedding. Deterministic; boundaries on whitespace where possible. */
export function chunkText(text: string, maxChars = 800, overlap = 100): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length === 0) return [];
  if (clean.length <= maxChars) return [clean];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(clean.length, start + maxChars);
    if (end < clean.length) {
      const lastSpace = clean.lastIndexOf(" ", end);
      if (lastSpace > start + maxChars / 2) end = lastSpace;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks;
}
