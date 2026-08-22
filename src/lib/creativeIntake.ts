/**
 * Vanta Creative Intake & Deterministic Creative Twin Services
 *
 * Enforces provenance-first data intake, deterministic validation,
 * private Supabase Storage upload, and grounded Creative Twin manifest generation.
 *
 * NO model calls, NO video byte ingestion, NO semantic analysis, NO fabricated metrics.
 */

import { supabase, isSupabaseConfigured } from "./supabase";
import type { Database } from "../types/database.types";

export type CreativeAssetRow = Database["public"]["Tables"]["creative_assets"]["Row"];
export type CreativeAssetInsert = Database["public"]["Tables"]["creative_assets"]["Insert"];
export type IngestionRunRow = Database["public"]["Tables"]["ingestion_runs"]["Row"];
export type CreativeTwinRow = Database["public"]["Tables"]["creative_twins"]["Row"];

export type AssetKind =
  | "script"
  | "hook"
  | "caption"
  | "cta"
  | "landing_page_copy"
  | "thumbnail"
  | "short_video_metadata"
  | "campaign_csv"
  | "other";

// ============================================================
// PURE DETERMINISTIC VALIDATORS
// ============================================================

export interface ManualTextValidationResult {
  valid: boolean;
  error?: string;
  charCount: number;
  wordCount: number;
}

/**
 * Validates user-entered manual text (1 to 100,000 characters).
 */
export function validateManualText(text: string): ManualTextValidationResult {
  const trimmed = text ? text.trim() : "";
  const charCount = text ? text.length : 0;
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
  const wordCount = words.length;

  if (!trimmed || charCount < 1) {
    return {
      valid: false,
      error: "Manual text submission cannot be empty.",
      charCount: 0,
      wordCount: 0
    };
  }

  if (charCount > 100_000) {
    return {
      valid: false,
      error: `Manual text exceeds maximum length of 100,000 characters (received ${charCount.toLocaleString()}).`,
      charCount,
      wordCount
    };
  }

  return {
    valid: true,
    charCount,
    wordCount
  };
}

export interface FileMetadataValidationResult {
  valid: boolean;
  error?: string;
  extension: string;
  declaredMimeType: string;
  category: "csv" | "text" | "json" | "image" | "unsupported";
}

/**
 * Validates client-declared file metadata (MIME type and file size limits).
 * Notice: This is a client-declared metadata check only, not deep binary verification.
 */
