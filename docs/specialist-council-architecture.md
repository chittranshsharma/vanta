# Vanta — Specialist Council Architecture & Role Contract Specification

**Status:** Authoritative Design Specification (Ticket 5.2)  
**Scope:** Domain Contracts, Deterministic DAG Orchestration, Capability Model, Evidence & Review Governance, and Pre-Call Budget Enforcement.  
**Audience:** Backend, Job Worker, Model Gateway, and Quality Assurance.

---

## 1. Executive Overview

The **Specialist Council** is Vanta's multi-specialist analysis engine. Unlike unconstrained agent architectures where arbitrary autonomous models chat or mutate state, Vanta's Council is a strictly governed, typed directed acyclic graph (DAG) of specialized roles operating under:
1. **Least-Privilege Capability Gates:** Roles only access explicitly declared read and tool capabilities.
2. **Evidence vs. Governance Separation:** AI-derived findings remain `evidence_class = 'inference'`. Human review is a separate governance state (`review_decision`), not a mechanism to convert inference into empirical fact.
3. **Deterministic First:** Where deterministic analysis is possible (e.g. WPM timing, regex claim extraction, compliance rule matching, exact aggregate counts, null hypothesis formatting), pure TypeScript algorithms run without invoking LLMs.
4. **Mandatory Evidence Arbitration:** No decision-sensitive or user-facing output may bypass the `evidence_arbiter`.
5. **Mandatory Human Review Checkpoint:** No proposal can be applied to stored truth without an explicit `human_reviewer` event.
6. **Pre-Call Budget & Quota Validation:** Token, call count, and workspace quota checks happen *before* invoking external model gateways. Quota exhaustion fails closed immediately.
7. **Zero Autonomous Side Effects:** No role may directly mutate databases, send messages, publish content, scrape platforms, or spawn arbitrary sub-agents.

---

## 2. Evidence Classification vs. Human Review Governance

Vanta maintains a strict distinction between the **epistemic nature of data** (`evidence_class`) and the **human administrative status** (`review_decision`):

### 2.1 Evidence Class (`evidence_class`)
Describes how the data came into existence:
- `observed`: Directly recorded from empirical execution or platform measurement (e.g., recorded timestamp, exact post metrics, video pixel dimensions).
- `sourced`: Extracted verbatim from a registered, provenanced document (e.g., Brand Codex claim text, registered source excerpt).
- `inference`: Derived by statistical models, heuristic approximations, or LLM synthesis.
- `unknown`: Baseline or state is unknown / missing.
- `blocked`: Determination could not be made due to missing prerequisite permissions or policies.

> **Invariant:** A human approving an `inference` proposal records a `review_decision = 'accepted'`, but the proposition's `evidence_class` remains `inference`. Human approval is governance, not empirical proof.

### 2.2 Review Decision (`review_decision`)
Describes the administrative governance state:
- `unreviewed`: Default state of all newly generated proposals.
- `accepted`: Approved by an authorized human operator.
- `rejected`: Rejected by a human operator.
- `corrected`: Modified by a human operator with specific corrections.
- `needs_human`: Flagged by an automated gate or arbiter as requiring mandatory human intervention.

---

## 3. The 11 Specialist Roles

### 1. `discovery`
- **Purpose:** Identify the requested decision, assemble the context brief, and detect missing inputs.
- **Allowed Inputs:** `cap:read_brand_codex`, `cap:read_source_registry`, `cap:read_evidence_items`
- **Allowed Tools:** `tool:decision_input_validator`
- **Output Schema:** `decision_brief.v1`
- **Evidence Class:** `inference`
- **Fallback:** Return explicit list of missing inputs with status `insufficient_evidence`.

### 2. `creative_analyst`
- **Purpose:** Inspect Creative Twin structure, calculate scene reading burden (WPM), and identify structural pacing patterns.
- **Allowed Inputs:** `cap:read_creative_twin`, `cap:read_creative_scenes`, `cap:read_creative_claims`
- **Allowed Tools:** `tool:wpm_calculator`, `tool:scene_pacing_analyzer`
- **Output Schema:** `creative_findings.v1`
- **Evidence Class:** `inference`
- **Fallback:** Pure deterministic scene timing and WPM calculation; flag qualitative analysis as `interpretation_unavailable`.

### 3. `evidence_arbiter`
- **Purpose:** Verify every cited ID exists in the caller's workspace, verify source freshness, check evidence class consistency, and fail closed if ungrounded claims are detected.
- **Allowed Inputs:** `cap:read_candidate_output`, `cap:read_workspace_ids`, `cap:read_source_provenance`
- **Allowed Tools:** `tool:citation_verifier`, `tool:evidence_gate`
- **Output Schema:** `arbiter_verdict.v1`
- **Evidence Class:** `inference`
- **Fallback:** Fail closed (`verdict = 'rejected'`, `reasons = ['evidence_arbiter_unavailable']`).

### 4. `evaluator`
- **Purpose:** Score candidate outputs against task rubrics or observed outcome metrics. Never against fabricated audience reactions.
- **Allowed Inputs:** `cap:read_arbiter_output`, `cap:read_task_rubric`, `cap:read_observed_metrics`
- **Allowed Tools:** `tool:deterministic_rubric_evaluator`
- **Output Schema:** `evaluation.v1`
- **Evidence Class:** `inference`
- **Fallback:** Score static rules only; emit `unknown` for any data-dependent dimension.

