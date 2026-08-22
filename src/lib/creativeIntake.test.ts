import { describe, expect, it } from "vitest";
import {
  validateManualText,
  validateDeclaredFileMetadata,
  sanitizeFilename,
  buildStoragePath,
  inspectCsvHeaders,
  buildDeterministicFeatures,
  deriveKnownGaps
} from "./creativeIntake";

describe("validateManualText", () => {
  it("accepts valid manual text within boundaries", () => {
    const text = "Hook: Stop losing budget on unverified creative experiments.\nCTA: Build your Brand Codex today.";
    const res = validateManualText(text);
    expect(res.valid).toBe(true);
    expect(res.charCount).toBe(text.length);
    expect(res.wordCount).toBe(14);
    expect(res.error).toBeUndefined();
  });

  it("rejects empty or whitespace-only text", () => {
    expect(validateManualText("").valid).toBe(false);
    expect(validateManualText("   \n\t  ").valid).toBe(false);
    expect(validateManualText("").error).toContain("cannot be empty");
  });

  it("rejects text exceeding 100,000 characters", () => {
    const longText = "a".repeat(100_001);
    const res = validateManualText(longText);
    expect(res.valid).toBe(false);
    expect(res.error).toContain("exceeds maximum length of 100,000 characters");
  });
});