export function validateDeclaredFileMetadata(file: {
  name: string;
  size: number;
  type: string;
}): FileMetadataValidationResult {
  if (!file.name || typeof file.size !== "number") {
    return {
      valid: false,
      error: "Invalid file object provided.",
      extension: "",
      declaredMimeType: file.type || "",
      category: "unsupported"
    };
  }

  const parts = file.name.split(".");
  const ext = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
  const mime = (file.type || "").toLowerCase();

  // Video rejection rule (Ticket 3.2 contract: no video byte uploads in this slice)
  const videoExtensions = ["mp4", "mov", "avi", "mkv", "webm", "m4v"];
  if (videoExtensions.includes(ext) || mime.startsWith("video/")) {
    return {
      valid: false,
      error: "Video file upload is not enabled in this version. Use 'Short video metadata' manual text entry instead.",
      extension: ext,
      declaredMimeType: mime,
      category: "unsupported"
    };
  }

  // 1. CSV
  if (ext === "csv" || mime === "text/csv" || mime === "application/vnd.ms-excel") {
    const maxCsv = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxCsv) {
      return {
        valid: false,
        error: `CSV file exceeds maximum limit of 5 MB (received ${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
        extension: ext,
        declaredMimeType: mime,
        category: "csv"
      };
    }
    return { valid: true, extension: ext, declaredMimeType: mime, category: "csv" };
  }

  // 2. Text / Scripts / Markdown
  if (["txt", "md"].includes(ext) || ["text/plain", "text/markdown"].includes(mime)) {
    const maxText = 2 * 1024 * 1024; // 2 MB
    if (file.size > maxText) {
      return {
        valid: false,
        error: `Text file exceeds maximum limit of 2 MB (received ${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
        extension: ext,
        declaredMimeType: mime,
        category: "text"
      };
    }
    return { valid: true, extension: ext, declaredMimeType: mime, category: "text" };
  }

  // 3. JSON
  if (ext === "json" || mime === "application/json") {
    const maxJson = 2 * 1024 * 1024; // 2 MB
    if (file.size > maxJson) {
      return {
        valid: false,
        error: `JSON file exceeds maximum limit of 2 MB (received ${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
        extension: ext,
        declaredMimeType: mime,
        category: "json"
      };
    }
    return { valid: true, extension: ext, declaredMimeType: mime, category: "json" };
  }

  // 4. Images / Thumbnails
  if (["png", "jpg", "jpeg", "webp"].includes(ext) || ["image/png", "image/jpeg", "image/webp"].includes(mime)) {
    const maxImg = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxImg) {
      return {
        valid: false,
        error: `Image file exceeds maximum limit of 10 MB (received ${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
        extension: ext,
        declaredMimeType: mime,
        category: "image"
      };
    }
    return { valid: true, extension: ext, declaredMimeType: mime, category: "image" };
  }

  return {
    valid: false,
    error: `Unsupported file type (.${ext || "unknown"}). Allowed formats: CSV, TXT, MD, JSON, PNG, JPEG, WebP.`,
    extension: ext,
    declaredMimeType: mime,
    category: "unsupported"
  };
}

/**
 * Sanitizes a filename for storage paths.
 */
export function sanitizeFilename(filename: string): string {
  if (!filename) return "unnamed_asset";
  // Extract basename if path components were passed
  const parts = filename.split(/[/\\]/).filter((p) => p !== "" && p !== "." && p !== "..");
  const base = parts.pop() || "unnamed_asset";
  const cleaned = base
    .trim()
    .replace(/[^\w.-]/g, "_")
    .replace(/^(\.|\_)+/, "")
    .replace(/\.+$/, "");
  return cleaned.substring(0, 120) || "unnamed_asset";
}

/**
 * Formats a secure Supabase Storage path: {workspace_id}/{asset_id}/{sanitized_filename}
 */
export function buildStoragePath(workspaceId: string, assetId: string, filename: string): string {
  return `${workspaceId}/${assetId}/${sanitizeFilename(filename)}`;
}

/**
 * Computes SHA-256 hash using browser crypto.subtle asynchronously.
 * Returns null honestly if crypto.subtle is unavailable (never fabricates a checksum).
 */
export async function computeSha256(buffer: ArrayBuffer): Promise<string | null> {
  try {
    if (typeof crypto !== "undefined" && crypto.subtle && typeof crypto.subtle.digest === "function") {
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch (err) {
    console.warn("crypto.subtle SHA-256 computation failed or was unavailable:", err);
  }
  return null;
}

/**
 * Inspects CSV headers deterministically from plain text without parsing data rows into metric tables.
 */
export function inspectCsvHeaders(csvText: string): string[] {
  if (!csvText) return [];
  const firstLine = csvText.split(/\r?\n/)[0];
  if (!firstLine) return [];

  // Simple CSV line parser handling basic quotes
  const headers: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < firstLine.length; i++) {
    const char = firstLine[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      headers.push(current.trim().replace(/^"|"$/g, ""));
      current = "";
    } else {
      current += char;
    }
  }
  if (current) {
    headers.push(current.trim().replace(/^"|"$/g, ""));
  }

  return headers.filter(Boolean);
}

/**
 * Constructs the deterministic feature dictionary for a Creative Twin.
 * Contains ONLY verifiable, deterministic properties.
 */
export function buildDeterministicFeatures(input: {
  manualText?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  byteSize?: number | null;
  sha256?: string | null;
  csvHeaders?: string[];
}): Record<string, any> {
  const features: Record<string, any> = {};

  if (input.manualText !== undefined && input.manualText !== null) {
    features.character_count = input.manualText.length;
    features.word_count = input.manualText.trim() ? input.manualText.trim().split(/\s+/).filter(Boolean).length : 0;
    features.has_manual_text = true;
  }

  if (input.filename) {
    features.original_filename = input.filename;
  }

  if (input.mimeType) {
    features.mime_type = input.mimeType;
  }

  if (typeof input.byteSize === "number") {
    features.byte_size = input.byteSize;
  }

  if (input.sha256) {
    features.content_sha256 = input.sha256;
    features.has_verified_checksum = true;
  } else {
    features.has_verified_checksum = false;
  }

  if (input.csvHeaders && input.csvHeaders.length > 0) {
    features.csv_headers = input.csvHeaders;
    features.csv_column_count = input.csvHeaders.length;
  }

  return features;
}

/**
 * Derives explicit known gaps based on absent inputs.
 */
export function deriveKnownGaps(input: {
  assetKind: AssetKind;
  hasTargetAudience: boolean;
  hasOutcomeData: boolean;
}): string[] {
  const gaps: string[] = [];

  if (["short_video_metadata", "thumbnail"].includes(input.assetKind)) {
    gaps.push("video_visual_pacing_not_analyzed");
    gaps.push("audio_transcript_not_extracted");
  }

  if (!input.hasTargetAudience) {
    gaps.push("no_target_audience_linked");
  }

  if (!input.hasOutcomeData) {
    gaps.push("no_observed_performance_data");
  }

  gaps.push("unsupported_by_ai_analysis_gate");

  return gaps;
}

// ============================================================
// DATA SERVICES (SUPABASE WORKSPACE-SCOPED)
// ============================================================

export async function fetchWorkspaceAssets(workspaceId: string): Promise<CreativeAssetRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("creative_assets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchWorkspaceAssets error:", error.message);
    return [];
  }
  return data || [];
}

export async function fetchWorkspaceTwins(workspaceId: string): Promise<CreativeTwinRow[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("creative_twins")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchWorkspaceTwins error:", error.message);
    return [];
  }
  return data || [];
}

/**
 * Ingests a manual text asset, creating source provenance, asset record, ingestion run, and grounded twin.
 */
export async function ingestManualTextAsset(
  workspaceId: string,
  userId: string,
  payload: {
    title: string;
    assetKind: AssetKind;
    manualText: string;
    declaredPlatform?: string;
    declaredObjective?: string;
  }
): Promise<{
  success: boolean;
  asset?: CreativeAssetRow;
  twin?: CreativeTwinRow;
  error?: string;
  isDuplicate?: boolean;
}> {
  if (!isSupabaseConfigured) {
    return { success: false, error: "Database not configured." };
  }

  // 1. Deterministic validation
  const validation = validateManualText(payload.manualText);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // 2. Compute SHA-256 if available
  const encoder = new TextEncoder();
  const sha256 = await computeSha256(encoder.encode(payload.manualText).buffer);

  // 3. Duplicate check within workspace
  if (sha256) {
    const { data: existing } = await supabase
      .from("creative_assets")
      .select("id, title")
      .eq("workspace_id", workspaceId)
      .eq("content_sha256", sha256)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: `An identical asset ("${existing.title}") has already been ingested into this workspace.`,
        isDuplicate: true
      };
    }
  }

  // 4. Create provenance in source_registry (unverified manual source)
  const { data: source, error: sourceErr } = await supabase
    .from("source_registry")
    .insert({
      workspace_id: workspaceId,
      name: `Manual Entry: ${payload.title.substring(0, 60)}`,
      source_type: "manual",
      health_status: "unverified",
      source_coverage: "partial",
      review_status: "draft",
      created_by: userId,
      description: `Manual text entry for asset "${payload.title}"`
    })
    .select()
    .single();

  if (sourceErr || !source) {
    return { success: false, error: sourceErr?.message || "Failed to create source record." };
  }

  // 5. Create creative_assets row
  const { data: asset, error: assetErr } = await supabase
    .from("creative_assets")
    .insert({
      workspace_id: workspaceId,
      source_id: source.id,
      created_by: userId,
      asset_kind: payload.assetKind,
      title: payload.title.trim(),
      manual_text: payload.manualText,
      declared_platform: payload.declaredPlatform?.trim() || null,
      declared_objective: payload.declaredObjective?.trim() || null,
      content_sha256: sha256,
      ingestion_status: "accepted"
    })
    .select()
    .single();

  if (assetErr || !asset) {
    return { success: false, error: assetErr?.message || "Failed to create asset record." };
  }

  // 6. Record ingestion run (durable intake audit)
  const validationSummary = {
    method: "manual_text",
    char_count: validation.charCount,
    word_count: validation.wordCount,
    has_sha256: Boolean(sha256)
  };

  await supabase.from("ingestion_runs").insert({
    workspace_id: workspaceId,
    asset_id: asset.id,
    started_by: userId,
    ingestion_method: "manual_text",
    status: "accepted",
    validation_summary: validationSummary,
    completed_at: new Date().toISOString()
  });

  // 7. Create Grounded Creative Twin stub
  const deterministicFeatures = buildDeterministicFeatures({
    manualText: payload.manualText,
    sha256
  });

  const knownGaps = deriveKnownGaps({
    assetKind: payload.assetKind,
    hasTargetAudience: false,
    hasOutcomeData: false
  });

  const { data: twin, error: twinErr } = await supabase
    .from("creative_twins")
    .insert({
      workspace_id: workspaceId,
      asset_id: asset.id,
      title: asset.title,
      asset_kind: asset.asset_kind,
      declared_platform: asset.declared_platform,
      declared_objective: asset.declared_objective,
      source_evidence_ids: [source.id],
      deterministic_features: deterministicFeatures,
      known_gaps: knownGaps,
      state: "grounded_stub"
    })
    .select()
    .single();

  if (twinErr || !twin) {
    console.error("Creative twin insertion error:", twinErr);
  }

  // 8. Audit event
  await supabase.from("audit_events").insert({
    workspace_id: workspaceId,
    user_id: userId,
    action: "creative_asset.ingested",
    resource_type: "creative_asset",
    resource_id: asset.id,
    metadata: {
      title: asset.title,
      asset_kind: asset.asset_kind,
      char_count: validation.charCount,
      source_id: source.id
    }
  });

  return { success: true, asset, twin: twin || undefined };
}

