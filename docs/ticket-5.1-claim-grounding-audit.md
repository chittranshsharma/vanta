# Ticket 5.1 Design: Claim-Grounding Audit (first evidence-gated model task)

Status: design + repository-only contract. **Not wired into the gateway allowlist. No Groq call. No deployment.**
Prerequisites before wiring: Ticket 5.0 deployed and health-checked (approval), migrations 007-009 live (D-1 to D-3).

## 1. What the task is

Given one Creative Twin's extracted claims and the workspace's approved Brand Brain claims and proof points, the model classifies each creative claim as one of:

| Grounding verdict | Meaning | Evidence class of the verdict |
|---|---|---|
| `backed_by_proof` | Claim matches an approved brand claim that has at least one proof point the model cites by ID | `inference` |
| `approved_no_proof` | Claim matches an approved brand claim but no proof point exists in the workspace | `inference` |
| `conditional` | Matches a brand claim whose `claim_type` is conditional; the model states the condition it found | `inference` |
| `prohibited` | Matches a prohibited brand claim | `inference` |
| `unmatched` | No brand claim corresponds; the model must not invent one | `unknown` |

The output is a review queue for a human, never an automatic edit. It never scores virality, audience fit, reach, or conversion.

## 2. Why this task first

- Inputs already exist and are typed: `creative_claims`, `brand_claims`, `brand_proof_points`.
- Every verdict can be checked against an allowed-ID set, so hallucinated citations are mechanically rejectable.
- The deterministic `extractDeterministicClaims` already produces a lexical `brand_alignment_status`; the model task adds semantic matching where lexical matching says `possible_term_overlap` or `no_brand_claim_match`. Disagreement between the two is surfaced, not hidden.
- No media, no external data, no prediction.

## 3. Data flow (server side only)

```text
browser  { workspace_id, task_type: "claim_grounding_audit", twin_id }
  -> Edge Function: JWT -> workspace member -> twin belongs to workspace (caller's RLS client)
  -> load creative_claims(twin), brand_claims(workspace, approved|conditional|prohibited), brand_proof_points(workspace)
  -> build ALLOWED_IDS = { brand_claims.id } ∪ { brand_proof_points.id }
  -> fixed system prompt + JSON schema (server-owned) + the rows as untrusted data
  -> Groq structured output
  -> validateClaimGroundingOutput(raw, { creativeClaimIds, allowedBrandClaimIds, allowedProofIds })
       rejects: unknown keys, missing claims, duplicate claims, IDs outside the allowed sets,
                verdicts whose required citations are absent, free-text over length caps
  -> persist to model_task_runs (new table, migration 010, future) with evidence_class per verdict
  -> respond with validated verdicts + validation report; UI shows them under a "model inference, needs review" label
```

The browser sends three fields. It never sends claim text, prompts, schema, or model name. The gateway field whitelist in `guards.ts` extends to `twin_id` only when this task is enabled.

## 4. Output schema (server-owned)

Implemented in `supabase/functions/model-gateway/tasks/claimGroundingAudit.ts` as a pure validator with tests. Summary:

```json
{
  "verdicts": [
    {
      "creative_claim_id": "uuid from input set, each exactly once",
      "verdict": "backed_by_proof | approved_no_proof | conditional | prohibited | unmatched",
      "matched_brand_claim_id": "uuid from allowed set, or null only when verdict = unmatched",
      "cited_proof_point_ids": ["uuid from allowed set"],
      "rationale": "<= 400 chars, plain text",
      "confidence": "low | medium | high"
    }
  ]
}
```

Validator rules, all fail-closed:

1. Top level has exactly the key `verdicts`. Array length equals the input claim count; every input claim id appears exactly once; no extra ids.
2. `backed_by_proof` requires `matched_brand_claim_id` in the approved set and at least one cited proof id, each in the allowed proof set **and** belonging to that brand claim.
3. `approved_no_proof` requires an approved brand claim id and an empty citation list.
4. `conditional` requires a brand claim id whose type is conditional.
5. `prohibited` requires a brand claim id whose type is prohibited.
6. `unmatched` requires `matched_brand_claim_id = null` and no citations.
7. `rationale` length cap; `confidence` enum; no other keys on any object.
8. Any violation rejects the entire response (`validation_failed`), with per-item error strings for the audit log. No partial acceptance in the first version.

`confidence` is the model's self-report and is displayed as such; it is not calibrated and the UI label must say so.

## 5. Failure and degradation path

| Situation | Gateway response | UI |
|---|---|---|
| Zero creative claims on the twin | 400 `nothing_to_audit` | "No claims extracted; nothing to ground." |
| Zero approved/conditional/prohibited brand claims | 400 `brand_codex_empty` | Guided next step: configure Brand Brain |
| Provider error | 502 `upstream_provider_error` | Retry allowed, no verdicts shown |
| Schema violation | one schema-repair retry with the validator's error list appended as untrusted feedback; second failure -> 502 `validation_failed` | "Model output rejected; nothing displayed" |
| Rate limit | 429 | as today |

Retry policy: one transient retry, one schema repair, then stop. No provider fallback in 5.1 (5.2).

## 6. Persistence (migration 010, not authored yet)

`model_task_runs(id, workspace_id, twin_id, task_type, model, prompt_version, schema_version, status, validation_errors jsonb, output jsonb, prompt_tokens, completion_tokens, latency_ms, created_by, created_at)` with RLS mirroring `creative_twin_versions` (member select/insert, deny update/delete) and composite FK `(twin_id, workspace_id)`. Authored only after 007-009 are live so the pending queue stays reviewable.

## 7. Acceptance checks for the implementation ticket

- Validator unit tests cover each rule with one positive and one negative case (done in this phase).
- Gateway integration test (Deno, local): mocked provider returning (a) valid, (b) unknown id, (c) missing claim, (d) extra key; expect only (a) to pass.
- `audit_events` row per run with `validation_status`.
- UI renders verdicts with evidence badge `inference` or `unknown`, and a visible "needs human review" state. No verdict auto-applies to `creative_claims`.
- Negative product check: the UI copy contains no performance, reach, or engagement language.

## 8. Out of scope for 5.1

Scene clarity, persona simulation, trend research, counterfactuals, multi-agent arbitration, provider fallback, calibration.
