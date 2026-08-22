# Agent Orchestration and Recovery Contract

## Core model

SignalForge uses a **Creative Intelligence Council**. Agents are specialized workers over one immutable Decision Packet and shared Evidence Ledger. The Orchestrator is a scheduler and synthesizer, not an unchecked super-agent.

## Primary agents

| Agent | Input | Output | Independent gate |
|---|---|---|---|
| Discovery Agent | Brand context, current decision, missing fields | Minimum-question plan and context summary | Question necessity check |
| Brand Guardian | Brand Codex, asset, proposed copy | Claim/tone/compliance flags | Approved-claim and policy check |
| Creative Analyst | Asset, transcript, landing copy | Versioned Creative Twin | Extraction provenance/confidence check |
| Audience Strategist | Brand/audience context | Panel definition, segment assumptions | Brand completeness and user approval check |
| Journey Simulator | Panel, Creative Twin, objective | Directional simulated findings | Simulation-label/evidence-class check |
| Trend Researcher | Approved sources, topic, time range | Cited trend brief and source coverage | Citation/freshness/source-policy check |
| Publishing Engineer | Owned analytics, platform context, trend evidence | Ranked test windows and readiness audit | Metric-source/platform-availability check |
| Creative Director | Validated diagnoses | Prioritized edit brief | Every recommendation linked to diagnosis |
| Mutation Engineer | Controlled hypothesis and rules | Variant + exact change log | Variable/control and claim-boundary check |
| Experiment Manager | Findings, variants, approvals | Test plan and decision history | Approval/state-machine check |
| Outcome Analyst | Authorized metrics/CSV | Calibration and divergence analysis | Metric-definition/completeness check |
| Evidence Arbiter | All findings and evidence | Pass/downgrade/block/human-review verdict | Final authority on factual/numeric display |

## Task graph rules

- Agents cannot start without a valid Decision Packet.
- Independent work can parallelize; dependent work waits for validated prerequisites.
- User-facing synthesis runs only after Evidence Arbiter validation.
- Each run persists task state, input version, agent role, model/provider, prompt version, source set, retry/fallback history, and validation verdict.
- No agent may perform an external side effect. The Orchestrator creates approval requests only.

## Recovery protocol

| Failure class | First action | Safe fallback | Final output if unresolved |
|---|---|---|---|
| Timeout/rate limit | One idempotent backoff retry | Approved alternate provider/model | Delayed/blocked task, no substitute conclusion |
| Invalid schema | Reject raw result | Constrained structure repair using same evidence | Schema error / partial output |
| Missing citation | Block claim | Retrieval over approved sources only | Insufficient evidence |
| Hallucination risk | Compare claims to Evidence Ledger | Independent Claim Verifier using original sources | Facts-only output / human review |
| Disagreement | Preserve competing claims | Identify minimum discriminating experiment | Disagreement card and test proposal |
| Source conflict | Preserve metadata and timestamps | Source Quality ranking | Conflict state / human choice |
| Stale coverage | Downgrade confidence | Refresh authorized source or request new export | Last-verified data with stale warning |
| Missing creative data | Mark unavailable fields | Ask for transcript/frame/manual correction | Partial Creative Twin |
| Policy/compliance risk | Pause work | Brand Guardian + human approval | Approval required |

## Bounded retries

At most one retry for transient failure, one structural repair attempt, and one alternate-provider/model attempt. Do not loop, silently vary prompts, or elevate confidence because a claim was repeated.

## User-facing transparency

Each completed task should expose agent role, run status, source count, evidence class, confidence, disagreement, provider/model, fallback used, timestamp, and human approval need. Build an Agent Health and Evidence Console before claiming the multi-agent system is production-ready.
