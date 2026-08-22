/**
 * Creative Twin Deterministic Expansion & Structured Representation
 *
 * Implements deterministic text asset decomposition, reading burden metrics,
 * traceable claim extraction with character offsets, Brand Codex alignment matching,
 * and atomic immutable version snapshotting.
 *
 * Zero AI model inference, zero hallucinated visuals/audio, fail-closed provenance.
 */

import { supabase } from './supabase';
import type { Database } from '../types/database.types';

export type CreativeSceneRow = Database['public']['Tables']['creative_scenes']['Row'];
export type CreativeClaimRow = Database['public']['Tables']['creative_claims']['Row'];
export type CreativeTwinRow = Database['public']['Tables']['creative_twins']['Row'];
export type CreativeTwinVersionRow = Database['public']['Tables']['creative_twin_versions']['Row'];
export type BrandClaimRow = Database['public']['Tables']['brand_claims']['Row'];

export type ShotPurpose =
  | 'hook'
  | 'problem_setup'
  | 'product_demonstration'
  | 'proof_testimonial'
  | 'feature_breakdown'
  | 'objection_handling'
  | 'cta'
  | 'transition'
  | 'other';

export type ClaimClassification =
  | 'explicit_brand_promise'
  | 'comparative_advantage'
  | 'product_capability'
  | 'testimonial_endorsement'
  | 'numeric_outcome'
  | 'pricing_offer'
  | 'unverified_statement';

export type BrandAlignmentStatus =
  | 'exact_brand_claim_match'
  | 'possible_term_overlap'
  | 'no_brand_claim_match'
  | 'unassessed';

export interface ParsedScene {
  sceneIndex: number;
  startSeconds: number | null;
  endSeconds: number | null;
  shotPurpose: ShotPurpose;
  spokenTranscript: string;
  onScreenText: string | null;
  providedVisualNotes: string | null;
  readingBurdenWpm: number | null;
}

export interface ExtractedClaimCandidate {
  claimText: string;
  claimClassification: ClaimClassification;
  brandAlignmentStatus: BrandAlignmentStatus;
  matchingBrandClaimId: string | null;
  sourceCharOffsetStart: number;
  sourceCharOffsetEnd: number;
  sourceExcerpt: string;
  proofReference: string | null;
  sceneIndices: number[];
}

export interface StructuredTwinDetails {
  twin: Database['public']['Tables']['creative_twins']['Row'];
  scenes: CreativeSceneRow[];
  claims: CreativeClaimRow[];
  versions: CreativeTwinVersionRow[];
}

// -----------------------------------------------------------------------------
// Pure Deterministic Calculators & Parsers
// -----------------------------------------------------------------------------

/**
 * Calculates reading burden in Words Per Minute (WPM).
 * Only computes if start and end seconds are provided and end > start.
 * Otherwise returns null (unknown).
 */
export function calculateReadingBurden(
  wordCount: number,
  startSeconds: number | null,
  endSeconds: number | null
): number | null {
  if (
    startSeconds === null ||
    endSeconds === null ||
    startSeconds < 0 ||
    endSeconds <= startSeconds
  ) {
    return null;
  }
  const durationSeconds = endSeconds - startSeconds;
  if (durationSeconds <= 0) return null;
  const minutes = durationSeconds / 60;
  return Math.round(wordCount / minutes);
}

/**
 * Categorizes WPM into descriptive density bands without predicting engagement.
 */
export function categorizeWpmDensity(
  wpm: number | null
): { level: 'unknown' | 'low' | 'moderate' | 'dense' | 'overload'; label: string } {
  if (wpm === null) {
    return { level: 'unknown', label: 'Unspecified timing' };
  }
  if (wpm <= 130) {
    return { level: 'low', label: `${wpm} WPM · Relaxed pace` };
  }
  if (wpm <= 165) {
    return { level: 'moderate', label: `${wpm} WPM · Standard spoken pace` };
  }
  if (wpm <= 200) {
    return { level: 'dense', label: `${wpm} WPM · High information density` };
  }
  return { level: 'overload', label: `${wpm} WPM · Rapid speech / dense` };
}

