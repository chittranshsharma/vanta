import { describe, it, expect } from 'vitest';
import {
  parseScriptScenes,
  extractDeterministicClaims,
  calculateReadingBurden,
  categorizeWpmDensity,
  type BrandClaimRow,
} from './creativeTwin';

describe('Creative Twin Deterministic Expansion Suite (Ticket 4.1)', () => {
  describe('1. Script Scene Decomposition & Delimiter Parsing', () => {
    it('strictly splits on explicit scene headers and bracketed timecodes', () => {
      const script = `Hook: [0:00 - 0:03] Stop losing hours to manual video editing.
Problem: [0:03 - 0:08] Most creative teams waste 40% of their production budget on guesses.
Demo: [0:08 - 0:15] Vanta analyzes your script and checks every claim against the Brand Codex.
CTA: [0:15 - 0:20] Start your free trial today.`;

      const scenes = parseScriptScenes(script);
      expect(scenes).toHaveLength(4);

      // Scene 0 - Hook
      expect(scenes[0].sceneIndex).toBe(0);
      expect(scenes[0].shotPurpose).toBe('hook');
      expect(scenes[0].startSeconds).toBe(0);
      expect(scenes[0].endSeconds).toBe(3);
      expect(scenes[0].spokenTranscript).toBe('Stop losing hours to manual video editing.');
      expect(scenes[0].readingBurdenWpm).toBe(140); // 7 words in 3s = 140 WPM

      // Scene 1 - Problem Setup
      expect(scenes[1].sceneIndex).toBe(1);
      expect(scenes[1].shotPurpose).toBe('problem_setup');
      expect(scenes[1].startSeconds).toBe(3);
      expect(scenes[1].endSeconds).toBe(8);

      // Scene 2 - Demo
      expect(scenes[2].sceneIndex).toBe(2);
      expect(scenes[2].shotPurpose).toBe('product_demonstration');
      expect(scenes[2].startSeconds).toBe(8);
      expect(scenes[2].endSeconds).toBe(15);

      // Scene 3 - CTA
      expect(scenes[3].sceneIndex).toBe(3);
      expect(scenes[3].shotPurpose).toBe('cta');
      expect(scenes[3].startSeconds).toBe(15);
      expect(scenes[3].endSeconds).toBe(20);
    });

    it('handles blank-line paragraphs without timecodes and sets times to null', () => {
      const text = `First paragraph is the opening hook.

Second paragraph explains the core product benefits in detail.

Third paragraph is the final call to action.`;

      const scenes = parseScriptScenes(text);
      expect(scenes).toHaveLength(3);

      expect(scenes[0].startSeconds).toBeNull();
      expect(scenes[0].endSeconds).toBeNull();
      expect(scenes[0].readingBurdenWpm).toBeNull();
      expect(scenes[0].shotPurpose).toBe('hook'); // First block defaults to hook

      expect(scenes[1].startSeconds).toBeNull();
      expect(scenes[1].endSeconds).toBeNull();
      expect(scenes[1].readingBurdenWpm).toBeNull();
      expect(scenes[1].shotPurpose).toBe('other');
    });

    it('extracts user-supplied [Visual: ...] notes without hallucinating media details', () => {
      const text = `Scene 1: [0:00 - 0:04] [Visual: Founder speaking directly to camera with coffee in hand] Are you tired of low converting ads?
Scene 2: [0:04 - 0:09] [Text: 10x ROI Guaranteed] Check out our new platform.`;

      const scenes = parseScriptScenes(text);
      expect(scenes).toHaveLength(2);

      expect(scenes[0].providedVisualNotes).toBe('Founder speaking directly to camera with coffee in hand');
      expect(scenes[0].spokenTranscript).toBe('Are you tired of low converting ads?');
      expect(scenes[0].onScreenText).toBeNull();

      expect(scenes[1].onScreenText).toBe('10x ROI Guaranteed');
      expect(scenes[1].providedVisualNotes).toBeNull();
      expect(scenes[1].spokenTranscript).toBe('Check out our new platform.');
    });

    it('returns empty array for empty or whitespace-only scripts', () => {
      expect(parseScriptScenes('')).toEqual([]);
      expect(parseScriptScenes('   \n\n  \t ')).toEqual([]);
    });
  });

  describe('2. Reading Burden & WPM Calculation Invariants', () => {
    it('returns null WPM when timestamps are missing or invalid', () => {
      expect(calculateReadingBurden(20, null, 10)).toBeNull();
      expect(calculateReadingBurden(20, 0, null)).toBeNull();
      expect(calculateReadingBurden(20, 10, 10)).toBeNull(); // end === start
      expect(calculateReadingBurden(20, 15, 10)).toBeNull(); // end < start
      expect(calculateReadingBurden(20, -5, 10)).toBeNull(); // negative start
    });

    it('accurately computes WPM for valid spans', () => {
      // 15 words in 6 seconds = 15 / 0.1 min = 150 WPM
      expect(calculateReadingBurden(15, 0, 6)).toBe(150);
      // 30 words in 10 seconds = 30 / (1/6 min) = 180 WPM
      expect(calculateReadingBurden(30, 10, 20)).toBe(180);
    });

    it('categorizes reading burden density accurately without scoring judgment', () => {
      expect(categorizeWpmDensity(null).level).toBe('unknown');
      expect(categorizeWpmDensity(120).level).toBe('low');
      expect(categorizeWpmDensity(150).level).toBe('moderate');
      expect(categorizeWpmDensity(185).level).toBe('dense');
      expect(categorizeWpmDensity(220).level).toBe('overload');
    });
  });

  describe('3. Deterministic Claim Candidate Extraction & Offsets', () => {
    it('extracts numeric outcomes, comparative advantages, and promises with exact character offsets', () => {
      const text = 'Our tool is better than competitors and saves 40% time. We offer a 100% risk free trial.';
      const claims = extractDeterministicClaims(text, []);

      expect(claims.length).toBeGreaterThanOrEqual(2);

      // Comparative match
      const comp = claims.find((c) => c.claimClassification === 'comparative_advantage');
      expect(comp).toBeDefined();
      expect(comp?.sourceExcerpt).toContain('better than');
      expect(comp?.sourceCharOffsetStart).toBeGreaterThanOrEqual(0);

      // Numeric match
      const num = claims.find((c) => c.claimClassification === 'numeric_outcome');
      expect(num).toBeDefined();
      expect(num?.sourceExcerpt).toContain('40%');

      // Promise match
      const promise = claims.find((c) => c.claimClassification === 'explicit_brand_promise');
      expect(promise).toBeDefined();
      expect(promise?.sourceExcerpt).toContain('100% risk free');
    });

    it('matches exact Brand Codex claims and assigns exact_brand_claim_match', () => {
      const brandClaims: BrandClaimRow[] = [
        {
          id: 'bc-1',
          brand_id: 'brand-1',
          workspace_id: 'ws-1',
          claim_text: 'SOC-2 Type II Certified Security',
          claim_type: 'product_capability',
          review_status: 'approved',
          condition: null,
          rationale: 'Audited in 2025',
          source_reference: 'https://security.vanta.test',
          effective_date: null,
          expires_at: null,
          notes: null,
          created_by: null,
          created_at: '2026-08-22T00:00:00Z',
          updated_at: '2026-08-22T00:00:00Z',
        },
      ];

      const script = 'We protect your data with SOC-2 Type II Certified Security on all servers.';
      const claims = extractDeterministicClaims(script, brandClaims);

      const match = claims.find((c) => c.matchingBrandClaimId === 'bc-1');
      expect(match).toBeDefined();
      expect(match?.brandAlignmentStatus).toBe('exact_brand_claim_match');
      expect(match?.claimClassification).toBe('product_capability');
      expect(match?.proofReference).toBe('https://security.vanta.test');
      expect(match?.sourceCharOffsetStart).toBe(26);
    });

    it('identifies possible_term_overlap without prematurely declaring approved or prohibited', () => {
      const brandClaims: BrandClaimRow[] = [
        {
          id: 'bc-2',
          brand_id: 'brand-1',
          workspace_id: 'ws-1',
          claim_text: 'Automated creative compliance checking for enterprise teams',
          claim_type: 'product_capability',
          review_status: 'approved',
          condition: null,
          rationale: null,
          source_reference: null,
          effective_date: null,
          expires_at: null,
          notes: null,
          created_by: null,
          created_at: '2026-08-22T00:00:00Z',
          updated_at: '2026-08-22T00:00:00Z',
        },
      ];

      const script = 'We provide faster creative compliance checking for marketing agencies.';
      const claims = extractDeterministicClaims(script, brandClaims);

      const match = claims.find((c) => c.brandAlignmentStatus === 'possible_term_overlap');
      expect(match).toBeDefined();
      expect(match?.brandAlignmentStatus).toBe('possible_term_overlap');
      // Classification remains structural, not legal advice
      expect(match?.matchingBrandClaimId).toBe('bc-2');
    });

    it('returns empty array when input text is empty', () => {
      expect(extractDeterministicClaims('', [])).toEqual([]);
    });
  });

  describe('4. Failure, Immutability & Fallback Invariants', () => {
    it('does not fabricate visual notes or timestamps if absent from source text', () => {
      const text = 'Just a simple raw text sentence without formatting or annotations.';
      const scenes = parseScriptScenes(text);

      expect(scenes).toHaveLength(1);
      expect(scenes[0].providedVisualNotes).toBeNull();
      expect(scenes[0].onScreenText).toBeNull();
      expect(scenes[0].startSeconds).toBeNull();
      expect(scenes[0].endSeconds).toBeNull();
    });

    it('preserves known gaps and honest unknowns across parsing boundaries', () => {
      const script = 'Scene 1: Simple hook\nScene 2: Simple body';
      const scenes = parseScriptScenes(script);

      // Pacing is unknown without timestamps
      expect(scenes[0].readingBurdenWpm).toBeNull();
      expect(scenes[1].readingBurdenWpm).toBeNull();
      expect(categorizeWpmDensity(scenes[0].readingBurdenWpm).level).toBe('unknown');
    });
  });
});