### 5. `human_reviewer`
- **Purpose:** Represent the mandatory human checkpoint for reviewing, accepting, rejecting, or correcting proposals.
- **Allowed Inputs:** `cap:read_evaluated_output`
- **Allowed Tools:** `tool:human_review_ledger`
- **Output Schema:** `review_event.v1`
- **Evidence Class:** `observed` (for the action of reviewing only)
- **Fallback:** Halt execution in state `awaiting_review` (`needs_human`).

### 6. `audience_researcher`
- **Purpose:** Summarize imported audience signals and conversation observations. Interpretations remain strictly inference and unreviewed.
- **Allowed Inputs:** `cap:read_conversation_observations`, `cap:read_import_batches`
- **Allowed Tools:** `tool:observation_aggregator`
- **Output Schema:** `audience_summary.v1`
- **Evidence Class:** `inference`
- **Fallback:** Return exact counts of imported rows and flag interpretations as `interpretation_unavailable`.

### 7. `claim_auditor`
- **Purpose:** Audit creative claims against approved Brand Codex claims and proof points.
- **Allowed Inputs:** `cap:read_creative_claims`, `cap:read_brand_claims`, `cap:read_brand_proofs`
- **Allowed Tools:** `tool:claim_grounding_matcher`
- **Output Schema:** `claim_audit.v1`
- **Evidence Class:** `inference`
- **Fallback:** Return `unsupported` / `unknown`. Never mark unverified claims as approved.

### 8. `compliance_reviewer`
- **Purpose:** Check candidate copy against explicit regulatory, platform, and brand compliance boundaries.
- **Allowed Inputs:** `cap:read_compliance_boundaries`, `cap:read_candidate_copy`
- **Allowed Tools:** `tool:compliance_rule_checker`
- **Output Schema:** `compliance_verdict.v1`
- **Evidence Class:** `inference`
- **Fallback:** Return `blocked` (prohibit release). Never certify compliance on fallback.

### 9. `experiment_designer`
- **Purpose:** Formulate testable null hypotheses, identify required metrics, and structure variant comparison designs without predicting performance.
- **Allowed Inputs:** `cap:read_metric_definitions`, `cap:read_brand_claims`, `cap:read_experiments`
- **Allowed Tools:** `tool:null_hypothesis_formatter`
- **Output Schema:** `experiment_design.v1`
- **Evidence Class:** `inference`
- **Fallback:** Output standard null hypothesis template requiring human parameterization.

### 10. `localization_reviewer`
- **Purpose:** Audit translated or localized copy against source meaning and brand tone guidelines.
- **Allowed Inputs:** `cap:read_creative_scenes`, `cap:read_tone_guidelines`, `cap:read_locales`
- **Allowed Tools:** `tool:tone_drift_detector`
- **Output Schema:** `localization_audit.v1`
- **Evidence Class:** `inference`
- **Fallback:** Return `blocked` with uncertainty notice. Never guess or rubber-stamp translations.

### 11. `performance_analyst`
- **Purpose:** Analyze stored post observations and experiment outcomes. Never fabricates virality, engagement forecasts, or baselines.
- **Allowed Inputs:** `cap:read_post_observations`, `cap:read_experiment_outcomes`, `cap:read_metric_definitions`
- **Allowed Tools:** `tool:exact_metric_aggregator`
- **Output Schema:** `performance_summary.v1`
- **Evidence Class:** `inference`
- **Fallback:** Return `unknown` baseline and observed metric counts only.

---

## 4. Directed Acyclic Graph (DAG) & Minimal Subgraph Planning

### 4.1 Master Council Topology
```
discovery
   │
   ├── creative_analyst
   ├── audience_researcher
   └── claim_auditor
          │
          ├── compliance_reviewer
          ├── localization_reviewer
          ├── experiment_designer
          └── performance_analyst
                 │
                 ▼
          evidence_arbiter
                 │
                 ▼
             evaluator
                 │
                 ▼
          human_reviewer (Governance Checkpoint)
```

### 4.2 Minimal Subgraph Selection
Tasks specify their target analysis type (e.g., `creative_audit`, `compliance_check`, `performance_review`). The planner calculates the minimal ancestor graph containing only the required roles, plus mandatory downstream `evidence_arbiter`, `evaluator`, and `human_reviewer` nodes. Unneeded roles are explicitly recorded as `skipped`.

---

## 5. Budget, Timeout, and Quota Gating

Before any role node executes, the runtime verifies:
1. **Node Count Ceiling:** Total active nodes in the subgraph $\le 11$.
2. **Model Call Budget:** Max model calls per role $\le 2$.
3. **Output Token Limits:** Bounded output token budget defined per task schema.
4. **Wall-Clock Timeout:** Per-node timeout (default 15,000ms; max 30,000ms).
5. **Quota Pre-Flight:** Calls `consume_quota(p_workspace_id, p_quota_kind, 1)`. If quota is exhausted, execution fails closed *before* any external model API is reached.

---

## 6. Audit & Sanitization Rules

- **Zero Content Logging:** Raw user prompts, customer conversation texts, and raw completions are NEVER logged to audit tables or console logs.
- **Metadata Only:** Stored run records contain run IDs, workspace ID, actor ID, execution timestamp, node status, token counts, error codes, and cited entity UUIDs.