/**
 * Pure deterministic parser for script scenes.
 * Strictly splits on explicit delimiters:
 * - `Scene N:`
 * - `[0:00 - 0:05]` or `[0:00-0:05]` or `[0:00]`
 * - `Hook:`, `Problem:`, `Demo:`, `Proof:`, `CTA:`, `Body:`
 * - Blank-line separated paragraphs
 */
export function parseScriptScenes(rawText: string): ParsedScene[] {
  if (!rawText || !rawText.trim()) {
    return [];
  }

  const lines = rawText.split(/\r?\n/);
  const blocks: {
    rawLines: string[];
    explicitPurpose?: ShotPurpose;
    startSeconds: number | null;
    endSeconds: number | null;
    visualNotes: string | null;
    onScreenText: string | null;
  }[] = [];

  let currentBlock: {
    rawLines: string[];
    explicitPurpose?: ShotPurpose;
    startSeconds: number | null;
    endSeconds: number | null;
    visualNotes: string | null;
    onScreenText: string | null;
  } = {
    rawLines: [],
    startSeconds: null,
    endSeconds: null,
    visualNotes: null,
    onScreenText: null,
  };

  const sceneHeaderRegex = /^(?:scene\s*\d+|hook|body|problem|demo|proof|cta|testimonial|intro|outro)[:\-\s]/i;
  const timecodeRangeRegex = /\[?(\d{1,2}:\d{2})\s*(?:-|–|to)\s*(\d{1,2}:\d{2})\]?/i;
  const visualNotesRegex = /\[(?:visual|action|screen|video):\s*([^\]]+)\]/i;
  const onScreenTextRegex = /\[(?:text|on-screen|caption|overlay):\s*([^\]]+)\]/i;

  function parseTimecodeToSeconds(tc: string): number {
    const [min, sec] = tc.split(':').map((s) => parseInt(s, 10));
    return (min || 0) * 60 + (sec || 0);
  }

  function flushCurrentBlock() {
    if (currentBlock.rawLines.length > 0 || currentBlock.visualNotes || currentBlock.onScreenText) {
      blocks.push(currentBlock);
      currentBlock = {
        rawLines: [],
        startSeconds: null,
        endSeconds: null,
        visualNotes: null,
        onScreenText: null,
      };
    }
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      // Blank line delimiter
      flushCurrentBlock();
      continue;
    }

    // Check for explicit timecode range
    const timeMatch = trimmed.match(timecodeRangeRegex);
    const isHeader = sceneHeaderRegex.test(trimmed);

    if (timeMatch || isHeader) {
      flushCurrentBlock();

      if (timeMatch) {
        currentBlock.startSeconds = parseTimecodeToSeconds(timeMatch[1]);
        currentBlock.endSeconds = parseTimecodeToSeconds(timeMatch[2]);
      }

      // Map explicit header to shot purpose
      const lower = trimmed.toLowerCase();
      if (lower.startsWith('hook')) currentBlock.explicitPurpose = 'hook';
      else if (lower.startsWith('problem')) currentBlock.explicitPurpose = 'problem_setup';
      else if (lower.startsWith('demo')) currentBlock.explicitPurpose = 'product_demonstration';
      else if (lower.startsWith('proof') || lower.startsWith('testimonial')) currentBlock.explicitPurpose = 'proof_testimonial';
      else if (lower.startsWith('cta')) currentBlock.explicitPurpose = 'cta';

      // Check if the same line contains transcript, visual notes, or on-screen text after delimiter
      let cleanContent = trimmed
        .replace(timecodeRangeRegex, '')
        .replace(sceneHeaderRegex, '')
        .trim();

      const visMatch = cleanContent.match(visualNotesRegex);
      if (visMatch) {
        currentBlock.visualNotes = visMatch[1].trim();
        cleanContent = cleanContent.replace(visualNotesRegex, '').trim();
      }

      const ostMatch = cleanContent.match(onScreenTextRegex);
      if (ostMatch) {
        currentBlock.onScreenText = ostMatch[1].trim();
        cleanContent = cleanContent.replace(onScreenTextRegex, '').trim();
      }

      if (cleanContent) {
        currentBlock.rawLines.push(cleanContent);
      }
      continue;
    }

    // Check for provided visual notes [Visual: ...] on non-header lines
    const visMatch = trimmed.match(visualNotesRegex);
    if (visMatch) {
      currentBlock.visualNotes = visMatch[1].trim();
      const remaining = trimmed.replace(visualNotesRegex, '').trim();
      if (remaining) currentBlock.rawLines.push(remaining);
      continue;
    }

    // Check for on-screen text [Text: ...] on non-header lines
    const ostMatch = trimmed.match(onScreenTextRegex);
    if (ostMatch) {
      currentBlock.onScreenText = ostMatch[1].trim();
      const remaining = trimmed.replace(onScreenTextRegex, '').trim();
      if (remaining) currentBlock.rawLines.push(remaining);
      continue;
    }

    currentBlock.rawLines.push(trimmed);
  }

  flushCurrentBlock();

  // If no blocks were created (e.g. single unformatted line), wrap raw text
  if (blocks.length === 0 && rawText.trim()) {
    blocks.push({
      rawLines: [rawText.trim()],
      startSeconds: null,
      endSeconds: null,
      visualNotes: null,
      onScreenText: null,
    });
  }

  return blocks.map((b, idx) => {
    const transcript = b.rawLines.join(' ').trim();
    const wordCount = transcript ? transcript.split(/\s+/).filter(Boolean).length : 0;
    const wpm = calculateReadingBurden(wordCount, b.startSeconds, b.endSeconds);

    let purpose: ShotPurpose = b.explicitPurpose || 'other';
    if (!b.explicitPurpose) {
      // First scene without explicit header defaults to hook if it's index 0, or other
      purpose = idx === 0 ? 'hook' : 'other';
    }

    return {
      sceneIndex: idx,
      startSeconds: b.startSeconds,
      endSeconds: b.endSeconds,
      shotPurpose: purpose,
      spokenTranscript: transcript,
      onScreenText: b.onScreenText,
      providedVisualNotes: b.visualNotes,
      readingBurdenWpm: wpm,
    };
  });
}

