# Data and Evidence Contract

## Core durable entities

| Entity | Required purpose |
|---|---|
| `workspaces`, `workspace_members` | Tenant boundary, roles, and audit ownership |
| `brands`, `brand_codex_versions`, `brand_rules` | Positioning, claim policy, tone, proof, compliance, and historical versions |
| `source_connections`, `source_refresh_runs`, `source_health` | Authorized source scope, status, freshness, coverage, errors |
| `evidence_items`, `evidence_claim_links` | Source URL/import, content hash, timestamps, evidence class, normalized fields, claim linkage |
| `creative_assets`, `creative_twin_versions`, `creative_features` | Original asset metadata, extracted transcript/scenes/claims/CTA, confidence, source provenance |
| `audiences`, `audience_segments`, `persona_panels` | User-approved audience definitions and simulation assumptions |
| `decision_packets` | Immutable task inputs: goal, audience, asset, source set, policy, known unknowns |
| `agent_runs`, `agent_findings`, `agent_failures` | Typed agent execution, output, model/provider, retry and fallback history |
| `experiments`, `experiment_hypotheses`, `creative_variants`, `approvals` | Controlled changes, hypotheses, reviews, decisions, and audit history |
| `publishing_recommendations`, `publishing_window_tests` | Platform-specific test windows, data basis, outcome and confidence |
| `campaign_outcomes`, `calibration_metrics` | Observed metrics, metric definitions, time ranges, completeness, ranking/absolute accuracy |
| `notification_rules`, `notification_events` | Thresholds, delivery state, evidence link, deduplication |
| `audit_events`, `model_policy_versions` | Security, access, policy, model, prompt, and evidence history |

## Mandatory field rules

### Evidence item

Every evidence item needs: `workspace_id`, `kind`, `evidence_class`, `source_type`, `source_url_or_import_id`, `captured_at`, `source_published_at` when known, `coverage_start`, `coverage_end`, `freshness_status`, `content_hash`, `raw_metadata`, and `permissions_status`.

### Agent finding

Every agent finding needs: `agent_role`, `decision_packet_id`, `status`, `summary`, `claims[]`, `evidence_item_ids[]`, `assumptions[]`, `unknowns[]`, `confidence`, `disagreement`, `model_provider`, `model_id`, `prompt_version`, `created_at`, and `validation_verdict`.

### Numeric claim

Every numeric claim needs: `metric_key`, `value`, `unit`, `definition`, `source_evidence_id`, `observed_or_inferred`, `time_window`, `aggregation_method`, `completeness_status`, and `display_label`.

If any required numeric field is absent, do not show a number. Show a qualitative status such as `not available`, `insufficient evidence`, or `directional simulation only`.

## Zod-style interface sketch

```ts
type EvidenceClass = "observed" | "sourced_claim" | "inference" | "simulation" | "unknown";
type ValidationVerdict = "pass" | "downgrade" | "block" | "human_review";

interface Claim {
  statement: string;
  evidenceClass: EvidenceClass;
  evidenceIds: string[];
  assumptions: string[];
  confidence?: number;
  disagreement?: number;
  requiresHumanValidation: boolean;
}

interface AgentFinding {
  agentRole: string;
  decisionPacketId: string;
  status: "completed" | "partial" | "blocked" | "failed";
  summary: string;
  claims: Claim[];
  unknowns: string[];
  model: { provider: string; id: string; promptVersion: string };
  validationVerdict: ValidationVerdict;
}
```

## Evidence validation order

1. Validate schema and required fields.
2. Validate workspace ownership and source permission.
3. Validate source freshness and covered time range.
4. Validate each factual/numeric claim against linked evidence.
5. Detect duplicate, conflicting, or out-of-scope sources.
6. Apply Brand Codex and compliance rules.
7. Return `pass`, `downgrade`, `block`, or `human_review`.

## UI states that must exist

Every data-bearing component needs explicit designs for: loading, empty, disconnected, importing, partial, stale, conflict, blocked, insufficient evidence, validation pending, human review required, provider unavailable, and completed/verified.

No chart, score, trend card, or timing suggestion may have populated-looking fake data as its default state.
