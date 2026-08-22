import { describe, it, expect } from 'vitest';
import {
  deriveTimelineDiagnostics,
  generateDecisionMatrix,
  DEFAULT_DIAGNOSTIC_RULES,
  type TimelineDiagnosis,
} from './creativeDoctor';
import type { CreativeSceneRow, CreativeClaimRow, CreativeTwinRow } from './creativeTwin';
import type { BrandClaim } from './brandBrain';

describe('Creative Doctor & Decision Matrix Pure Derivation Engine', () => {
  const mockTwin: Pick<CreativeTwinRow, 'id' | 'title' | 'asset_kind' | 'known_gaps'> = {
    id: 'twin-100',
    title: 'Ad Script Variant A',
    asset_kind: 'script',
    known_gaps: ['video_visual_pacing_not_analyzed'],
  };

  const createScene = (partial: Partial<CreativeSceneRow>): CreativeSceneRow => ({
    id: `scene-${Math.random()}`,
    twin_id: 'twin-100',
    workspace_id: 'ws-100',
    scene_index: 0,
    shot_purpose: 'hook',
    spoken_transcript: 'Stop wasting money.',
    on_screen_text: null,
    provided_visual_notes: null,
    start_seconds: 0.0,
    end_seconds: 3.0,
    reading_burden_wpm: 120,
    is_user_corrected: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  });

  const createClaim = (partial: Partial<CreativeClaimRow>): CreativeClaimRow => ({
    id: `claim-${Math.random()}`,
    twin_id: 'twin-100',
    workspace_id: 'ws-100',
    brand_claim_id: null,
    claim_text: '10x Faster ROI',
    claim_classification: 'numeric_outcome',
    brand_alignment_status: 'no_brand_claim_match',
    extraction_method: 'deterministic_regex',
    source_char_offset_start: 0,
    source_char_offset_end: 14,
    source_excerpt: '10x Faster ROI Guaranteed',
    proof_reference: null,
    scene_indices: [0],
    is_user_corrected: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  });

  describe('1. Evidence Class & Neutral Policy Invariants', () => {
    it('uses only canonical 5 evidence classes and marks rule conclusions as inference', () => {
      const scenes = [
        createScene({
          scene_index: 0,
          shot_purpose: 'hook',
          start_seconds: 4.5,
          end_seconds: 7.0,
          reading_burden_wpm: 195,
        }),
      ];
      const diags = deriveTimelineDiagnostics(mockTwin, scenes, []);

      const validClasses = ['observed', 'sourced_claim', 'inference', 'simulation', 'unknown'];
      diags.forEach((d) => {
        expect(validClasses).toContain(d.evidenceClass);
        if (d.derivationMethod === 'deterministic_rule') {
          expect(['inference', 'unknown']).toContain(d.evidenceClass);
        }
      });
    });

    it('contains no reach, virality, or platform algorithm predictions in diagnostic texts', () => {
      const scenes = [
        createScene({ shot_purpose: 'hook', start_seconds: 5.0, reading_burden_wpm: 210 }),
      ];
      const claims = [createClaim({ claim_classification: 'numeric_outcome', proof_reference: null })];
      const diags = deriveTimelineDiagnostics(mockTwin, scenes, claims);

      const combinedText = diags.map((d) => `${d.findingExplanation} ${d.recommendedEdit}`).join(' ');

      expect(combinedText.toLowerCase()).not.toContain('virality');
      expect(combinedText.toLowerCase()).not.toContain('will perform better');
      expect(combinedText.toLowerCase()).not.toContain('algorithm');
      expect(combinedText.toLowerCase()).not.toContain('dropoff risk');
    });
  });

  describe('2. Hook Diagnostics (R-HOOK-001, R-HOOK-002, R-HOOK-GAP)', () => {
    it('flags missing hook when no scene has shot_purpose = hook', () => {
      const scenes = [createScene({ shot_purpose: 'problem_setup', scene_index: 0 })];
      const diags = deriveTimelineDiagnostics(mockTwin, scenes, []);

      const hookDiag = diags.find((d) => d.ruleId === 'R-HOOK-001');
      expect(hookDiag).toBeDefined();
      expect(hookDiag?.severity).toBe('warning');
      expect(hookDiag?.evidenceClass).toBe('inference');
    });

    it('flags delayed hook when hook start_seconds exceeds earlyHookWindowSeconds (3.0s)', () => {
      const scenes = [
        createScene({ shot_purpose: 'hook', start_seconds: 3.5, end_seconds: 6.0 }),
      ];
      const diags = deriveTimelineDiagnostics(mockTwin, scenes, []);

      const hookDiag = diags.find((d) => d.ruleId === 'R-HOOK-002');
      expect(hookDiag).toBeDefined();
      expect(hookDiag?.observedFact).toContain('3.5s');
      expect(hookDiag?.findingExplanation).toContain('Rule R-HOOK-002');
    });

    it('flags hook timecode gap when hook scene has null timestamps', () => {
      const scenes = [
        createScene({ shot_purpose: 'hook', start_seconds: null, end_seconds: null }),
      ];
      const diags = deriveTimelineDiagnostics(mockTwin, scenes, []);

      const gapDiag = diags.find((d) => d.ruleId === 'R-HOOK-GAP');
      expect(gapDiag).toBeDefined();
      expect(gapDiag?.severity).toBe('gap');
      expect(gapDiag?.evidenceClass).toBe('unknown');
    });
  });

  describe('3. Reading Burden & Pacing Diagnostics (R-PACE-001, R-PACE-GAP)', () => {
    it('flags high reading burden when scene WPM exceeds highReadingBurdenWpm (180 WPM)', () => {
      const scenes = [
        createScene({
          scene_index: 0,
          spoken_transcript: 'Fast rapid fire words spoken very quickly in succession.',
          start_seconds: 0.0,
          end_seconds: 2.0,
          reading_burden_wpm: 210,
        }),
      ];
      const diags = deriveTimelineDiagnostics(mockTwin, scenes, []);

      const paceDiag = diags.find((d) => d.ruleId === 'R-PACE-001');
      expect(paceDiag).toBeDefined();
      expect(paceDiag?.observedFact).toContain('210 WPM');
      expect(paceDiag?.severity).toBe('warning');
    });

    it('flags pacing gap when spoken text exists but timecodes / WPM are null', () => {
      const scenes = [
        createScene({
          scene_index: 0,
          spoken_transcript: 'Some spoken transcript without timecodes.',
          start_seconds: null,
          end_seconds: null,
          reading_burden_wpm: null,
        }),
      ];
      const diags = deriveTimelineDiagnostics(mockTwin, scenes, []);

      const paceGap = diags.find((d) => d.ruleId === 'R-PACE-GAP');
      expect(paceGap).toBeDefined();
      expect(paceGap?.severity).toBe('gap');
      expect(paceGap?.evidenceClass).toBe('unknown');
    });
  });

  describe('4. Claim Substantiation & Brand Codex Alignment (R-CLAIM-001, R-CLAIM-002)', () => {
    it('flags unsubstantiated numeric outcome when proof_reference is null', () => {
      const claims = [
        createClaim({
          claim_text: '40% cost reduction',
          claim_classification: 'numeric_outcome',
          proof_reference: null,
        }),
      ];
      const diags = deriveTimelineDiagnostics(mockTwin, [], claims);

      const claimDiag = diags.find((d) => d.ruleId === 'R-CLAIM-001');
      expect(claimDiag).toBeDefined();
      expect(claimDiag?.severity).toBe('warning');
      expect(claimDiag?.observedFact).toContain('40% cost reduction');
    });

    it('does not flag R-CLAIM-001 when proof_reference is provided', () => {
      const claims = [
        createClaim({
          claim_text: '40% cost reduction',
          claim_classification: 'numeric_outcome',
          proof_reference: 'https://example.com/case-study-2026',
        }),
      ];
      const diags = deriveTimelineDiagnostics(mockTwin, [], claims);

      const claimDiag = diags.find((d) => d.ruleId === 'R-CLAIM-001');
      expect(claimDiag).toBeUndefined();
    });
  });

  describe('5. Call to Action & Visual Gap Diagnostics (R-CTA-001, R-VIS-GAP)', () => {
    it('flags missing CTA when no scene has shot_purpose = cta', () => {
      const scenes = [createScene({ shot_purpose: 'hook', scene_index: 0 })];
      const diags = deriveTimelineDiagnostics(mockTwin, scenes, []);

      const ctaDiag = diags.find((d) => d.ruleId === 'R-CTA-001');
      expect(ctaDiag).toBeDefined();
      expect(ctaDiag?.severity).toBe('warning');
    });

    it('flags visual context gap for scripts lacking [Visual: ...] notes', () => {
      const scenes = [
        createScene({ shot_purpose: 'hook', provided_visual_notes: null }),
      ];
      const diags = deriveTimelineDiagnostics(mockTwin, scenes, []);

      const visGap = diags.find((d) => d.ruleId === 'R-VIS-GAP');
      expect(visGap).toBeDefined();
      expect(visGap?.severity).toBe('gap');
      expect(visGap?.evidenceClass).toBe('unknown');
    });
  });

  describe('6. Decision Matrix Pure Derivation (Multi-Variant Comparison)', () => {
    const twinA = { id: 'twin-A', title: 'Script A (Early Hook)', asset_kind: 'script', known_gaps: [] };
    const twinB = { id: 'twin-B', title: 'Script B (Late Hook)', asset_kind: 'script', known_gaps: ['no_video_visuals'] };

    const scenesA = [
      createScene({ twin_id: 'twin-A', shot_purpose: 'hook', start_seconds: 0.0, end_seconds: 2.5, reading_burden_wpm: 135 }),
      createScene({ twin_id: 'twin-A', shot_purpose: 'cta', start_seconds: 2.5, end_seconds: 5.0, reading_burden_wpm: 120 }),
    ];

    const scenesB = [
      createScene({ twin_id: 'twin-B', shot_purpose: 'problem_setup', start_seconds: 0.0, end_seconds: 4.0, reading_burden_wpm: 140 }),
      createScene({ twin_id: 'twin-B', shot_purpose: 'hook', start_seconds: 4.0, end_seconds: 7.0, reading_burden_wpm: 195 }),
      createScene({ twin_id: 'twin-B', shot_purpose: 'cta', start_seconds: 7.0, end_seconds: 10.0, reading_burden_wpm: 150 }),
    ];

    const claimsA = [
      createClaim({
        twin_id: 'twin-A',
        claim_text: 'Verified 2x Speed',
        brand_alignment_status: 'exact_brand_claim_match',
        proof_reference: 'https://docs.vanta.internal/proof/1',
      }),
    ];

    const claimsB = [
      createClaim({
        twin_id: 'twin-B',
        claim_text: 'Unverified 10x ROI',
        brand_alignment_status: 'no_brand_claim_match',
        proof_reference: null,
      }),
    ];

    it('generates multi-variant matrix with honest cell values and explicit evidence classes', () => {
      const matrix = generateDecisionMatrix(
        [twinA, twinB],
        { 'twin-A': scenesA, 'twin-B': scenesB },
        { 'twin-A': claimsA, 'twin-B': claimsB }
      );

      expect(matrix.twins).toHaveLength(2);
      expect(matrix.rows.length).toBeGreaterThanOrEqual(6);

      // Verify Hook Start Second Row
      const hookRow = matrix.rows.find((r) => r.dimensionKey === 'hook_start_seconds');
      expect(hookRow).toBeDefined();
      expect(hookRow?.cellsByTwinId['twin-A'].formattedValue).toBe('0.0s');
      expect(hookRow?.cellsByTwinId['twin-A'].status).toBe('pass');
      expect(hookRow?.cellsByTwinId['twin-B'].formattedValue).toBe('4.0s');
      expect(hookRow?.cellsByTwinId['twin-B'].status).toBe('warning');

      // Verify Proof Citation Row (separate from Brand Codex)
      const proofRow = matrix.rows.find((r) => r.dimensionKey === 'proof_citation_coverage');
      expect(proofRow).toBeDefined();
      expect(proofRow?.cellsByTwinId['twin-A'].formattedValue).toBe('1 of 1 claims cited');
      expect(proofRow?.cellsByTwinId['twin-B'].formattedValue).toBe('0 of 1 claims cited');

      // Verify Audience Evidence Row is explicitly unknown
      const audRow = matrix.rows.find((r) => r.dimensionKey === 'audience_evidence_state');
      expect(audRow).toBeDefined();
      expect(audRow?.cellsByTwinId['twin-A'].evidenceClass).toBe('unknown');
      expect(audRow?.cellsByTwinId['twin-A'].calculationProvenance).toContain('no authorized audience data');
    });
  });
});