/**
 * Deterministic claim candidate extractor with character offsets.
 * Cross-references text with Brand Codex claims.
 */
export function extractDeterministicClaims(
  rawText: string,
  brandClaims: BrandClaimRow[] = []
): ExtractedClaimCandidate[] {
  if (!rawText || !rawText.trim()) {
    return [];
  }

  const candidates: ExtractedClaimCandidate[] = [];
  const normalizedFullText = rawText.toLowerCase();

  // 1. Check for exact matches against Brand Codex claims
  for (const bc of brandClaims) {
    if (!bc.claim_text || !bc.claim_text.trim()) continue;
    const normBrandClaim = bc.claim_text.trim().toLowerCase();
    const offset = normalizedFullText.indexOf(normBrandClaim);

    if (offset !== -1) {
      const excerptStart = Math.max(0, offset - 20);
      const excerptEnd = Math.min(rawText.length, offset + normBrandClaim.length + 20);
      const excerpt = rawText.slice(excerptStart, excerptEnd);

      candidates.push({
        claimText: bc.claim_text,
        claimClassification: (bc.claim_type as ClaimClassification) || 'explicit_brand_promise',
        brandAlignmentStatus: 'exact_brand_claim_match',
        matchingBrandClaimId: bc.id,
        sourceCharOffsetStart: offset,
        sourceCharOffsetEnd: offset + normBrandClaim.length,
        sourceExcerpt: excerpt,
        proofReference: bc.source_reference || null,
        sceneIndices: [],
      });
    }
  }

  // 2. Deterministic Regex patterns for assertion candidates
  const patterns: {
    regex: RegExp;
    classification: ClaimClassification;
  }[] = [
    // Numerics & percentages (e.g. "saves 40%", "10x faster", "$500 a month", "in 2 minutes")
    {
      regex: /(?:\b\d+(?:\.\d+)?%|\b\d+x\b|\$\d+(?:,\d+)?|\b\d+\s+(?:minutes?|hours?|days?|seconds?|weeks?|months?|years?)\b)/gi,
      classification: 'numeric_outcome',
    },
    // Comparative & Superlative assertions (e.g. "better than", "faster than", "#1 rated", "most reliable")
    {
      regex: /\b(?:#1|best in class|faster(?:\s+than)?|better(?:\s+than)?|more reliable|easiest way|leading platform)\b/gi,
      classification: 'comparative_advantage',
    },
    // Absolute Promises & Guarantees (e.g. "guaranteed", "proven to", "never fail", "100% money back")
    {
      regex: /\b(?:guaranteed|proven to|never lose|100% risk free|money back guarantee|lifetime warranty)\b/gi,
      classification: 'explicit_brand_promise',
    },
    // Testimonial & Social Endorsement markers (e.g. "customers love", "users say", "rated 5 stars")
    {
      regex: /\b(?:users say|customers love|rated 5 stars|trusted by|as featured in|reviews show)\b/gi,
      classification: 'testimonial_endorsement',
    },
  ];

  for (const { regex, classification } of patterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(rawText)) !== null) {
      const matchText = match[0];
      const matchIndex = match.index;

      // Extract bounding sentence / clause for context
      const clauseStart = Math.max(0, rawText.lastIndexOf('.', matchIndex) + 1);
      let clauseEnd = rawText.indexOf('.', matchIndex + matchText.length);
      if (clauseEnd === -1) clauseEnd = rawText.length;
      const sentenceExcerpt = rawText.slice(clauseStart, clauseEnd).trim();

      // Check if this overlaps with an already extracted exact brand claim
      const isDuplicate = candidates.some(
        (c) =>
          c.sourceCharOffsetStart <= matchIndex &&
          c.sourceCharOffsetEnd >= matchIndex + matchText.length
      );

      if (!isDuplicate) {
        // Check for partial keyword overlap with Brand Codex
        let alignment: BrandAlignmentStatus = 'no_brand_claim_match';
        let matchedBrandClaimId: string | null = null;

        for (const bc of brandClaims) {
          const bcWords = bc.claim_text.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
          const sentenceWords = sentenceExcerpt.toLowerCase().split(/\s+/);
          const overlap = bcWords.filter((w) => sentenceWords.includes(w));
          if (overlap.length >= 3) {
            alignment = 'possible_term_overlap';
            matchedBrandClaimId = bc.id;
            break;
          }
        }

        candidates.push({
          claimText: sentenceExcerpt || matchText,
          claimClassification: classification,
          brandAlignmentStatus: alignment,
          matchingBrandClaimId: matchedBrandClaimId,
          sourceCharOffsetStart: matchIndex,
          sourceCharOffsetEnd: matchIndex + matchText.length,
          sourceExcerpt: sentenceExcerpt || matchText,
          proofReference: null,
          sceneIndices: [],
        });
      }
    }
  }

  return candidates;
}

