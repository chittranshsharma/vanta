# Blueprint Index

Maps `signalforge_final_blueprint.md` headings to implementation concerns. Read this instead of the full blueprint for a specific concern.

| Blueprint section | Implementation concern | Primary contract file |
|---|---|---|
| §1 Cinematic public site and workspace | Public marketing site, workspace shell, design system, ReactBits zones | `docs/architecture.md` |
| §2 Brand Brain and Brand Codex | Brand rules, claim policy, tone, versioned codex, approval state | `04_DATA_AND_EVIDENCE_CONTRACT.md` |
| §3 Creative ingestion and Creative Twin | Asset intake, extraction jobs, structured twin, confidence, provenance | `04_DATA_AND_EVIDENCE_CONTRACT.md` |
| §4 Audience Journey Simulator | Persona panels, sequential simulation, disagreement, uncertainty | `05_AGENT_ORCHESTRATION.md` |
| §5 Creative Decision Matrix and Timeline Doctor | Variant comparison, multi-dimension scores, failure moments, edit brief | `04_DATA_AND_EVIDENCE_CONTRACT.md` |
| §6 Counterfactual Lab and Mutation Engine | Controlled variable changes, change log, same-audience retests | `05_AGENT_ORCHESTRATION.md` |
| §7 Trend Intelligence | Approved sources, citations, freshness, coverage, stale-data states | `04_DATA_AND_EVIDENCE_CONTRACT.md` |
| §8 Social and campaign integrations | Source registry, connection status, manual import fallback, scopes | `03_ARCHITECTURE_CONTRACT.md` |
| §9 Evidence Layer / anti-hallucination | Evidence classes, numeric claim gates, Evidence Arbiter veto | `02_PRODUCT_CONSTITUTION.md` |
| §10 Experiments, approvals, calibration | Hypotheses, approvals, outcomes, prediction-vs-actual accuracy | `04_DATA_AND_EVIDENCE_CONTRACT.md` |
| §11 Scheduled evidence refresh | Durable jobs, idempotency, staleness, rate limits, source health | `03_ARCHITECTURE_CONTRACT.md` |
| §12 Notifications | Threshold alerts, deduplication, evidence links, user preferences | `04_DATA_AND_EVIDENCE_CONTRACT.md` |
| §13 Publishing Intelligence / Algorithm Engineer | Distribution readiness, upload-window experiments, timing evidence hierarchy | `05_AGENT_ORCHESTRATION.md` |
| §14 Quality bar | Visual, accessibility, motion, evidence-first, no fake data | `07_QA_AND_RELEASE_GATES.md` |
| Multi-agent orchestration | Creative Council, task graph, Evidence Arbiter, fallback matrix | `05_AGENT_ORCHESTRATION.md` |
| Technology stack | Free-first stack, layer boundaries, security, observability | `docs/architecture.md` |
| Build order / tickets | Ordered implementation phases and acceptance criteria | `06_BUILD_TICKETS.md` |
| Security and trust | RLS, secret safety, signed URLs, consent, audit events | `docs/architecture.md` |
| Model routing and handoffs | Model roles, context discipline, continuation prompts | `08_MODEL_HANDOFFS.md` |
