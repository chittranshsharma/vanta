# Model Handoffs and Continuation Prompts

## Model-independent principle

The files in this pack and the repository’s durable docs carry the project knowledge. A model is a temporary executor. Do not assume any provider knows the product, remembers previous work, or has access to private platform data.

## Before switching models

1. Finish or safely pause the current atomic task.
2. Update `docs/build-state.md` using the template in `01_CONTEXT_PROTOCOL.md`.
3. Update `todo.md` accurately.
4. Record any changed architecture in `docs/decisions.md`.
5. Commit or otherwise persist the current working tree according to repository policy.

## Universal resume prompt

```text
You are resuming implementation of SignalForge in Antigravity IDE.

Read only:
1) antigravity_signalforge_pack/00_MASTER_INSTRUCTION.md
2) antigravity_signalforge_pack/01_CONTEXT_PROTOCOL.md
3) docs/build-state.md
4) the current ticket in antigravity_signalforge_pack/06_BUILD_TICKETS.md
5) only the one or two relevant contract files and changed source files.

Do not reread or restate the entire blueprint. Inspect the actual repository before editing. Continue the exact next atomic action in docs/build-state.md. Preserve all evidence, source-policy, no-fabrication, fallback, approval, tenant-isolation, and visual-quality rules. Update docs/build-state.md, todo.md, and docs/decisions.md when appropriate. Run the relevant tests before declaring progress.
```

## Claude Sonnet thinking prompt

Use Sonnet thinking for architectural decisions, difficult state transitions, authorization/RLS, agent orchestration, source-policy reasoning, evidence validation, migration design, debugging, and final reviews.

```text
Act as the senior reasoning and review pass for the current SignalForge ticket. Use the Universal Resume Prompt discipline. Before coding, identify invariants, failure modes, authorization risks, evidence-provenance requirements, and acceptance tests. Make the smallest robust change. Do not use reasoning to invent unavailable facts or data. Verify the implementation and leave a compact handoff for the next model.
```

## Gemini Flash High prompt

Use Gemini Flash High for narrowly scoped, well-specified implementation tasks: UI components, styling, typed forms, small server procedures, unit tests, documentation updates, and mechanical refactors. Do not give it open-ended architecture work without the relevant contract loaded.

```text
Implement only the current atomic SignalForge task. Read the Universal Resume Prompt files plus the current ticket and relevant contract. Do not redesign architecture, add unrelated packages, make broad refactors, or assume live data. Follow existing patterns. If requirements are ambiguous or evidence rules are not clear, stop and write a blocked note in docs/build-state.md rather than guessing. Run the listed tests and report the five-item phase summary.
```

## Gemini Pro prompt

Use Gemini Pro for broad but bounded tasks requiring stronger cross-file synthesis: a complete vertical slice, design-system implementation, complex debugging, UI review, import pipeline, or source/evidence workflow. Keep the current ticket scope explicit.

```text
Implement the current SignalForge ticket as a bounded vertical slice. Read the Universal Resume Prompt files, current ticket, and only relevant contracts. First summarize the ticket’s data flow and failure states in five bullets or fewer. Then implement schema/API/UI/tests in the repository’s existing conventions. Enforce evidence gating and fail-closed behavior. Do not claim or simulate unimplemented integrations. Finish with the required five-item report and a durable state update.
```

## If a model becomes confused or starts hallucinating

Send this immediately:

```text
Stop the current implementation. Do not add more features. Re-read only docs/product-constitution.md, docs/build-state.md, and the current ticket. Identify any unsupported data, fake live state, incorrect assumption, or scope drift introduced in the current work. Remove or downgrade it to an honest empty/partial/insufficient-evidence state. Make the smallest corrective change, run tests, update durable state, and continue only when the ticket’s acceptance criteria are again satisfied.
```

## If context is nearly full

Do not ask the model to summarize the full project. Ask it to:

1. Update `docs/build-state.md`.
2. Update `todo.md`.
3. Write any ADR needed.
4. List changed files and exact tests.
5. Stop.

Then start a new model with the Universal Resume Prompt.

