# Master Instruction for Antigravity IDE

You are implementing **SignalForge**, a web-first Creative Intelligence and Experimentation OS. The canonical specification is `signalforge_final_blueprint.md`. The supporting implementation knowledge is in `antigravity_signalforge_pack/`.

## Execution order

1. Read this file and `01_CONTEXT_PROTOCOL.md`.
2. Read `02_PRODUCT_CONSTITUTION.md`.
3. Read only the current ticket in `06_BUILD_TICKETS.md` and the technical reference files relevant to that ticket.
4. Inspect the existing repository before selecting libraries, editing data structures, or replacing scaffold code.
5. Implement one ticket at a time: **data contract → server/API → UI → tests → visual verification → durable state update**.
6. Mark the ticket complete only when its acceptance criteria and relevant gates in `07_QA_AND_RELEASE_GATES.md` pass.

## Mission

Build a cinematic, premium public marketing site and an authenticated product workspace that help creators, brands, teams, and agencies turn brand context, creative analysis, approved trend evidence, audience simulations, publishing experiments, and measured outcomes into trustworthy creative decisions.

The product is not a generic chatbot, a fake focus group, a virality calculator, or a promise to reproduce any platform’s private algorithm. Its essential loop is:

> **Ingest → ground → understand → simulate → diagnose → mutate → compare → approve → publish → measure → calibrate.**

## Hard rules — never violate

1. **Do not fabricate.** Never make up metrics, citations, audience activity, social posts, trend volume, account connections, campaign results, user reviews, testimonials, or live data.
2. **Fail closed.** If a source, extract, agent, model output, calculation, or integration is missing, stale, contradictory, malformed, or low confidence, show a truthful partial, blocked, disconnected, or insufficient-evidence state.
3. **No private-algorithm claim.** Do not claim exact reach, literal scroll time, guaranteed virality, or private access to Instagram, TikTok, YouTube, Reddit, X, or other ranking systems.
4. **Compliant sources only.** Do not bypass logins, paywalls, robots restrictions, rate limits, private accounts, or platform access rules. Use official APIs, authorized connections, RSS, permitted public data, or manual user imports.
5. **Evidence precedes prose.** A factual or numeric statement must map to a source/evidence record. Simulations and model inferences must show assumptions, confidence, disagreement, and unknowns.
6. **No automatic external actions.** Account connection, publication, message sending, spending, deletion, or sensitive-data retention requires explicit human approval and a reversible preview.
7. **Use the existing scaffold.** Preserve its conventions and integrations unless a documented Architecture Decision Record justifies change.
8. **Keep tenant data isolated.** Enforce authorization at the database and API boundary; never trust user-provided workspace IDs alone.
9. **Do not leak secrets.** Shared keys and provider credentials belong server-side in environment variables. Never place them in browser code, logs, fixtures, or committed files.
10. **Respect the visual bar.** The product must be elegant, cinematic, and deeply polished, but citations, confidence, task state, and user controls must always remain readable.

## Required durable project files

Create and maintain these inside the repository root before substantial implementation:

- `docs/blueprint-index.md` — index of canonical blueprint headings and the implementation concern they govern.
- `docs/product-constitution.md` — copy the actionable rules from the constitution in compact form.
- `docs/architecture.md` — actual selected stack, app boundaries, data flow, and environment assumptions.
- `docs/decisions.md` — append-only Architecture Decision Records.
- `docs/build-state.md` — current phase, recently completed ticket, tests run, active risk, and next ticket; keep under 100 lines.
- `todo.md` — flat, testable checklist of tickets and sub-tasks.

## Exact first action

Complete **Ticket 0.1: establish durable project memory and repository audit**. Do not build a large feature, fake a live dashboard, or add unapproved external integrations before Ticket 0.1 is complete.

## Required end-of-ticket report

At the end of every ticket, report only these five items:

1. **Completed** — the verified outcome and changed files.
2. **Evidence and safety** — provenance, approval, fallback, or source-policy behavior confirmed.
3. **Verification** — commands/tests/visual checks actually run and their result.
4. **Known limitations** — credentials, source approvals, missing real data, or deliberate deferrals.
5. **Next ticket** — one concise sentence.
