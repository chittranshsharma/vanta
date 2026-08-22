/**
 * Creative Doctor & Decision Matrix Pure Derivation Engine
 * 
 * Strict Evidence & Diagnostic Invariants:
 * 1. Uses canonical 5 Evidence Classes: 'observed' | 'sourced_claim' | 'inference' | 'simulation' | 'unknown'.
 * 2. All rule-generated conclusions use evidenceClass = 'inference' and derivationMethod = 'deterministic_rule'.
 * 3. Never predicts reach, virality, views, conversion, or platform algorithms.
 * 4. Separate lexical Brand Codex alignment from evidence substantiation and source citability.
 * 5. Audience state is explicitly declared 'unknown' until authorized audience data/simulations exist.
 * 6. Pure, in-memory derivation on read — never creates stale database records.
 */

import type { CreativeSceneRow, CreativeClaimRow, CreativeTwinRow } from './creativeTwin';
import type { BrandClaim } from './brandBrain';
import type { EvidenceClass } from './evidence';

export interface DiagnosticRulesConfig {
  version: string;
  earlyHookWindowSeconds: number; // default 3.0s (policy default)
  highReadingBurdenWpm: number; // default 180 WPM
  moderateReadingBurdenWpm: number; // default 140 WPM
}

export const DEFAULT_DIAGNOSTIC_RULES: DiagnosticRulesConfig = {
  version: '1.0.0',
  earlyHookWindowSeconds: 3.0,
  highReadingBurdenWpm: 180,
  moderateReadingBurdenWpm: 140,
};

export type DiagnosticSeverity = 'critical' | 'warning' | 'info' | 'gap';

export interface TimelineDiagnosis {
  id: string;
  ruleId: string;
  ruleVersion: string;
  ruleTitle: string;
  sceneId: string | null;
  sceneIndex: number | null;
  severity: DiagnosticSeverity;
  evidenceClass: EvidenceClass; // Strictly 5 classes
  derivationMethod: 'deterministic_rule';
  timeWindow: {
    start: number | null;
    end: number | null;
  };
  observedFact: string; // The verifiable input
  findingExplanation: string; // The neutral policy interpretation
  recommendedEdit: string; // Actionable, rule-grounded edit suggestion
  inputReferences: {
    field: string;
    rawValue: string | number | null;
    sceneIndex?: number;
    claimId?: string;
  }[];
}

/**
 * Pure evaluation of sequential timeline diagnostics for a creative twin.
 */
