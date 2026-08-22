# SignalForge Product Constitution

## Product promise

SignalForge helps teams and creators make better creative and publishing decisions with transparent evidence. It identifies what is known, what is inferred, what is simulated, what is uncertain, and what to test next.

## Product non-promises

SignalForge must never promise exact social reach, guaranteed virality, exact revenue, perfect reproduction of a platform algorithm, literal audience scroll time without a defined source, human equivalence from simulations, or certainty when evidence is incomplete.

## Evidence classes

| Class | Definition | Display rules |
|---|---|---|
| **Observed fact** | Directly present in a user import, approved integration, or permitted source | Show source, field/value, timestamp, coverage, and import/connection status |
| **Sourced claim** | Statement by a cited third party | Show attribution, citation, source date, and quote/context link |
| **Model inference** | Reasoned synthesis from bounded evidence | Show assumptions, source set, confidence, disagreement, model/prompt version, and limitations |
| **Simulation** | Structured directional response from configured AI personas | Label as simulation; show audience assumptions and uncertainty; never call it observed human feedback |
| **Unknown** | Information that is absent, stale, contradictory, out of scope, or unverified | Stop the claim; show an insufficient-evidence state and request the smallest useful next input |

## Evidence presentation standard

Every research, trend, publishing, creative, and outcome card must surface:

- Source set and citations.
- Freshness/last-verified timestamp and covered time window.
- Coverage limits and missing data.
- Evidence class.
- Confidence and disagreement when inference or simulation is involved.
- Model/prompt version behind generated analysis.
- Explicit human-validation requirement when applicable.

## Agent behavior

Agents have specialized roles, typed inputs, typed outputs, durable run records, bounded retries, independent verification, and safe fallbacks. A fallback must be an alternate method—not an unbounded retry that repeats unsupported claims.

The Evidence Arbiter has veto power over unsupported facts, metrics, citations, stale sources, conflicts, unsafe claims, and unapproved external actions.

## User control

Users control data connection, source permissions, retention, approvals, external actions, use of customer content, and whether to accept an AI recommendation. The system may ask only questions that materially improve a decision and must explain why it is asking.

## Design constitution

The product should feel like a cinematic creative command center: rich dark surfaces, sculpted depth, restrained light, high-quality type, precise motion, and generous whitespace. It must still meet accessibility, keyboard, contrast, responsive, and reduced-motion requirements.

ReactBits-style effects are welcome only behind local wrappers that preserve design tokens, accessibility, motion preferences, and runtime performance. Visual complexity may never hide evidence, citations, state, or decisions.
