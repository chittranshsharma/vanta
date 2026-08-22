# QA and Release Gates

## Rule

A feature is not complete because it renders. It is complete only when the expected user journey, error journey, evidence behavior, access boundary, and visual behavior have been checked.

## Required checks by feature type

| Feature type | Minimum required verification |
|---|---|
| Database/schema | Migration reviewed, tenant ownership tested, rollback or safe migration plan documented |
| API/procedure | Valid input, invalid input, unauthorized workspace, source-policy violation, provider failure, and idempotency behavior tested |
| AI/agent | Schema validation, missing citation block, conflict state, stale source downgrade, fallback behavior, model/provider metadata, human escalation tested |
| Numeric/analytics | Canonical definition, unit, time range, source mapping, null/missing fields, incomplete export, and no-fabrication tests |
| Import/integration | Malformed file, denied permission, disconnected source, expired credential, rate limit, partial coverage, duplicate import tested |
| UI | Loading, empty, disconnected, partial, stale, conflict, blocked, error, and verified states reviewed |
| Visual | Desktop and mobile screenshots reviewed; no overflow, contrast issue, clipped content, inaccessible hover-only control, or unnecessary animation |
| External action | Human approval, reversible preview, audit record, and cancellation state tested |

## Evidence gate test cases

1. An AI response with a factual statement but no evidence ID must be blocked.
2. A numeric claim without definition, source, unit, and time window must not render as a number.
3. A stale source must lower confidence and show the last verified timestamp.
4. Conflicting sources must remain visible; the UI must not silently pick one.
5. A simulation must never use “real users said” or equivalent wording.
6. A disconnected source must not show populated live-looking charts.
7. A platform timing recommendation without account-specific evidence must be labeled as a public prior or insufficient evidence.

## Agent recovery test cases

1. Provider timeout triggers one bounded retry, then alternate provider or blocked state.
2. Invalid JSON triggers schema rejection and constrained repair only.
3. Missing citation triggers retrieval-only fallback, then insufficient evidence if unavailable.
4. Agent disagreement creates a disagreement card and proposed discriminating experiment.
5. An agent may not trigger publishing, source connection, delete, spend, or send without explicit approval.
6. The Agent Health Console records provider, model, fallback path, validation verdict, and time.

## Visual quality gate

- The public site is cinematic and bespoke, not template-like.
- The workspace has clear hierarchy, generous depth, and focused motion.
- Every effect respects `prefers-reduced-motion`.
- Interactive controls support keyboard access and visible focus.
- Text contrast remains sufficient on all glass, gradient, and image-backed surfaces.
- Evidence is more prominent than decoration in data-heavy screens.
- Example data is never mistaken for actual customer data.

## Release statement standard

Release notes must say what is implemented, what data sources are actually connected, what is simulated, what is imported manually, and what requires future credentials or approval. Never market an upcoming integration or placeholder UI as a functioning live capability.