export function deriveTimelineDiagnostics(
  twin: Pick<CreativeTwinRow, 'id' | 'title' | 'asset_kind' | 'known_gaps'>,
  scenes: CreativeSceneRow[],
  claims: CreativeClaimRow[],
  brandClaims: BrandClaim[] = [],
  config: DiagnosticRulesConfig = DEFAULT_DIAGNOSTIC_RULES
): TimelineDiagnosis[] {
  const diagnoses: TimelineDiagnosis[] = [];

  // -------------------------------------------------------------------
  // 1. Hook Placement & Identification (R-HOOK-001 / R-HOOK-002 / R-HOOK-GAP)
  // -------------------------------------------------------------------
  const hookScenes = scenes.filter((s) => s.shot_purpose === 'hook');

  if (scenes.length > 0 && hookScenes.length === 0) {
    diagnoses.push({
      id: `diag-hook-missing-${twin.id}`,
      ruleId: 'R-HOOK-001',
      ruleVersion: config.version,
      ruleTitle: 'No Hook Scene Identified',
      sceneId: null,
      sceneIndex: null,
      severity: 'warning',
      evidenceClass: 'inference',
      derivationMethod: 'deterministic_rule',
      timeWindow: { start: 0, end: null },
      observedFact: '0 scenes have shot_purpose = "hook" in the parsed asset.',
      findingExplanation:
        'Rule R-HOOK-001: Asset contains no scene explicitly designated as a hook. Workspace policy evaluates the initial scene as the hook candidate.',
      recommendedEdit:
        'Designate Scene 1 as "Hook" or add an explicit "Hook:" delimiter to clarify the opening premise.',
      inputReferences: [{ field: 'scenes.shot_purpose', rawValue: 'none' }],
    });
  } else if (hookScenes.length > 0) {
    const primaryHook = hookScenes[0];
    if (primaryHook.start_seconds === null) {
      diagnoses.push({
        id: `diag-hook-time-gap-${primaryHook.id}`,
        ruleId: 'R-HOOK-GAP',
        ruleVersion: config.version,
        ruleTitle: 'Hook Timecode Missing',
        sceneId: primaryHook.id,
        sceneIndex: primaryHook.scene_index,
        severity: 'gap',
        evidenceClass: 'unknown',
        derivationMethod: 'deterministic_rule',
        timeWindow: { start: null, end: null },
        observedFact: 'Hook scene has start_seconds = null and end_seconds = null.',
        findingExplanation:
          'Rule R-HOOK-GAP: Timestamp bounds are missing; early-hook window adherence cannot be verified.',
        recommendedEdit:
          'Add bracketed timecodes (e.g. [0:00 - 0:03]) to verify hook delivery timing.',
        inputReferences: [
          { field: 'start_seconds', rawValue: null, sceneIndex: primaryHook.scene_index },
          { field: 'end_seconds', rawValue: null, sceneIndex: primaryHook.scene_index },
        ],
      });
    } else if (primaryHook.start_seconds > config.earlyHookWindowSeconds) {
      diagnoses.push({
        id: `diag-hook-delayed-${primaryHook.id}`,
        ruleId: 'R-HOOK-002',
        ruleVersion: config.version,
        ruleTitle: 'Hook Begins After Configured Window',
        sceneId: primaryHook.id,
        sceneIndex: primaryHook.scene_index,
        severity: 'warning',
        evidenceClass: 'inference',
        derivationMethod: 'deterministic_rule',
        timeWindow: { start: primaryHook.start_seconds, end: primaryHook.end_seconds },
        observedFact: `Hook starts at ${primaryHook.start_seconds}s (configured threshold is <= ${config.earlyHookWindowSeconds}s).`,
        findingExplanation: `Rule R-HOOK-002: Hook begins after the workspace's configured early-hook window (${config.earlyHookWindowSeconds}s; policy threshold, not a reach prediction).`,
        recommendedEdit: `Move opening core assertion or hook premise forward to start within 0.0s–${config.earlyHookWindowSeconds}s.`,
        inputReferences: [
          {
            field: 'start_seconds',
            rawValue: primaryHook.start_seconds,
            sceneIndex: primaryHook.scene_index,
          },
        ],
      });
    }
  }

  // -------------------------------------------------------------------
  // 2. Reading Burden & Spoken Density (R-PACE-001 / R-PACE-GAP)
  // -------------------------------------------------------------------
  scenes.forEach((scene) => {
    if (scene.spoken_transcript && scene.spoken_transcript.trim().length > 0) {
      if (scene.reading_burden_wpm === null) {
        diagnoses.push({
          id: `diag-pace-gap-${scene.id}`,
          ruleId: 'R-PACE-GAP',
          ruleVersion: config.version,
          ruleTitle: 'Spoken Pacing Unmeasured (Missing Timecodes)',
          sceneId: scene.id,
          sceneIndex: scene.scene_index,
          severity: 'gap',
          evidenceClass: 'unknown',
          derivationMethod: 'deterministic_rule',
          timeWindow: { start: scene.start_seconds, end: scene.end_seconds },
          observedFact: `Scene contains ${scene.spoken_transcript.trim().split(/\s+/).length} spoken words with unmeasured duration.`,
          findingExplanation:
            'Rule R-PACE-GAP: Words Per Minute cannot be calculated without valid start and end timecodes.',
          recommendedEdit: 'Provide start and end timecodes for this scene to calculate WPM pacing density.',
          inputReferences: [
            { field: 'reading_burden_wpm', rawValue: null, sceneIndex: scene.scene_index },
          ],
        });
      } else if (scene.reading_burden_wpm > config.highReadingBurdenWpm) {
        diagnoses.push({
          id: `diag-pace-high-${scene.id}`,
          ruleId: 'R-PACE-001',
          ruleVersion: config.version,
          ruleTitle: 'High Reading Burden / Dense Spoken Pace',
          sceneId: scene.id,
          sceneIndex: scene.scene_index,
          severity: 'warning',
          evidenceClass: 'inference',
          derivationMethod: 'deterministic_rule',
          timeWindow: { start: scene.start_seconds, end: scene.end_seconds },
          observedFact: `Measured spoken pace is ${scene.reading_burden_wpm} WPM (threshold is > ${config.highReadingBurdenWpm} WPM).`,
          findingExplanation: `Rule R-PACE-001: Spoken density exceeds the ${config.highReadingBurdenWpm} WPM dense threshold. Natural conversational pace typically sits between 130–160 WPM.`,
          recommendedEdit:
            'Reduce word count in this scene or extend the allotted duration to lower spoken density.',
          inputReferences: [
            { field: 'reading_burden_wpm', rawValue: scene.reading_burden_wpm, sceneIndex: scene.scene_index },
          ],
        });
      }
    }
  });

  // -------------------------------------------------------------------
  // 3. Claim Substantiation & Brand Alignment (R-CLAIM-001 / R-CLAIM-002)
  // -------------------------------------------------------------------
  claims.forEach((claim) => {
    const hasProofRef = Boolean(claim.proof_reference && claim.proof_reference.trim().length > 0);
    const isExactBrandMatch = claim.brand_alignment_status === 'exact_brand_claim_match';

    if (claim.claim_classification === 'numeric_outcome' && !hasProofRef) {
      diagnoses.push({
        id: `diag-claim-numeric-${claim.id}`,
        ruleId: 'R-CLAIM-001',
        ruleVersion: config.version,
        ruleTitle: 'Unsubstantiated Numeric Outcome Claim',
        sceneId: null,
        sceneIndex: claim.scene_indices?.[0] ?? null,
        severity: 'warning',
        evidenceClass: 'inference',
        derivationMethod: 'deterministic_rule',
        timeWindow: { start: null, end: null },
        observedFact: `Claim "${claim.claim_text}" asserts a numeric metric without a proof citation URL/reference.`,
        findingExplanation:
          'Rule R-CLAIM-001: Specific numeric claims require verifiable source citations or Brand Codex linkage under evidence-first policy.',
        recommendedEdit:
          'Link this claim to an approved Brand Codex claim or add a specific proof citation URL/source reference.',
        inputReferences: [
          { field: 'claim_text', rawValue: claim.claim_text, claimId: claim.id },
          { field: 'proof_reference', rawValue: claim.proof_reference, claimId: claim.id },
        ],
      });
    }

    if (claim.claim_classification === 'comparative_advantage' && !hasProofRef && !isExactBrandMatch) {
      diagnoses.push({
        id: `diag-claim-comp-${claim.id}`,
        ruleId: 'R-CLAIM-002',
        ruleVersion: config.version,
        ruleTitle: 'Comparative Advantage Lacks Direct Verification',
        sceneId: null,
        sceneIndex: claim.scene_indices?.[0] ?? null,
        severity: 'info',
        evidenceClass: 'inference',
        derivationMethod: 'deterministic_rule',
        timeWindow: { start: null, end: null },
        observedFact: `Comparative assertion "${claim.claim_text}" has neither Brand Codex match nor attached proof reference.`,
        findingExplanation:
          'Rule R-CLAIM-002: Comparative superiority statements should be supported by documented proof points to meet Brand Brain compliance standards.',
        recommendedEdit:
          'Verify competitive differentiation against Brand Brain guidelines or attach supporting documentation.',
        inputReferences: [
          { field: 'claim_classification', rawValue: 'comparative_advantage', claimId: claim.id },
        ],
      });
    }
  });

  // -------------------------------------------------------------------
  // 4. Call-to-Action (CTA) Presence (R-CTA-001)
  // -------------------------------------------------------------------
  const ctaScenes = scenes.filter((s) => s.shot_purpose === 'cta');
  if (scenes.length > 0 && ctaScenes.length === 0) {
    diagnoses.push({
      id: `diag-cta-missing-${twin.id}`,
      ruleId: 'R-CTA-001',
      ruleVersion: config.version,
      ruleTitle: 'No Explicit Call-to-Action Scene',
      sceneId: null,
      sceneIndex: null,
      severity: 'warning',
      evidenceClass: 'inference',
      derivationMethod: 'deterministic_rule',
      timeWindow: { start: null, end: null },
      observedFact: '0 scenes designated with shot_purpose = "cta".',
      findingExplanation:
        'Rule R-CTA-001: Asset lacks a clear terminal Call to Action indicating the intended user next step.',
      recommendedEdit: 'Add a closing CTA scene with specific next-step guidance (e.g., website visit, trial signup).',
      inputReferences: [{ field: 'scenes.shot_purpose', rawValue: 'none' }],
    });
  }

  // -------------------------------------------------------------------
  // 5. Visual Context Gaps (R-VIS-GAP)
  // -------------------------------------------------------------------
  if (twin.asset_kind === 'script') {
    const scenesWithVisualNotes = scenes.filter(
      (s) => s.provided_visual_notes && s.provided_visual_notes.trim().length > 0
    );
    if (scenes.length > 0 && scenesWithVisualNotes.length === 0) {
      diagnoses.push({
        id: `diag-vis-gap-${twin.id}`,
        ruleId: 'R-VIS-GAP',
        ruleVersion: config.version,
        ruleTitle: 'Visual Context Missing (Text-Only Script)',
        sceneId: null,
        sceneIndex: null,
        severity: 'gap',
        evidenceClass: 'unknown',
        derivationMethod: 'deterministic_rule',
        timeWindow: { start: null, end: null },
        observedFact: 'No [Visual: ...] annotations provided in script scenes.',
        findingExplanation:
          'Rule R-VIS-GAP: Visual pacing, framing, and on-screen demonstration actions remain unrecorded. Timeline Doctor can only evaluate textual and timestamped attributes.',
        recommendedEdit:
          'Add user visual notes (e.g. [Visual: Founder holds product toward camera]) to ground on-screen actions.',
        inputReferences: [{ field: 'provided_visual_notes', rawValue: null }],
      });
    }
  }

  return diagnoses;
}

