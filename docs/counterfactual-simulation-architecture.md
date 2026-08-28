# Vanta — Counterfactual Simulation Lab Architecture & Contracts

**Status:** Authoritative Design Specification (Ticket 6.1)  
**Scope:** Controlled Creative Variable Mutations, Counterfactual Hypothesis Modeling, Council-Governed Simulation Engine, Epistemic Safety Invariants, and Post-Hoc Traceability Linkages.

---

## 1. Executive Summary

The **Counterfactual Simulation Lab** allows creative and growth teams to explore hypothetical variations of Creative Twins (such as altering the hook, shortening scene pacing, substituting an approved Brand Codex claim, or adapting copy for tone guidelines) and model their structural implications *before* spending production or advertising budgets.

### Core Invariants:
1. **Never Contaminate Empirical Data:** A simulation result is strictly typed with `evidence_class = 'simulation'`. It is NEVER stored in `experiment_outcomes` or `post_observations` as an actual occurrence, nor can it serve as a historical baseline.
2. **Never Mutate Source Truth:** Simulations operate on immutable Creative Twin versions (`creative_twin_versions`) and produce isolated `SimulatedVariant` models in memory or dedicated simulation records. They never modify underlying twins, scenes, claims, or Brand Codex records.
3. **No Algorithmic Hallucination or Performance Forecasting (v1 Rule):** Simulations in v1 produce **deterministic structural deltas only** (duration delta, WPM delta, scene count delta, claim count delta, claim coverage delta). They NEVER output fabricated "virality scores," "conversion probabilities," "ROI forecasts," "variance vs observed," or "prediction accuracy/lift scores."
4. **Deterministic First:** Structural pacing, reading burden (WPM), scene ordering, and claim substitution eligibility are computed deterministically in pure TypeScript.
5. **Approved Claims Only:** Any claim substitution mutation must reference an existing `approved` Brand Codex claim and proof point within the same workspace. Prohibited, unreviewed, or expired claims are rejected immediately.
6. **Governance Checkpoints:** Human approval of a simulation records `review_decision = 'accepted'` for planning purposes, but the proposition remains `evidence_class = 'simulation'`.

---

## 2. Epistemic Separation & Data Taxonomy

Vanta maintains an exact five-class canonical evidence taxonomy:
- `observed`: Directly recorded from empirical execution or platform measurement (e.g., recorded timestamp, exact post metrics, video pixel dimensions).
- `sourced`: Extracted verbatim from a registered, provenanced document (e.g., Brand Codex claim text, registered source excerpt).
- `inference`: Derived by statistical models, heuristic approximations, or LLM synthesis.
- `simulation`: Formulated through hypothetical scenario modeling, counterfactual variable mutation, or synthetic projection.
- `unknown`: Baseline or empirical measurement is unknown / missing.

*(Note: `blocked`, `needs_human`, `insufficient_evidence`, `interpretation_unavailable`, `failed`, `cancelled`, and `deterministic_fallback` are operational/safety status states, NOT evidence classes).*

| Category | Definition | Example in Simulation Lab |
|---|---|---|
| `hypothesis` | The explicit question being tested | *"If Scene 1 hook is condensed from 18 to 8 words, does WPM drop below 160?"* |
| `simulation` | The model/rule-derived hypothetical result | `SimulatedVariant` with calculated 145 WPM and unchanged downstream scenes |
| `observed` | Empirical platform measurement | Real post retention or CTR recorded in `experiment_outcomes` after a live test |
| `inference` | Statistical or heuristic interpretation | Qualitative interpretation of message clarity |
| `decision` | Human administrative governance | Reviewer accepting the simulation to draft a physical A/B experiment |

> **Traceability Invariant:** When a real physical experiment is run later, the real observation is linked via `SimulationObservedTrace` strictly for traceability. v1 does **not** compute accuracy, variance, lift, or prediction error scores. The simulation record remains immutable with `evidence_class = 'simulation'`.

---

## 3. Bounded Mutation Operations

Every counterfactual run declares one or more explicit, bounded mutations (max 5 per run):

1. `hook_replacement`:
   - Target: First scene (`scene_index = 0` or designated hook).
   - Validation: New text length $\le 300$ characters.
2. `cta_replacement`:
   - Target: Final scene or designated call-to-action.
   - Validation: New text length $\le 200$ characters.
3. `scene_reorder`:
   - Target: Permutation of existing scene indices.
   - Validation: All scene indices must be present; total duration remains conserved.
4. `scene_duration_adjust`:
   - Target: Duration of specific scenes.
   - Validation: Scene duration $\ge 1.0\text{s}$, total duration within $[10\text{s}, 300\text{s}]$.
5. `on_screen_text_change`:
   - Target: Visual text overlay on specified scenes.
   - Validation: Text length $\le 150$ characters per scene.
6. `claim_substitution`:
   - Target: Replace an extracted creative claim with a Brand Codex claim.
   - Validation: Target claim must be `approved` in `brand_claims` with active proof point in the same workspace.
7. `tone_guideline_adaptation`:
   - Target: Adjust dialogue or copy against approved `brand_tone_guidelines`.
   - Validation: Tone dimension must exist in the caller workspace.

---

## 4. Council Six-Role Analysis Subgraph & Human Reviewer Gate

A simulation run invokes the minimal 6-role Specialist Council analysis subgraph, followed by a mandatory human governance gate:

```
discovery (validates baseline, controls, and missing inputs)
   │
   ├── creative_analyst (calculates WPM, scene duration, and pacing deltas)
   └── claim_auditor (verifies claim substitution eligibility and proof citations)
          │
          ▼
   experiment_designer (formalizes hypothesis, controls, and success criteria)
          │
          ▼
   evidence_arbiter (validates all cited entity UUIDs strictly belong to workspace)
          │
          ▼
       evaluator (evaluates against declared structural rubric, not fake virality)
          │
          ▼ [Mandatory Governance Gate]
   human_reviewer (records explicit review event; preserves evidence_class = 'simulation')
```

---

## 5. Post-Hoc Observed Traceability Contract

When an operator decides to promote an accepted simulation into a real experiment:
1. An experiment is created in `experiments` and scheduled.
2. When physical outcomes arrive in `experiment_outcomes` (`evidence_class = 'observed'`), an explicit `SimulationObservedTrace` record is created for provenance:
   - `trace_id`: UUID
   - `simulation_run_id`: UUID (points to original simulation)
   - `experiment_outcome_id`: UUID (points to empirical outcome)
   - `linked_at`: Timestamp
   - `linked_by`: Actor user UUID
3. **No Variance Calculation in v1:** The link connects the records without computing variance, lift, or calibration.
4. **Immutability:** The simulation run is never overwritten, and its `evidence_class` remains `simulation`.