// -----------------------------------------------------------------------------
// Database Operations with Tenant Isolation & Atomic Snapshots
// -----------------------------------------------------------------------------

/**
 * Decomposes a text asset into a structured Creative Twin (scenes + claims + initial Version 1 snapshot).
 */
export async function initializeStructuredTwin(
  twinId: string,
  workspaceId: string,
  userId: string,
  rawScript: string
): Promise<{ success: boolean; scenesCount: number; claimsCount: number; error?: string }> {
  try {
    // 1. Fetch brand claims for workspace alignment
    const { data: brandClaims } = await supabase
      .from('brand_claims')
      .select('*')
      .eq('workspace_id', workspaceId);

    // 2. Deterministically parse scenes and extract claims
    const parsedScenes = parseScriptScenes(rawScript);
    const extractedClaims = extractDeterministicClaims(rawScript, brandClaims || []);

    // 3. Clear existing auto-extracted scenes & claims if re-parsing
    await supabase.from('creative_scenes').delete().eq('twin_id', twinId).eq('workspace_id', workspaceId);
    await supabase.from('creative_claims').delete().eq('twin_id', twinId).eq('workspace_id', workspaceId);

    // 4. Insert scenes
    if (parsedScenes.length > 0) {
      const sceneRows = parsedScenes.map((s) => ({
        twin_id: twinId,
        workspace_id: workspaceId,
        scene_index: s.sceneIndex,
        start_seconds: s.startSeconds,
        end_seconds: s.endSeconds,
        shot_purpose: s.shotPurpose,
        spoken_transcript: s.spokenTranscript,
        on_screen_text: s.onScreenText,
        provided_visual_notes: s.providedVisualNotes,
        reading_burden_wpm: s.readingBurdenWpm,
        is_user_corrected: false,
      }));

      const { error: sceneError } = await supabase.from('creative_scenes').insert(sceneRows);
      if (sceneError) throw sceneError;
    }

    // 5. Insert claims
    if (extractedClaims.length > 0) {
      const claimRows = extractedClaims.map((c) => ({
        twin_id: twinId,
        workspace_id: workspaceId,
        brand_claim_id: c.matchingBrandClaimId,
        claim_text: c.claimText,
        claim_classification: c.claimClassification,
        brand_alignment_status: c.brandAlignmentStatus,
        extraction_method: 'deterministic_regex',
        source_char_offset_start: c.sourceCharOffsetStart,
        source_char_offset_end: c.sourceCharOffsetEnd,
        source_excerpt: c.sourceExcerpt,
        proof_reference: c.proofReference,
        scene_indices: c.sceneIndices,
        is_user_corrected: false,
      }));

      const { error: claimError } = await supabase.from('creative_claims').insert(claimRows);
      if (claimError) throw claimError;
    }

    // 6. Record Initial Version 1 Snapshot
    const { data: twinData } = await supabase
      .from('creative_twins')
      .select('*')
      .eq('id', twinId)
      .eq('workspace_id', workspaceId)
      .single();

    const snapshot = {
      twin_id: twinId,
      title: twinData?.title || 'Creative Twin',
      asset_kind: twinData?.asset_kind || 'script',
      declared_platform: twinData?.declared_platform || null,
      declared_objective: twinData?.declared_objective || null,
      deterministic_features: twinData?.deterministic_features || {},
      known_gaps: twinData?.known_gaps || [],
      state: 'grounded_stub',
      scenes: parsedScenes,
      claims: extractedClaims,
      snapshotted_at: new Date().toISOString(),
    };

    // Check if Version 1 already exists
    const { data: existingVersions } = await supabase
      .from('creative_twin_versions')
      .select('version_number')
      .eq('twin_id', twinId)
      .eq('workspace_id', workspaceId)
      .eq('version_number', 1);

    if (!existingVersions || existingVersions.length === 0) {
      await supabase.from('creative_twin_versions').insert({
        twin_id: twinId,
        workspace_id: workspaceId,
        version_number: 1,
        snapshot: snapshot as unknown as Database['public']['Tables']['creative_twin_versions']['Insert']['snapshot'],
        change_summary: 'Initial deterministic decomposition from raw text asset',
        created_by: userId,
      });
    }

    return {
      success: true,
      scenesCount: parsedScenes.length,
      claimsCount: extractedClaims.length,
    };
  } catch (err: unknown) {
    return {
      success: false,
      scenesCount: 0,
      claimsCount: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Fetches the complete structured Creative Twin with scenes, claims, and version history.
 */
export async function fetchStructuredTwin(
  twinId: string,
  workspaceId: string
): Promise<{ data: StructuredTwinDetails | null; error?: string }> {
  try {
    const { data: twin, error: twinError } = await supabase
      .from('creative_twins')
      .select('*')
      .eq('id', twinId)
      .eq('workspace_id', workspaceId)
      .single();

    if (twinError || !twin) {
      return { data: null, error: twinError?.message || 'Twin not found' };
    }

    const { data: scenes, error: scenesError } = await supabase
      .from('creative_scenes')
      .select('*')
      .eq('twin_id', twinId)
      .eq('workspace_id', workspaceId)
      .order('scene_index', { ascending: true });

    if (scenesError) {
      return { data: null, error: scenesError.message };
    }

    const { data: claims, error: claimsError } = await supabase
      .from('creative_claims')
      .select('*')
      .eq('twin_id', twinId)
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });

    if (claimsError) {
      return { data: null, error: claimsError.message };
    }

    const { data: versions, error: versionsError } = await supabase
      .from('creative_twin_versions')
      .select('*')
      .eq('twin_id', twinId)
      .eq('workspace_id', workspaceId)
      .order('version_number', { ascending: false });

    if (versionsError) {
      return { data: null, error: versionsError.message };
    }

    return {
      data: {
        twin,
        scenes: scenes || [],
        claims: claims || [],
        versions: versions || [],
      },
    };
  } catch (err: unknown) {
    return { data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Atomically updates a scene and records an immutable version snapshot via PostgreSQL stored procedure.
 */
export async function correctSceneAtomic(
  sceneId: string,
  workspaceId: string,
  _userId: string,
  updates: {
    shotPurpose: ShotPurpose;
    spokenTranscript: string;
    onScreenText: string | null;
    providedVisualNotes: string | null;
    startSeconds: number | null;
    endSeconds: number | null;
    readingBurdenWpm: number | null;
  },
  changeSummary: string
): Promise<{ success: boolean; newVersionNumber?: number; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('save_scene_correction_atomic', {
      p_scene_id: sceneId,
      p_workspace_id: workspaceId,
      p_shot_purpose: updates.shotPurpose,
      p_spoken_transcript: updates.spokenTranscript,
      p_on_screen_text: updates.onScreenText || '',
      p_provided_visual_notes: updates.providedVisualNotes || '',
      p_start_seconds: updates.startSeconds as unknown as number,
      p_end_seconds: updates.endSeconds as unknown as number,
      p_reading_burden_wpm: updates.readingBurdenWpm as unknown as number,
      p_change_summary: changeSummary,
    });

    if (error) throw error;
    const result = data as { version_number: number };
    return { success: true, newVersionNumber: result?.version_number };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Atomically updates a claim and records an immutable version snapshot via PostgreSQL stored procedure.
 */
export async function correctClaimAtomic(
  claimId: string,
  workspaceId: string,
  _userId: string,
  updates: {
    brandClaimId: string | null;
    claimText: string;
    claimClassification: ClaimClassification;
    brandAlignmentStatus: BrandAlignmentStatus;
    proofReference: string | null;
  },
  changeSummary: string
): Promise<{ success: boolean; newVersionNumber?: number; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('save_claim_correction_atomic', {
      p_claim_id: claimId,
      p_workspace_id: workspaceId,
      p_brand_claim_id: updates.brandClaimId || '',
      p_claim_text: updates.claimText,
      p_claim_classification: updates.claimClassification,
      p_brand_alignment_status: updates.brandAlignmentStatus,
      p_proof_reference: updates.proofReference || '',
      p_change_summary: changeSummary,
    });

    if (error) throw error;
    const result = data as { version_number: number };
    return { success: true, newVersionNumber: result?.version_number };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