// =====================================================================
// CREATIVE DECISION MATRIX PURE DERIVATION
// =====================================================================

export interface VariantComparisonCell {
  label: string;
  value: string | number | null;
  formattedValue: string;
  evidenceClass: EvidenceClass; // Strictly 5 classes
  calculationProvenance: string;
  status: 'pass' | 'warning' | 'critical' | 'gap' | 'neutral';
}

export interface MatrixDimensionRow {
  dimensionKey: string;
  dimensionTitle: string;
  category: 'hook' | 'pacing' | 'brand_codex' | 'evidence_substantiation' | 'cta' | 'visual_context' | 'audience';
  policyDescription: string;
  cellsByTwinId: Record<string, VariantComparisonCell>;
}

export interface DecisionMatrixReport {
  generatedAt: string;
  rulesVersion: string;
  twins: { id: string; title: string; assetKind: string }[];
  rows: MatrixDimensionRow[];
  summary: {
    twinId: string;
    totalScenes: number;
    timedScenesCount: number;
    totalClaimsCount: number;
    exactBrandMatchesCount: number;
    claimsWithProofCitationCount: number;
    diagnosesCount: { critical: number; warning: number; info: number; gap: number };
  }[];
}

/**
 * Pure evaluation comparing 2 or more creative twins side-by-side.
 * Never predicts virality, reach, conversion, or algorithm preference.
 */
