# Vanta — Product Constitution

Compact, actionable rules derived from `signalforge_final_blueprint.md §9` and `02_PRODUCT_CONSTITUTION.md`. Append with an ADR if any rule must be relaxed.

## Product promise

Vanta helps teams make better creative and publishing decisions through transparent evidence. It makes clear what is known, inferred, simulated, and unknown.

## Product non-promises (never claim)

- Exact social reach, guaranteed virality, or exact revenue.
- Literal platform "scroll time" without a defined first-party source.
- Reproduction of Instagram, TikTok, YouTube, Reddit, or X ranking algorithms.
- Human equivalence from simulations.
- Certainty when evidence is incomplete.

## Evidence classes — must be visible in the UI

| Class | Definition | Display rule |
|---|---|---|
| **Observed fact** | Directly present in a user import, authorized integration, or measured outcome | Show source, field/value, timestamp, coverage, and import status |
| **Sourced claim** | Statement by a cited third party | Show attribution, citation URL, and source date |
| **Model inference** | Reasoned synthesis from bounded evidence | Show assumptions, source set, confidence, disagreement, model/prompt version |
| **Simulation** | Structured directional response from AI persona panels | Label as simulation; show audience assumptions and uncertainty; never call it observed human feedback |
| **Unknown** | Absent, stale, conflicting, out-of-scope, or unverified | Stop the claim; show an insufficient-evidence state; request the smallest useful next input |

## Numeric claim gate

A number must NOT render unless all of these are present: `metricKey`, `value`, `unit`, `definition`, `sourceEvidenceId`, `timeWindow`, `completeness === "complete"`. If any field is absent, show `not available` or `insufficient evidence`.

## Anti-fabrication rules

- Never invent metrics, trend volumes, audience activity, social posts, campaign results, or testimonials.
- Demo or illustrative data must be labeled **"Illustrative only — not live data"** and must not look like a customer result.
- A chart, score, or timing suggestion with no real source must show an empty/disconnected/insufficient-evidence state, not a realistic-looking placeholder.

## Agent behavior rules

- Agents have specialized roles, typed inputs/outputs, bounded retries, and independent verification.
- Evidence Arbiter holds veto power over unsupported facts, metrics, stale sources, conflicts, and unsafe claims.
- Fallback = alternate method, not repeated retry of the same failed call.
- Max: 1 transient retry, 1 schema repair, 1 alternate-provider attempt. Then degrade safely.

## User control rules

- Users control data connection, source permissions, retention, approvals, and external actions.
- No external side effect (publishing, connecting, spending, sending, deleting, retaining sensitive content) without explicit user approval and reversible preview.

## Source policy rules

- Only official APIs, user-authorized OAuth, RSS, permitted public sources, and manual user imports.
- Never bypass login walls, paywalls, robots restrictions, rate limits, or private account access.
- A disconnected source shows a disconnected state, not a mock live feed.

## Design rules

- Cinematic dark surfaces, sculpted depth, restrained gradients, high-contrast typography, purposeful motion.
- Every effect respects `prefers-reduced-motion`.
- Keyboard accessibility and sufficient contrast on all surfaces.
- Evidence, citations, state, and user controls must always remain readable regardless of visual complexity.
