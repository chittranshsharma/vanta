# Context Protocol and Model-Switch Discipline

## Goal

Use files—not a model’s temporary chat memory—as the source of continuity. The project must survive context loss, quota exhaustion, IDE restarts, and handoff from Sonnet to Gemini or any other model.

## Bootstrap once

Read the canonical blueprint one time. Create `docs/blueprint-index.md` that maps major blueprint sections to implementation areas. After that, consult the index and read only relevant headings or supporting pack files for the current ticket.

Do not repeatedly paste the entire blueprint, repeat the whole architecture, or rewrite unchanged documentation. If an old decision is no longer correct, append an ADR; do not silently overwrite history.

## Working-memory budget

At every task start, load only:

1. `00_MASTER_INSTRUCTION.md`.
2. `docs/build-state.md`.
3. The exact ticket from `06_BUILD_TICKETS.md`.
4. One or two relevant contracts (architecture, data/evidence, agents, or QA).
5. Only repository files required for the change.

If additional context seems necessary, read the precise heading, not the entire blueprint. Prefer source links and file paths over repeated prose.

## Before editing any feature

Answer these questions in the ticket notes:

- What user decision does this feature support?
- What evidence/source/input is required?
- What is observed, sourced, inferred, simulated, or unknown?
- What happens if the input, source, provider, or agent fails?
- What is the user-visible empty/disconnected/insufficient-evidence state?
- What test can prove the feature is not fabricating a result?

## Model-switch protocol

Before switching models, update `docs/build-state.md` using this exact compact template:

```md
## Current handoff
- Ticket: <ID and name>
- Status: not started | in progress | blocked | verified
- Changed files: <paths>
- Last verified: <commands and pass/fail>
- Data/schema state: <migration or none>
- Evidence policy impact: <what is enforced>
- Known limitation: <one sentence>
- Next atomic action: <one sentence>
```

Then start the new model with the relevant prompt from `08_MODEL_HANDOFFS.md`. The new model must inspect `docs/build-state.md`, current ticket, and changed files before modifying anything.

## Context-protection rules

- One ticket per work cycle.
- One architectural decision per ADR.
- Never generate giant code dumps in chat; write files and report paths.
- Never regenerate a component already in the repository before reading it.
- Never refactor unrelated areas while a ticket is in progress.
- Avoid broad “make it better” passes. Turn feedback into a named ticket with acceptance criteria.
- Keep prompts request-specific; tell the model what files and contracts to read.
- If output becomes uncertain, pause, state the gap, and ask the user or create an explicit blocked task.