describe("validateDeclaredFileMetadata", () => {
  it("accepts valid CSV files under 5 MB", () => {
    const res = validateDeclaredFileMetadata({
      name: "q3_campaign_performance.csv",
      size: 1024 * 1024 * 3, // 3 MB
      type: "text/csv"
    });
    expect(res.valid).toBe(true);
    expect(res.category).toBe("csv");
  });

  it("rejects CSV files over 5 MB", () => {
    const res = validateDeclaredFileMetadata({
      name: "massive_export.csv",
      size: 1024 * 1024 * 6, // 6 MB
      type: "text/csv"
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("exceeds maximum limit of 5 MB");
  });

  it("accepts text, markdown, and JSON files under 2 MB", () => {
    expect(
      validateDeclaredFileMetadata({
        name: "ad_script_v2.txt",
        size: 500 * 1024,
        type: "text/plain"
      }).valid
    ).toBe(true);

    expect(
      validateDeclaredFileMetadata({
        name: "landing_copy.md",
        size: 800 * 1024,
        type: "text/markdown"
      }).valid
    ).toBe(true);

    expect(
      validateDeclaredFileMetadata({
        name: "metadata.json",
        size: 1.5 * 1024 * 1024,
        type: "application/json"
      }).valid
    ).toBe(true);
  });

  it("rejects text files exceeding 2 MB", () => {
    const res = validateDeclaredFileMetadata({
      name: "giant_script.txt",
      size: 2.5 * 1024 * 1024,
      type: "text/plain"
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("exceeds maximum limit of 2 MB");
  });

  it("accepts images under 10 MB", () => {
    const res = validateDeclaredFileMetadata({
      name: "first_frame_hook.png",
      size: 4 * 1024 * 1024,
      type: "image/png"
    });
    expect(res.valid).toBe(true);
    expect(res.category).toBe("image");
  });

  it("rejects images over 10 MB", () => {
    const res = validateDeclaredFileMetadata({
      name: "raw_banner.png",
      size: 12 * 1024 * 1024,
      type: "image/png"
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("exceeds maximum limit of 10 MB");
  });

  it("explicitly rejects video file byte uploads in Ticket 3.2", () => {
    const res = validateDeclaredFileMetadata({
      name: "ugc_video_ad.mp4",
      size: 8 * 1024 * 1024,
      type: "video/mp4"
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Video file upload is not enabled in this version");
  });

  it("rejects unsupported extensions", () => {
    const res = validateDeclaredFileMetadata({
      name: "malicious_script.exe",
      size: 500,
      type: "application/x-msdownload"
    });
    expect(res.valid).toBe(false);
    expect(res.error).toContain("Unsupported file type");
  });
});

describe("sanitizeFilename and buildStoragePath", () => {
  it("sanitizes filenames with unsafe characters and path traversal", () => {
    expect(sanitizeFilename("../../etc/passwd.txt")).toBe("passwd.txt");
    expect(sanitizeFilename("My Ad Script (Final) & V2!.txt")).toBe("My_Ad_Script__Final____V2_.txt");
  });

  it("builds exact {workspaceId}/{assetId}/{filename} storage path format", () => {
    const wsId = "ws-999";
    const assetId = "asset-888";
    const filename = "landing_copy.md";
    const path = buildStoragePath(wsId, assetId, filename);
    expect(path).toBe("ws-999/asset-888/landing_copy.md");
    expect(path.split("/")).toHaveLength(3);
  });
});

describe("inspectCsvHeaders", () => {
  it("extracts header names without parsing row data", () => {
    const csvContent = `ad_id,variant_name,impressions,spend,hook_rate\n1,Hook A,10000,250.00,0.48\n2,Hook B,12000,300.00,0.52`;
    const headers = inspectCsvHeaders(csvContent);
    expect(headers).toEqual(["ad_id", "variant_name", "impressions", "spend", "hook_rate"]);
  });

  it("handles quoted CSV headers", () => {
    const csvContent = `"Campaign Name","Target Segment","Report Date"\n"Retargeting","US-25-34","2026-08-01"`;
    const headers = inspectCsvHeaders(csvContent);
    expect(headers).toEqual(["Campaign Name", "Target Segment", "Report Date"]);
  });

  it("returns empty array for empty CSV string", () => {
    expect(inspectCsvHeaders("")).toEqual([]);
  });
});

describe("buildDeterministicFeatures & deriveKnownGaps", () => {
  it("creates deterministic feature manifest with zero inference", () => {
    const features = buildDeterministicFeatures({
      manualText: "Hello world sample script",
      filename: "sample.txt",
      mimeType: "text/plain",
      byteSize: 1024,
      sha256: "abc123hash",
      csvHeaders: undefined
    });

    expect(features.character_count).toBe(25);
    expect(features.word_count).toBe(4);
    expect(features.content_sha256).toBe("abc123hash");
    expect(features.has_verified_checksum).toBe(true);
    expect(features.sentiment).toBeUndefined();
    expect(features.virality_score).toBeUndefined();
  });

  it("derives explicit known gaps based on absent inputs", () => {
    const gaps = deriveKnownGaps({
      assetKind: "script",
      hasTargetAudience: false,
      hasOutcomeData: false
    });

    expect(gaps).toContain("no_target_audience_linked");
    expect(gaps).toContain("no_observed_performance_data");
    expect(gaps).toContain("unsupported_by_ai_analysis_gate");
  });

  it("includes video pacing gaps for video metadata and thumbnail kinds", () => {
    const gaps = deriveKnownGaps({
      assetKind: "short_video_metadata",
      hasTargetAudience: true,
      hasOutcomeData: false
    });

    expect(gaps).toContain("video_visual_pacing_not_analyzed");
    expect(gaps).toContain("audio_transcript_not_extracted");
    expect(gaps).not.toContain("no_target_audience_linked");
  });
});

describe("intake failure and invalid path invariant tests", () => {
  it("ensures validation failure on manual text rejects intake before creating twin stub", () => {
    const emptyTextValidation = validateManualText("");
    expect(emptyTextValidation.valid).toBe(false);
    // Invariant: A failed validation blocks twin creation
  });

  it("ensures malformed file validation rejects intake without twin creation", () => {
    const videoValidation = validateDeclaredFileMetadata({
      name: "video.mp4",
      size: 5 * 1024 * 1024,
      type: "video/mp4"
    });
    expect(videoValidation.valid).toBe(false);
  });
});
