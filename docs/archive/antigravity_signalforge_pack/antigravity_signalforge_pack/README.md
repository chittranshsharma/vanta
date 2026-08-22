# SignalForge — Antigravity IDE Knowledge Pack

## Purpose

This pack converts the long-form SignalForge blueprint into a **durable implementation system** for Antigravity IDE. It is designed so work can continue safely when you switch between Claude Sonnet thinking, Gemini Flash High, Gemini Pro, or another capable coding model.

The files carry the project context. No model should need to remember the entire product from a single chat.

## Attach or add these files to the Antigravity workspace

1. `signalforge_final_blueprint.md` — the full canonical product specification.
2. This entire `antigravity_signalforge_pack/` directory.

The model should read `00_MASTER_INSTRUCTION.md` and `01_CONTEXT_PROTOCOL.md` first. It should then load only the file relevant to the current implementation ticket.

| File | Read when | What it provides |
|---|---|---|
| `00_MASTER_INSTRUCTION.md` | Every new model session | Mission, hard rules, first action, delivery format |
| `01_CONTEXT_PROTOCOL.md` | Every new model session | Context-saving discipline and durable project files |
| `02_PRODUCT_CONSTITUTION.md` | Product, AI, data, UX, source, or policy work | Non-negotiable behavior and anti-fabrication rules |
| `03_ARCHITECTURE_CONTRACT.md` | Scaffold, stack, database, API, storage, integrations, jobs | Recommended architecture and implementation boundaries |
| `04_DATA_AND_EVIDENCE_CONTRACT.md` | Schema, AI outputs, imports, scores, citations, analytics | Canonical entities, typed contracts, validation rules |
| `05_AGENT_ORCHESTRATION.md` | Agent, workflow, fallback, retry, approval work | Agent graph, run states, recovery protocol |
| `06_BUILD_TICKETS.md` | Planning or coding the next feature | Ordered implementation tickets and acceptance criteria |
| `07_QA_AND_RELEASE_GATES.md` | Before a feature is marked done or released | Unit, integration, visual, security, and evidence checks |
| `08_MODEL_HANDOFFS.md` | Changing models or resuming after a quota limit | Short prompts for Sonnet, Gemini Flash High, Gemini Pro, and any new model |

## The only rule that matters more than speed

> **Never replace missing evidence with plausible prose, placeholders that look live, invented metrics, or undocumented assumptions.**

If a model cannot verify something, it must create an honest blocked, disconnected, partial, or insufficient-evidence state and explain what is needed next.

## First command to send in Antigravity

Open `00_MASTER_INSTRUCTION.md` and execute only **Ticket 0.1** from `06_BUILD_TICKETS.md`.