/**
 * Ingests a file-backed asset, uploading to private Supabase Storage,
 * creating source provenance, asset record, ingestion run, and grounded twin.
 */
export async function ingestFileAsset(
  workspaceId: string,
  userId: string,
  file: File,
  payload: {
    title: string;
    assetKind: AssetKind;
    declaredPlatform?: string;
    declaredObjective?: string;
  }
): Promise<{
  success: boolean;
  asset?: CreativeAssetRow;
  twin?: CreativeTwinRow;
  error?: string;
  isDuplicate?: boolean;
}> {
  if (!isSupabaseConfigured) {
    return { success: false, error: "Database not configured." };
  }

  // 1. Validate declared file metadata
  const validation = validateDeclaredFileMetadata({
    name: file.name,
    size: file.size,
    type: file.type
  });

  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // 2. Read array buffer & compute SHA-256
  const arrayBuffer = await file.arrayBuffer();
  const sha256 = await computeSha256(arrayBuffer);

  // 3. Duplicate check within workspace
  if (sha256) {
    const { data: existing } = await supabase
      .from("creative_assets")
      .select("id, title")
      .eq("workspace_id", workspaceId)
      .eq("content_sha256", sha256)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: `An identical file asset ("${existing.title}") with matching SHA-256 already exists in this workspace.`,
        isDuplicate: true
      };
    }
  }

  // 4. CSV header inspection if CSV
  let csvHeaders: string[] = [];
  if (validation.category === "csv") {
    const textDecoder = new TextDecoder();
    const previewText = textDecoder.decode(arrayBuffer.slice(0, 8192));
    csvHeaders = inspectCsvHeaders(previewText);
  }

  // 5. Create provenance in source_registry (unverified file_import)
  const { data: source, error: sourceErr } = await supabase
    .from("source_registry")
    .insert({
      workspace_id: workspaceId,
      name: `File Import: ${file.name}`,
      source_type: "file_import",
      health_status: "unverified",
      source_coverage: "partial",
      review_status: "draft",
      created_by: userId,
      description: `Uploaded file "${file.name}" (${(file.size / 1024).toFixed(1)} KB)`
    })
    .select()
    .single();

  if (sourceErr || !source) {
    return { success: false, error: sourceErr?.message || "Failed to create source record." };
  }

  // 6. Generate Asset ID & upload to private Supabase Storage
  const assetId = crypto.randomUUID();
  const storagePath = buildStoragePath(workspaceId, assetId, file.name);

  const { error: uploadErr } = await supabase.storage
    .from("workspace-assets")
    .upload(storagePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false
    });

  if (uploadErr) {
    // Record failed ingestion run
    await supabase.from("ingestion_runs").insert({
      workspace_id: workspaceId,
      asset_id: assetId,
      started_by: userId,
      ingestion_method: "file_upload",
      status: "failed",
      validation_summary: { file_name: file.name, byte_size: file.size, mime_type: file.type },
      error_code: "STORAGE_UPLOAD_ERROR",
      error_message: uploadErr.message,
      completed_at: new Date().toISOString()
    });

    return {
      success: false,
      error: `Storage upload failed: ${uploadErr.message}. The asset was not created.`
    };
  }

  // 7. Insert creative_assets row
  const { data: asset, error: assetErr } = await supabase
    .from("creative_assets")
    .insert({
      id: assetId,
      workspace_id: workspaceId,
      source_id: source.id,
      created_by: userId,
      asset_kind: payload.assetKind,
      title: payload.title.trim(),
      original_filename: file.name,
      mime_type: file.type || null,
      byte_size: file.size,
      storage_bucket: "workspace-assets",
      storage_path: storagePath,
      content_sha256: sha256,
      declared_platform: payload.declaredPlatform?.trim() || null,
      declared_objective: payload.declaredObjective?.trim() || null,
      ingestion_status: "accepted"
    })
    .select()
    .single();

  if (assetErr || !asset) {
    return { success: false, error: assetErr?.message || "Failed to create asset record." };
  }

  // 8. Record accepted ingestion run
  const validationSummary = {
    method: "file_upload",
    file_name: file.name,
    byte_size: file.size,
    mime_type: file.type,
    category: validation.category,
    csv_headers: csvHeaders,
    has_sha256: Boolean(sha256)
  };

  await supabase.from("ingestion_runs").insert({
    workspace_id: workspaceId,
    asset_id: asset.id,
    started_by: userId,
    ingestion_method: validation.category === "csv" ? "csv_header_inspection" : "file_upload",
    status: "accepted",
    validation_summary: validationSummary,
    completed_at: new Date().toISOString()
  });

  // 9. Create Grounded Creative Twin stub
  const deterministicFeatures = buildDeterministicFeatures({
    filename: file.name,
    mimeType: file.type,
    byteSize: file.size,
    sha256,
    csvHeaders
  });

  const knownGaps = deriveKnownGaps({
    assetKind: payload.assetKind,
    hasTargetAudience: false,
    hasOutcomeData: false
  });

  const { data: twin } = await supabase
    .from("creative_twins")
    .insert({
      workspace_id: workspaceId,
      asset_id: asset.id,
      title: asset.title,
      asset_kind: asset.asset_kind,
      declared_platform: asset.declared_platform,
      declared_objective: asset.declared_objective,
      source_evidence_ids: [source.id],
      deterministic_features: deterministicFeatures,
      known_gaps: knownGaps,
      state: "grounded_stub"
    })
    .select()
    .single();

  // 10. Audit event
  await supabase.from("audit_events").insert({
    workspace_id: workspaceId,
    user_id: userId,
    action: "creative_asset.uploaded",
    resource_type: "creative_asset",
    resource_id: asset.id,
    metadata: {
      title: asset.title,
      asset_kind: asset.asset_kind,
      file_name: file.name,
      byte_size: file.size,
      source_id: source.id
    }
  });

  return { success: true, asset, twin: twin || undefined };
}