export function generateDecisionMatrix(
  twins: Pick<CreativeTwinRow, 'id' | 'title' | 'asset_kind' | 'known_gaps'>[],
  scenesByTwinId: Record<string, CreativeSceneRow[]>,
  claimsByTwinId: Record<string, CreativeClaimRow[]>,
  brandClaims: BrandClaim[] = [],
  config: DiagnosticRulesConfig = DEFAULT_DIAGNOSTIC_RULES
): DecisionMatrixReport {
  const rows: MatrixDimensionRow[] = [];

  // Helper to extract hook scene
  const getHook = (twinId: string) => {
    const scenes = scenesByTwinId[twinId] || [];
    return scenes.find((s) => s.shot_purpose === 'hook') || scenes[0];
  };

  // 1. Hook Placement (Observed start seconds)
  const hookTimingCells: Record<string, VariantComparisonCell> = {};
  twins.forEach((t) => {
    const hook = getHook(t.id);
    if (!hook) {
      hookTimingCells[t.id] = {
        label: 'Hook Start',
        value: null,
        formattedValue: 'No scenes',
        evidenceClass: 'unknown',
        calculationProvenance: 'Asset contains 0 parsed scenes.',
        status: 'critical',
      };
    } else if (hook.start_seconds === null) {
      hookTimingCells[t.id] = {
        label: 'Hook Start',
        value: null,
        formattedValue: 'Unknown (no timecode)',
        evidenceClass: 'unknown',
        calculationProvenance: 'No user timecode supplied in scene metadata.',
        status: 'gap',
      };
    } else {
      const isEarly = hook.start_seconds <= config.earlyHookWindowSeconds;
      hookTimingCells[t.id] = {
        label: 'Hook Start',
        value: hook.start_seconds,
        formattedValue: `${hook.start_seconds.toFixed(1)}s`,
        evidenceClass: 'observed',
        calculationProvenance: `User supplied timecode: Scene ${hook.scene_index + 1} begins at ${hook.start_seconds}s.`,
        status: isEarly ? 'pass' : 'warning',
      };
    }
  });

  rows.push({
    dimensionKey: 'hook_start_seconds',
    dimensionTitle: 'Hook Arrival Second',
    category: 'hook',
    policyDescription: `Workspace policy evaluates whether hook begins within ${config.earlyHookWindowSeconds}s.`,
    cellsByTwinId: hookTimingCells,
  });

  // 2. Hook Reading Density (Observed WPM)
  const hookPacingCells: Record<string, VariantComparisonCell> = {};
  twins.forEach((t) => {
    const hook = getHook(t.id);
    if (!hook || hook.reading_burden_wpm === null) {
      hookPacingCells[t.id] = {
        label: 'Hook WPM',
        value: null,
        formattedValue: 'Unknown WPM',
        evidenceClass: 'unknown',
        calculationProvenance: 'Missing valid timecodes prevent WPM derivation.',
        status: 'gap',
      };
    } else {
      const isDense = hook.reading_burden_wpm > config.highReadingBurdenWpm;
      hookPacingCells[t.id] = {
        label: 'Hook WPM',
        value: hook.reading_burden_wpm,
        formattedValue: `${hook.reading_burden_wpm} WPM`,
        evidenceClass: 'observed',
        calculationProvenance: `Calculated from ${hook.spoken_transcript?.trim().split(/\s+/).length || 0} words over ${(
          (hook.end_seconds || 0) - (hook.start_seconds || 0)
        ).toFixed(1)}s.`,
        status: isDense ? 'warning' : 'pass',
      };
    }
  });

  rows.push({
    dimensionKey: 'hook_reading_burden',
    dimensionTitle: 'Hook Spoken Pace (WPM)',
    category: 'pacing',
    policyDescription: `Pace > ${config.highReadingBurdenWpm} WPM is flagged as dense; conversational standard is 130–160 WPM.`,
    cellsByTwinId: hookPacingCells,
  });

  // 3. Peak Reading Burden (Maximum WPM across all scenes)
  const peakPacingCells: Record<string, VariantComparisonCell> = {};
  twins.forEach((t) => {
    const scenes = scenesByTwinId[t.id] || [];
    const wpms = scenes
      .map((s) => s.reading_burden_wpm)
      .filter((wpm): wpm is number => wpm !== null && typeof wpm === 'number');

    if (wpms.length === 0) {
      peakPacingCells[t.id] = {
        label: 'Peak Pace',
        value: null,
        formattedValue: 'Unknown WPM',
        evidenceClass: 'unknown',
        calculationProvenance: 'No scenes contain timestamped WPM metrics.',
        status: 'gap',
      };
    } else {
      const peak = Math.max(...wpms);
      peakPacingCells[t.id] = {
        label: 'Peak Pace',
        value: peak,
        formattedValue: `${peak} WPM`,
        evidenceClass: 'observed',
        calculationProvenance: `Maximum WPM observed across ${wpms.length} timestamped scenes.`,
        status: peak > config.highReadingBurdenWpm ? 'warning' : 'pass',
      };
    }
  });

  rows.push({
    dimensionKey: 'peak_reading_burden',
    dimensionTitle: 'Peak Scene Spoken Pace',
    category: 'pacing',
    policyDescription: 'Identifies the highest reading density moment across all scenes.',
    cellsByTwinId: peakPacingCells,
  });

  // 4. Lexical Brand Codex Alignment (Count & Status)
  const brandAlignmentCells: Record<string, VariantComparisonCell> = {};
  twins.forEach((t) => {
    const claims = claimsByTwinId[t.id] || [];
    const exactMatches = claims.filter((c) => c.brand_alignment_status === 'exact_brand_claim_match').length;
    const partialMatches = claims.filter((c) => c.brand_alignment_status === 'possible_term_overlap').length;

    brandAlignmentCells[t.id] = {
      label: 'Brand Codex Alignment',
      value: exactMatches,
      formattedValue: `${exactMatches} exact / ${partialMatches} overlap / ${claims.length} total`,
      evidenceClass: 'inference',
      calculationProvenance: 'Deterministic lexical string matching against workspace Brand Codex claims.',
      status: exactMatches > 0 ? 'pass' : claims.length === 0 ? 'neutral' : 'warning',
    };
  });

  rows.push({
    dimensionKey: 'brand_codex_alignment',
    dimensionTitle: 'Brand Codex Lexical Matches',
    category: 'brand_codex',
    policyDescription: 'Lexical alignment between script assertions and active Brand Brain claims.',
    cellsByTwinId: brandAlignmentCells,
  });

  // 5. Evidence Substantiation & Citations (Proof citations attached)
  const proofCitationCells: Record<string, VariantComparisonCell> = {};
  twins.forEach((t) => {
    const claims = claimsByTwinId[t.id] || [];
    const citedClaims = claims.filter((c) => c.proof_reference && c.proof_reference.trim().length > 0).length;

    proofCitationCells[t.id] = {
      label: 'Cited Proofs',
      value: citedClaims,
      formattedValue: `${citedClaims} of ${claims.length} claims cited`,
      evidenceClass: 'observed',
      calculationProvenance: 'Verified presence of explicit proof_reference URL or document ID on claims.',
      status: claims.length === 0 ? 'neutral' : citedClaims === claims.length ? 'pass' : 'warning',
    };
  });

  rows.push({
    dimensionKey: 'proof_citation_coverage',
    dimensionTitle: 'Proof Citation Coverage',
    category: 'evidence_substantiation',
    policyDescription: 'Separate from Brand Codex matching: tracks explicit backing evidence URLs/references.',
    cellsByTwinId: proofCitationCells,
  });

  // 6. Call to Action (CTA) Clarity
  const ctaCells: Record<string, VariantComparisonCell> = {};
  twins.forEach((t) => {
    const scenes = scenesByTwinId[t.id] || [];
    const cta = scenes.find((s) => s.shot_purpose === 'cta');

    if (!cta) {
      ctaCells[t.id] = {
        label: 'CTA Scene',
        value: 'missing',
        formattedValue: 'Missing CTA',
        evidenceClass: 'inference',
        calculationProvenance: 'No scene with shot_purpose = "cta" found.',
        status: 'warning',
      };
    } else {
      ctaCells[t.id] = {
        label: 'CTA Scene',
        value: cta.scene_index,
        formattedValue: `Scene ${cta.scene_index + 1} (${cta.spoken_transcript?.slice(0, 30) || 'On-screen only'}…)`,
        evidenceClass: 'observed',
        calculationProvenance: `Identified CTA in Scene ${cta.scene_index + 1}.`,
        status: 'pass',
      };
    }
  });

  rows.push({
    dimensionKey: 'cta_presence',
    dimensionTitle: 'Call to Action (CTA)',
    category: 'cta',
    policyDescription: 'Verifies presence of terminal action directive in final scenes.',
    cellsByTwinId: ctaCells,
  });

  // 7. Audience Evidence (Honest Unknown State)
  const audienceCells: Record<string, VariantComparisonCell> = {};
  twins.forEach((t) => {
    audienceCells[t.id] = {
      label: 'Audience Evidence',
      value: null,
      formattedValue: 'Unknown (No audience data/simulation)',
      evidenceClass: 'unknown',
      calculationProvenance:
        'Audience evidence: unknown — no authorized audience data or simulation in this ticket.',
      status: 'neutral',
    };
  });

  rows.push({
    dimensionKey: 'audience_evidence_state',
    dimensionTitle: 'Audience Segment Fit',
    category: 'audience',
    policyDescription:
      'Honest boundary: Audience fit cannot be computed without verified audience data or an authorized simulation.',
    cellsByTwinId: audienceCells,
  });

  // 8. Known Unanalyzed Gaps
  const gapsCells: Record<string, VariantComparisonCell> = {};
  twins.forEach((t) => {
    const gaps = Array.isArray(t.known_gaps) ? (t.known_gaps as string[]) : [];
    gapsCells[t.id] = {
      label: 'Known Gaps',
      value: gaps.length,
      formattedValue: `${gaps.length} gaps recorded`,
      evidenceClass: 'observed',
      calculationProvenance: gaps.length > 0 ? `Unanalyzed: ${gaps.join(', ')}` : 'No known gaps.',
      status: gaps.length > 0 ? 'gap' : 'pass',
    };
  });

  rows.push({
    dimensionKey: 'known_gaps_count',
    dimensionTitle: 'Unanalyzed Media Dimensions',
    category: 'visual_context',
    policyDescription: 'Preserves honest gap disclosures (e.g. video visual pacing not analyzed).',
    cellsByTwinId: gapsCells,
  });

  // Summary aggregation
  const summary = twins.map((t) => {
    const scenes = scenesByTwinId[t.id] || [];
    const claims = claimsByTwinId[t.id] || [];
    const diags = deriveTimelineDiagnostics(t, scenes, claims, brandClaims, config);

    return {
      twinId: t.id,
      totalScenes: scenes.length,
      timedScenesCount: scenes.filter((s) => s.start_seconds !== null && s.end_seconds !== null).length,
      totalClaimsCount: claims.length,
      exactBrandMatchesCount: claims.filter((c) => c.brand_alignment_status === 'exact_brand_claim_match').length,
      claimsWithProofCitationCount: claims.filter((c) => c.proof_reference && c.proof_reference.trim().length > 0)
        .length,
      diagnosesCount: {
        critical: diags.filter((d) => d.severity === 'critical').length,
        warning: diags.filter((d) => d.severity === 'warning').length,
        info: diags.filter((d) => d.severity === 'info').length,
        gap: diags.filter((d) => d.severity === 'gap').length,
      },
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    rulesVersion: config.version,
    twins: twins.map((t) => ({ id: t.id, title: t.title, assetKind: t.asset_kind })),
    rows,
    summary,
  };
}
