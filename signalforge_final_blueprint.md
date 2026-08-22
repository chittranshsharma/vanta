# SignalForge: Final Product Blueprint

# SignalForge — Canonical Product Blueprint

## The final answer

Build **SignalForge**, a web-first **Creative Intelligence and Experimentation OS** for product demos, paid-social ads, UGC, landing-page videos, and short-form content.

The product is not a “viral score.” It is not a ChatGPT wrapper. It is not a collection of fake focus-group chats. It is not a copy of Viralyst, Minds, Brandmaven, Pencil, Motion, or Aaru.

> **SignalForge tells a company which creative to make, which audience it is likely to move, why it may fail, what to change, what to test next, and how accurate the prediction was after real-world performance arrives.**

The central loop is:

> **Ingest → understand → simulate → diagnose → mutate → compare → approve → publish → measure → calibrate.**

This is the strongest product we can make from the original idea while remaining realistic about free infrastructure.

## Canonical product specification — user-approved requirements

This section is the authoritative scope for SignalForge. The later sections expand its strategy, workflow, evidence model, and technical direction. **The platform must privilege trustworthy, action-ready creative decisions over attractive but unsupported outputs.**

### 1. Cinematic public site and authenticated workspace

SignalForge must have both a public marketing site and an authenticated product workspace. The public experience should make the value proposition understandable in a few seconds; the workspace should feel like a high-end creative command center rather than a conventional SaaS dashboard.

The visual system must be bespoke, cinematic, immersive, and deeply polished. It should use generous negative space, layered translucency, sculpted depth, restrained gradients, high-contrast typography, tactile hover states, and refined motion that serves comprehension. The interface should reserve modular **ReactBits-compatible component zones**—for hero treatments, ambient backgrounds, scrolling reveals, data visualizations, text effects, and interaction modules—so new components can be imported later without damaging layout, accessibility, or performance.

> The aesthetic standard is not “more effects.” It is **controlled spectacle with evidence-first clarity**: the user should feel intelligence, confidence, and depth without ever losing the data, source, or decision.

### 2. Brand Brain and Brand Codex

Each workspace must include a reusable **Brand Brain** that captures product positioning, approved and prohibited claims, audience segments, competitors, tone, visual identity, proof points, objections, category context, legal/compliance boundaries, and historic campaign learnings. Brand context must be applied to every analysis, generation, trend brief, and recommendation.

The Brand Brain must expose a versioned **Brand Codex**, showing what information is user-provided, what has evidence, what is inferred, and what remains unknown. It should support explicit review and approval of claims, sources, rules, and generated recommendations so that the system cannot quietly adopt unverified brand information.

### 3. Structured ingestion and Creative Twin creation

SignalForge must ingest scripts, hooks, captions, CTAs, thumbnails and first frames, short-video metadata, landing-page copy, product-page context, campaign-result CSVs, and manually supplied links. Each imported asset must produce a versioned **Creative Twin** with structured data for message, scene, timing, visual language, proof, claims, CTA, audience assumptions, source origin, and extraction confidence.

Input processing must distinguish original user-provided material from extraction results. It must preserve timestamps and coverage information, visibly flag unavailable media attributes, and never invent a scene, transcript, metric, or campaign field that was not supplied or verifiably extracted.

### 4. Audience Journey Simulator

The Audience Journey Simulator must evaluate scroll-stop, first-frame comprehension, relevance, trust, objections, action intent, recall, and segment disagreement for each creative variant. Persona responses must be structured and auditable, with a stable audience definition and a visible distinction between simulated reactions, observed evidence, and model inference.

The simulator is a **creative-response and experiment-prioritization tool**. It must never claim exact platform reach, exact organic views, guaranteed virality, or direct replication of Instagram, TikTok, YouTube, or any other platform’s ranking algorithm.

### 5. Creative Decision Matrix and Timeline Doctor

The product must provide a Creative Decision Matrix that compares variants by objective, audience segment, trust, comprehension, relevance, proof strength, action intent, disagreement, and uncertainty. The matrix should answer both “what is strongest overall?” and “what is strongest for this audience and objective?”

The Timeline Doctor must identify likely failure moments, including delayed hooks, incomplete product explanation, text overload, unsupported claims, weak proof, unclear visual-narrative alignment, unaddressed objections, missing brand linkage, poor CTA timing, and low-confidence interpretation. Every finding must include the evidence used, confidence, an explanation, and a precise recommended edit. If evidence is insufficient, it must say so plainly rather than fabricate diagnosis.

### 6. Counterfactual Lab and Creative Mutation Engine

The Counterfactual Lab must let teams isolate changes to hooks, CTAs, proof, structure, duration, spokesperson, first frames, captions, and audience framing. It must report the expected directional effect, affected audience segments, uncertainty, and assumptions.

The Creative Mutation Engine must generate controlled alternatives only from documented weaknesses or explicit team hypotheses. Each alternative must preserve a change log, link back to the diagnosis that prompted it, explain what variable changed, and be retested using the exact same audience definition. The workflow is deliberately closed:

> **Diagnose → state hypothesis → mutate one controlled variable → retest → compare evidence → approve or reject.**

### 7. Evidence-grounded Trend Intelligence

Trend Intelligence must turn permitted, attributable data into actionable creative context. It should support approved news sources, RSS feeds, official or authorized social/API feeds, public trend data where terms permit, manually supplied links, user-uploaded research, and campaign outcomes. It should identify recurring themes, narrative shifts, content formats, emerging objections, category vocabulary, competitor positioning changes, and relevant conversations.

Every Trend Intelligence card must disclose its source set, citations, source timestamps, refresh time, covered time window, coverage limitations, confidence, and whether the conclusion is an observed fact, a sourced claim, a model inference, or an unknown. Trend claims without sources must be blocked from presentation.

SignalForge must not scrape private accounts, evade paywalls, bypass access controls, automate logged-in consumer accounts, or represent inaccessible Instagram Reels, X posts, Reddit content, or other platform content as verified data. Where reliable public collection is not permitted or available, the product should support **manual, CSV, RSS, link, export, and official-API imports** instead.

### 8. Compliant social, campaign, and brand integrations

The integration model must prioritize user-authorized and official sources. It should support a source registry that shows connection status, scopes, source owner, last sync, data coverage, and known limitations. First-class targets may include official Meta/Instagram business surfaces, YouTube analytics/data, TikTok business tools, Google Ads, LinkedIn campaign data, RSS/news feeds, and user-provided exports, subject to each provider’s terms, access, review, and rate limits.

The product must never imply a connection is active, a source is complete, or a platform metric is available when it is not. A disconnected integration must produce a clear blocked or manual-import state, not a fabricated placeholder result.

### 9. Anti-hallucination evidence layer

Every insight, score, trend, and recommendation must pass through an **Evidence Layer**. The interface must separate the following classes visibly:

| Evidence class | Meaning | Interface requirement |
|---|---|---|
| **Observed fact** | Directly present in an approved source, user input, or measured campaign outcome | Show source, timestamp, field/value, and retrieval status |
| **Sourced claim** | A statement made by a cited third party | Show the original citation and attribution |
| **Model inference** | A reasoned synthesis or prediction based on inputs | Show assumptions, model/version, confidence, and disagreement |
| **Unknown / insufficient evidence** | The system lacks enough reliable information | Stop the claim, explain the gap, and request a source, import, or human validation |

Fabricated metrics are forbidden. When a real numeric source does not exist, the platform may provide an explicitly labeled **directional simulation signal** or a relative comparison, but it must not present an invented percentage, view forecast, CTR, ROAS, popularity count, engagement total, or trend volume as a measured fact.

All LLM outputs must be schema-validated, grounded in a bounded evidence set, versioned, stored with the prompt and model version, and rejected or downgraded when citations are missing, inputs conflict, source coverage is stale, or model disagreement is high. Human-validation requirements must be explicit rather than hidden in a generic confidence score.

### 10. Experiments, approvals, and outcome calibration

The product must track a complete, auditable history of experiments: hypotheses, creative variants, audience definitions, reviews, approvals, publishing decisions, source evidence, real watch/engagement/conversion outcomes, and prediction-versus-outcome accuracy. It must calculate ranking accuracy separately from absolute-metric accuracy and preserve the model/prompt version used for each prediction.

The system should recommend the next experiment—not simply the next asset—by explaining the unresolved uncertainty, expected learning value, required evidence, and decision it would unlock. Users must be able to inspect why a recommendation changed after new campaign evidence arrived.

### 11. Scheduled evidence refresh and stale-data controls

Approved news, RSS, and official or authorized social/API feeds must support scheduled refresh. Every scheduled ingestion job must be source-scoped, idempotent, observable, rate-limited, and auditable. Refreshes must use durable platform scheduling rather than in-process timers, and every feed must show the last successful refresh, next scheduled refresh, freshness window, error state, and stale-data warning.

No trend panel should look live if it is stale, partially retrieved, disconnected, or failing. When a source is unavailable, the product must preserve historical evidence with a clear “last verified” timestamp instead of silently filling the gap with a model-generated summary.

### 12. Notifications and human attention

Workspace members must receive configurable notifications when a monitored trend materially spikes, a connected campaign outcome materially diverges from a prediction, a source becomes stale, an ingestion job fails, or an analysis needs human validation or approval. Alerts must include the triggering evidence, severity, time window, confidence, and a direct path to review the underlying sources and decision history.

The system should avoid noisy automation. A notification must be explainable, threshold-based, deduplicated, and actionable; “something may be happening” is not an acceptable alert.

### 13. Publishing Intelligence and Algorithm Engineer

SignalForge should expand from a creative-decision platform into a **cross-platform Publishing Intelligence and Algorithm Engineer** for product teams, agencies, independent creators, educators, artists, media operators, and every short-form or video publisher. Its purpose is to recommend the **best next upload windows to test**, explain distribution-readiness risks, and learn a creator’s or brand’s actual operating pattern over time.

The product must not claim access to a platform’s private ranking algorithm, exact “scroll time,” platform-wide real-time audience levels, guaranteed reach, or a universal best time to post. It should optimize the decision that is actually available:

> **“Given this creator or brand, this audience, this platform, this objective, and the evidence we have, which upload windows are most worth testing next—and why?”**

Instagram’s official Insights documentation says that eligible public professional accounts can view follower activity times, while noting that some viewer and engagement metrics are estimated and in development.[17] TikTok’s Creator Academy specifically presents follower activity by hour as a programming-calendar signal and recommends publishing on active days up to two hours before a peak.[18] YouTube Studio offers a “when your viewers are on YouTube” report based on the previous 28 days and describes it as useful for scheduling community activity, Premieres, and live streams.[19] These are valid first-party inputs when a user connects an authorized source or provides a compliant export; they are **not** proof of platform-wide reach or a guarantee that one upload time will win.

#### Publishing evidence hierarchy

| Priority | Evidence source | Appropriate use | Not permitted |
|---:|---|---|---|
| **A — owned, first-party** | Authorized account analytics, campaign exports, audience activity, historical posts, audience geography, actual retention and conversion data | Primary basis for account-specific upload-window recommendations and calibration | Treating a missing metric as available or complete |
| **B — authorized, platform-provided** | Official creator/business APIs, official trend tools, owned ad accounts, approved analytics exports | Platform and category context, status checks, traffic-source and format insights | Bypassing platform access, scraping private accounts, or impersonating a user session |
| **C — cited public context** | Reputable public research, official creator guidance, RSS/news, publicly accessible trend data where terms permit | A clearly labeled prior when first-party history is absent | Presenting generic studies as the creator’s actual audience behavior |
| **D — model inference** | Pattern recognition across supplied evidence | Exploratory test hypotheses, conditional recommendations, uncertainty explanations | Invented active-audience volumes, scroll-minute estimates, reach counts, or popularity metrics |

#### Upload Window Engine

The Upload Window Engine must produce a **time-zone-aware weekly opportunity map** with multiple recommended testing windows rather than one magic timestamp. Every recommendation must contain:

- The target platform, account, location/time-zone mixture, content type, and objective.
- A ranked list of two to four test windows, including local time and UTC.
- The evidence used, sources, coverage period, refresh time, and missing data.
- An explanation of the contributing factors: audience activity, comparable-post performance, traffic source, viewer geography, retention patterns, creator cadence, public trend relevance, and launch objective.
- Confidence, disagreement, uncertainty, and the reason a recommendation may be weak.
- A “no account-specific timing evidence” or “insufficient evidence” result when appropriate.
- A test design stating what should stay constant, what should vary, and what outcome will be used to learn.

The engine should separate **follower availability**, **historical post performance**, **trend timeliness**, **audience time-zone overlap**, **content-readiness**, and **experiment value**. It must never label an estimated availability proxy as literal “scroll time” unless an approved source provides that metric with definition and timestamp.

#### Distribution Readiness Audit

The Algorithm Engineer should evaluate creative and publishing readiness as a transparent checklist, not as a fictional reverse-engineering of a platform algorithm. The audit should cover:

| Readiness area | Evidence-backed question | Output |
|---|---|---|
| **Platform fit** | Does the format, aspect ratio, length, metadata, and content objective fit the selected surface? | Compatibility and missing-requirements alert |
| **First-second strength** | Does the first frame and first spoken or written beat make the content understandable and compelling? | Hook risk and prioritized edit |
| **Retention risk** | Where do historical or simulated viewers lose orientation, relevance, or trust? | Timestamp-level risk and testable fix |
| **Audience timing** | When is this account’s relevant audience active or historically responsive? | Test-window set with data basis |
| **Trend relevance** | Is a verified current topic, search term, sound, format, or conversation relevant to the brand and creative? | Cited trend opportunity or explicit “no verified trend signal” |
| **Novelty and fatigue** | Is this asset too similar to the account’s recent creative or a stale format? | Similarity evidence and novelty direction |
| **Brand and policy safety** | Are claims supported, boundaries respected, and disclosure/approval needs visible? | Approval gates and human-review requirement |
| **Measurement readiness** | Can the team capture the result needed to validate the experiment? | Missing-connector or measurement-plan alert |

#### Cross-platform creator mode

SignalForge should offer a creator-friendly mode for people who publish Reels, Shorts, TikToks, LinkedIn video, long-form video, or other platform-appropriate content—not only brands selling products. Creator mode should support content pillars, recurring series, audience geographies, launch cadence, platform-specific objectives, trend research, video retention history, and an “upload plan” that turns creative recommendations into a testable weekly publishing calendar.

The product should keep platform surfaces distinct. A recommended TikTok window may be based on TikTok follower-activity data; a YouTube Premiere or Short recommendation may rely on YouTube audience availability and historical channel data; an Instagram recommendation may use professional-account Insights and owned historical outcomes. SignalForge must never combine signals across platforms as though they are interchangeable or derive a cross-platform recommendation from data it does not have.

#### Timing experiment and calibration loop

The platform must treat timing as an experimentable variable. It should allow users to hold the creative and audience goal constant, test comparable windows, record the data source and timing rationale, ingest observed results, and calculate whether the timing recommendation improved relative performance for that account and content category.

The recommendation logic should gradually become more account-specific as sufficient own-history data accrues. Until then, generic research and trend context remain clearly labeled priors. The system should automatically downgrade confidence when there are too few comparable posts, a material audience geography shift, a new content format, major seasonal change, a broken integration, or stale source data.

#### Publishing alerts and planned refreshes

Publishing Intelligence should create evidence-based alerts such as: an upcoming high-confidence test window, a trend that is becoming stale, a platform connection that stopped refreshing, a timing result that contradicted the model, or a repeated upload pattern that is reducing learning quality. It must not generate an alert simply because a generic “best time to post” blog says a particular hour is popular.

Scheduled refreshes must use durable, authenticated, idempotent platform scheduling, obey source-specific rate limits, and expose last successful refresh, next planned refresh, partial-coverage status, and stale-data warnings. No in-process timer or noncompliant scraping should be used to simulate real-time trend intelligence.

### 14. Quality bar and thoughtful additions

Thoughtful additions are welcome when they strengthen one of the following: evidence integrity, decision quality, creative velocity, brand safety, team collaboration, calibration, accessibility, or visual clarity. Features that merely create activity, decorative charts, fabricated data, or generic AI copy must not be added.

The final experience should feel premium and surprising while remaining calm, credible, and exact. Motion should be purposeful, remain performant, respect reduced-motion preferences, and never obscure a citation, confidence state, or action.

## Development environment and model independence

SignalForge will be developed in **Antigravity IDE**. Development work may move between Claude Sonnet thinking, Gemini Flash High, Gemini Pro, or another approved coding model as quotas and task complexity require. The development environment and selected model are **not** the deployed product infrastructure: the finished platform still needs its own database, hosting, storage, model providers, quotas, media pipeline, security, scheduling, and user-facing application.

The Antigravity implementation pack is the durable project memory. It provides a product constitution, architecture/data/agent contracts, ordered tickets, QA gates, and short continuation prompts so no model must rely on recalling the entire project from chat context. Use stronger reasoning models for architecture, security, evidence policy, migrations, and orchestration; use faster models only for narrowly scoped tickets with clear contracts and acceptance criteria.

## Why this product can win despite strong competitors

The public market is already crowded. The category includes synthetic-audience platforms, attention-prediction tools, human pretesting, live experimentation, generation platforms, and post-launch analytics.[2] Electric Twin emphasizes customer-data-grounded synthetic audiences and hold-out validation.[3] Aaru emphasizes behavioral and outcome simulation.[4] Synthetic Users emphasizes stable participant profiles, structured research workflows, and proprietary-data grounding.[5] Brandmaven already offers synthetic customers, trust/relevance/clarity/emotional-resonance/purchase-intent scoring, and testing of ads, social content, video scripts, messaging, blog articles, and product names.[6] Pencil combines generation, briefing, editing, launch, scoring, ROAS prediction, and large performance datasets.[7] Motion analyzes thousands of live ads, identifies winning patterns, tracks competitor ads, tags creative elements, and recommends the next creative to make.[8]

Therefore, we cannot win by adding “more personas,” “more scores,” or “more AI features.” The defensible difference must be **the quality of the decision loop**.

| Existing category | What it does well | SignalForge’s opportunity |
|---|---|---|
| Synthetic audiences | Fast qualitative reactions and segment feedback | Add sequential behavior simulation, counterfactual tests, uncertainty, and real-outcome calibration |
| Attention prediction | Visual saliency and likely attention | Combine attention with comprehension, trust, claims, objections, and conversion intent |
| Human pretesting | Real responses and higher evidence quality | Use simulation to screen cheaply, then escalate uncertain/high-value decisions to real users |
| In-market testing | Actual behavioral performance | Use pre-launch predictions to select better experiments and learn from outcomes |
| Creative generators | High-volume variants | Generate variants only after identifying a measured failure, then retest every variant |
| Post-launch analytics | Historical patterns and winning elements | Provide a useful pre-launch model even when a customer has little historical data |
| General AI agents | Flexible knowledge work | Use specialized agents inside one vertical workflow with auditable outputs |

## The product’s unique core: the Creative Twin

The centerpiece should be a **Creative Twin**, a structured representation of a creative asset that includes:

- The spoken transcript and semantic message.
- Scene sequence and shot purpose.
- First-frame and first-three-second hook.
- Product visibility and demonstration clarity.
- On-screen text, subtitles, and reading burden.
- Claims, proof, testimonials, and trust signals.
- Pacing, pauses, scene changes, audio energy, and silence.
- CTA timing and action clarity.
- Visual style, creator style, and brand alignment.
- Audience, objective, platform, and placement assumptions.
- Similarity to the customer’s previous creatives and competitor references.

The Creative Twin lets the product compare edits and variants at the level of **causal creative changes**. Instead of saying “make it more engaging,” it can say:

> “Moving the product demonstration from second 8 to second 2 is predicted to improve problem comprehension for solution-aware viewers, while reducing curiosity among cold audiences. Test a proof-first version for cold traffic and retain the current version for retargeting.”

That is a strategic recommendation, not a generic AI sentence.

## The Audience Journey Simulator

Do not ask personas only, “Do you like this video?” Simulate a small sequence of decisions:

| Stage | Simulated question | Product output |
|---|---|---|
| **Scroll** | Would this person stop or continue? | Hook and first-frame risk |
| **Orient** | Do they understand what they are seeing? | Product and problem comprehension |
| **Watch** | Will they continue through the next moment? | Drop-off risk by timestamp |
| **Believe** | Do the claim and proof feel credible? | Trust and skepticism analysis |
| **Relate** | Is this relevant to the person’s situation? | Segment relevance |
| **Act** | Would they click, save, share, comment, sign up, or buy? | Objective-specific intent |
| **Remember** | What do they recall later? | Message and brand recall estimate |
| **Object** | What would stop action? | Objection clusters and unanswered questions |

The persona should have memory across the journey. It should not generate eight unrelated opinions. Each persona has a defined context, awareness level, motivation, constraints, skepticism, and current relationship to the brand.

This does not reproduce Instagram’s actual recommendation system. Instagram publicly explains that different surfaces have different ranking systems and that Reels ranking considers user activity, creator interaction history, reel content, creator information, and predictions such as resharing, full viewing, likes, and audio-page visits.[9] [10] SignalForge should predict **creative response under a defined audience and objective**, not promise exact organic reach.

## The maximum product feature system

### 1. Brand Brain

Each workspace begins with a Brand Brain containing the product, category, positioning, audience, tone, visual identity, approved claims, forbidden claims, regulatory constraints, competitors, pricing, proof points, customer objections, and historical creative outcomes.

Users can add information through text, PDFs, websites, product documentation, support transcripts, reviews, campaign reports, and manually curated notes. All insights should retain provenance so users can see where a recommendation came from.

The Brand Brain produces a **Brand Codex**: a machine-readable ruleset used by the analyst, generator, evaluator, and brand-safety agent.

### 2. Creative ingestion

Support the following inputs over time:

| Input | Free-first implementation | Full product direction |
|---|---|---|
| Hook/script | Direct text entry | Import from content libraries and briefs |
| Caption/CTA | Direct text entry | Generate and compare alternatives |
| Thumbnail/first frame | Small image upload | Frame-level visual analysis |
| Short video | Small, short upload | Full timeline and audio analysis |
| Landing page | URL or pasted text | Ad-to-page message continuity analysis |
| Product page | URL or pasted text | Claim and benefit grounding |
| Existing campaign data | CSV upload | Official platform connectors |
| Competitor examples | User upload or permitted public sources | Public ad-library monitoring where allowed |

### 3. Audience Builder

Users define audiences using demographics, psychographics, behaviors, awareness stage, jobs-to-be-done, buying motivation, price sensitivity, category familiarity, objections, geography, language, and relationship to the brand.

The platform automatically creates **audience segments** and shows whether a creative is:

- Broadly strong.
- Strong only for one segment.
- Polarizing.
- Confusing to cold audiences.
- Better for retargeting than acquisition.
- High-attention but low-trust.
- High-interest but low-action.

### 4. Creative Decision Matrix

Every test produces a matrix of variants by audience segment and objective. The core scores should include:

- Stop probability.
- Hook clarity.
- Problem recognition.
- Product comprehension.
- Differentiation.
- Trust.
- Emotional resonance.
- Relevance.
- Proof strength.
- CTA clarity.
- Click intent.
- Lead intent.
- Purchase readiness.
- Share/save likelihood.
- Brand recall.
- Policy or claim risk.
- Model uncertainty.

Never collapse these into only one number. A summary score may exist, but the user must be able to inspect the underlying dimensions and disagreements.

### 5. Timeline Doctor

The Timeline Doctor displays the video as a timeline and marks likely failure points:

- Hook arrives too late.
- Product is invisible.
- Visual and narration disagree.
- Text is too dense.
- The claim lacks proof.
- The demo is hard to understand.
- The audience objection appears but is not answered.
- The CTA is unclear.
- The creative resembles previous assets too closely.
- The final frame does not support the action.

Each diagnosis must include a recommended edit and the reason for the recommendation.

### 6. Counterfactual Lab

This is one of the most important differentiators. Users change one variable and see the predicted effect:

- Hook A versus Hook B.
- Problem-first versus proof-first.
- Founder face versus product screen.
- Voiceover versus subtitles only.
- Product shown immediately versus after setup.
- Benefit CTA versus urgency CTA.
- 15-second cut versus 30-second cut.
- Technical explanation versus outcome-led explanation.
- Expert spokesperson versus customer testimonial.

The output should highlight **what changed, for whom, and with what confidence**.

### 7. Creative Mutation Engine

The system generates alternatives only from identified weaknesses. It should create:

- New hooks preserving the central promise.
- Hooks for different awareness stages.
- Shorter and longer versions.
- First-frame concepts.
- CTA variations.
- Proof-first versions.
- Objection-handling versions.
- Skeptical-audience versions.
- UGC-style versions.
- Founder-led versions.
- Screen-recording versions.
- Comparison and demonstration versions.
- Localized scripts.
- Caption and subtitle variants.

Every mutation is automatically retested by the same Audience Journey Simulator. Generation without retesting is not allowed in the core workflow.

### 8. Multi-touch journey mode

Most creative tools evaluate a single asset. SignalForge should later support a sequence:

> Ad → landing page → signup form → onboarding screen → first product action.

The system checks whether the promise survives across the journey. It can identify “message cliffs,” where an ad creates an expectation that the landing page or onboarding experience does not satisfy.

This is a high-value expansion because companies do not lose money only from weak videos; they lose money from broken transitions between the video and the product experience.

### 9. Creative fatigue and novelty

Track semantic, visual, and structural similarity across the customer’s creative library. Identify:

- Repeated hooks.
- Repeated first-frame compositions.
- Same spokesperson fatigue.
- Same product demo sequence.
- Same CTA language.
- Overused claims.
- Audience saturation risk.
- Safe ways to create novelty without abandoning the winning message.

Motion already emphasizes live-account pattern analysis and creative tagging.[8] SignalForge can differentiate by combining historical similarity with **pre-launch audience response and counterfactual novelty testing**.

### 10. Live Outcome Calibration

Users can import or manually enter:

- Impressions.
- Three-second views.
- Completion rate.
- Average watch time.
- Saves.
- Shares.
- Comments.
- Profile visits.
- Click-through rate.
- Leads.
- Trial activation.
- Purchases.
- Revenue.
- Spend.
- Cost per result.
- ROAS.

The system records whether its prediction was correct, whether it ranked the winner correctly, and where it was uncertain. It should calculate relative-winner accuracy separately from absolute-performance accuracy.

The platform must be honest: synthetic research requires validation and can fail on cultural nuance, emotional reasoning, subgroup behavior, and novel situations.[11] The product should display a **calibration card**, not hide those weaknesses.

### 11. Human Validation Escalation

When the model sees high disagreement, novelty, sensitive claims, or high commercial stakes, it should recommend a small real-user test. The platform can initially support manual recruitment and CSV upload rather than paying for a panel provider.

The workflow is:

> Simulation screen → uncertainty check → human validation recommendation → result comparison → model update.

This turns synthetic feedback into a responsible research accelerator rather than pretending it replaces people.

### 12. Creative agents

Use Guildly’s best concept without building Guildly:

| Agent | Job |
|---|---|
| **Audience Strategist** | Defines segments, awareness stages, motivations, and objections |
| **Creative Analyst** | Understands the asset and creates the Creative Twin |
| **Journey Simulator** | Runs the structured persona decision sequence |
| **Creative Director** | Turns evidence into prioritized edits |
| **Variant Generator** | Creates targeted alternatives |
| **Brand Guardian** | Checks tone, claims, safety, and compliance |
| **Experiment Manager** | Designs the next test and tracks hypotheses |
| **Outcome Analyst** | Compares predictions with live results |
| **Research Librarian** | Maintains evidence, sources, and brand memory |

These agents should operate through one shared project state, not as disconnected chatbots. Every agent output should be structured, versioned, and inspectable.

### 13. Agency and team mode

Support multiple workspaces, client separation, roles, approvals, comments, report exports, and white-label branding. Agencies are especially attractive because one account can generate repeated usage across clients.

### 14. Explainable reports

Generate a report containing:

- Executive decision.
- Winning variant by objective.
- Best variant by audience segment.
- Timeline weaknesses.
- Top objections.
- Recommended changes.
- Generated alternatives.
- Model and persona details.
- Confidence and disagreement.
- Evidence provenance.
- Validation status.
- Recommended next experiment.

Reports should be exportable as Markdown, PDF later, and shareable through a public read-only link.

### 15. Public benchmark layer

After sufficient consented data exists, publish anonymized benchmarks such as:

- Which hook structures work best by category.
- Which claims create skepticism.
- Which CTA types perform by funnel stage.
- How audience awareness changes creative preference.
- How prediction accuracy varies by category.

This can become a content-led acquisition engine and eventually a proprietary category dataset. Do not use customer data for benchmarks without explicit consent and anonymization.

## Controlled multi-agent orchestration

SignalForge should use multi-agent orchestration, but it must not become a swarm of competing chatbots that produce contradictory or invented answers. The product should operate as a **Creative Intelligence Council**: specialized agents work from the same bounded project state and shared Evidence Ledger, while one Orchestrator coordinates dependencies, questions, approvals, and the final decision.

> **Agents may propose, challenge, and synthesize. The Evidence Layer decides what can be presented as fact. The user approves consequential decisions.**

### Shared context and agent contracts

Agents must not rely on loose conversational memory. Every analysis run should receive a versioned **Decision Packet** that contains the Brand Codex, target objective, supported platforms, audience definition, imported Creative Twin, source set, evidence freshness, known unknowns, user constraints, and the required output schema.

Every agent output must be returned as a structured `Agent Finding`, not free-form prose alone. An Agent Finding includes the finding, evidence class, source references, source timestamps, assumptions, confidence, disagreement, unknowns, recommended next action, model identifier, prompt version, and processing timestamp. The system must reject an output that makes a factual or numeric claim without a matching evidence record.

| Agent | Primary responsibility | May produce | Must not do |
|---|---|---|---|
| **Orchestrator** | Creates the work plan, routes tasks, resolves dependencies, requests approvals, and compiles the final decision | Task graph, question plan, final recommendation with provenance | Override evidence rules or execute external side effects without user approval |
| **Discovery Agent** | Learns the minimum viable project context from the user | Clarifying questions, information-gap map, onboarding summary | Re-ask answered questions or collect unnecessary sensitive data |
| **Brand Guardian** | Applies Brand Brain, approved claims, tone, and compliance rules | Brand-fit findings, claim flags, approval requests | Invent product facts or silently rewrite brand policy |
| **Creative Analyst** | Builds the Creative Twin from supplied assets | Scene, hook, proof, CTA, and creative-feature analysis | Infer unavailable video/audio details as observed facts |
| **Audience Strategist** | Defines segments, awareness stages, jobs-to-be-done, objections, and hypotheses | Audience panel specification and simulation assumptions | Claim representativeness without validation |
| **Journey Simulator** | Simulates structured audience responses across the creative journey | Directional segment comparison, disagreement, and uncertainty | Present simulated reactions as real human responses |
| **Trend Researcher** | Collects and normalizes approved-source trend evidence | Cited trend briefs, source coverage, stale-data warnings | Bypass access controls, scrape private data, or cite unverified summaries |
| **Publishing Engineer** | Recommends test windows and distribution-readiness steps | Evidence-backed timing experiment and platform-fit checklist | Claim private algorithm access, exact reach, or literal scroll-time data without source support |
| **Creative Director** | Turns validated weaknesses into prioritized creative guidance | Edit brief, creative structure, variant rationale | Generate generic suggestions disconnected from an identified weakness |
| **Mutation Engineer** | Produces controlled alternatives with a change log | Hook, CTA, proof, first-frame, and structure variants | Change multiple variables without declaring them or publish automatically |
| **Experiment Manager** | Maintains hypotheses, variants, approvals, and decision history | Test plan, approval gates, next-experiment recommendation | Hide negative results or overwrite historic evidence |
| **Outcome Analyst** | Ingests observed results and calibrates predictions | Accuracy report, divergence analysis, recalibration proposal | Treat incomplete exports as a full measurement record |
| **Evidence Arbiter** | Enforces citation, recency, conflict, and metric rules | Pass, downgrade, block, or insufficient-evidence verdict | Generate marketing copy or suppress material evidence gaps |

### Orchestration topology

The Orchestrator should use a dependency graph, not an uncontrolled chain of prompts. Independent tasks such as creative extraction, source-quality checks, and audience-panel construction may run in parallel. Dependent tasks must wait for their required evidence. The Evidence Arbiter runs before any user-facing recommendation, and the Orchestrator cannot mark a conclusion “ready” until the evidence contract passes.

For important or high-uncertainty decisions, SignalForge should use deliberate challenge rather than fake consensus. The Creative Analyst, Audience Strategist, and Publishing Engineer may each produce an independent view. The Evidence Arbiter compares their claims, sources, and assumptions. If disagreement remains material, the final output must state the disagreement and either propose a discriminating experiment or request human validation.

### Adaptive user discovery: ask only what materially improves the decision

SignalForge may ask the user any **necessary** question, but the questioning experience must feel like expert discovery—not an exhausting form. The Discovery Agent should first inspect available Brand Brain data, connected sources, previous experiments, imported assets, and known constraints. It then asks only questions whose answers are likely to change the recommendation, evidence quality, risk level, or next experiment.

The initial conversation should normally remain within five high-information questions. It must use progressive disclosure, provide a reason for each question, offer sensible “I do not know yet” options, remember answers, and avoid re-asking anything already captured in the Brand Codex or Decision Packet.

| Information gap | Example adaptive question | Why it matters |
|---|---|---|
| Objective ambiguity | “Is this upload optimized for follower growth, qualified leads, sales, community response, or watch time?” | The success metric and creative recommendation differ materially |
| Audience ambiguity | “Who must this content move first: cold viewers, existing followers, buyers evaluating alternatives, or current customers?” | Determines the simulated journey, objections, and best proof type |
| Platform ambiguity | “Where will this asset run first, and is it organic, paid, or both?” | Controls format rules, available data, and publishing-window logic |
| Evidence gap | “Can you connect account analytics or upload a recent CSV export? If not, we will use low-confidence public priors only.” | Prevents invented account-specific timing or performance claims |
| Brand-risk gap | “Which claims require evidence, legal review, or must never be used?” | Enables compliance-aware recommendations and approval gates |
| Decision gap | “What decision must you make after this analysis: choose a variant, rewrite the hook, select a test window, or decide not to publish?” | Keeps the analysis tied to an action |

The user must remain in control. Agents may request data and explain the expected benefit, but users must be able to skip a question, restrict a source, change a workspace rule, or require human approval before any external connection, content publication, account action, or retention of sensitive material.

### Agent resilience, fallback, and fail-closed recovery

Yes—SignalForge must have **different agents for different jobs**, and it must have a deliberately designed fallback path for every important task. A fallback agent is not simply “ask the same model again.” Repeating the same model with the same vague prompt can reproduce the same error or hallucination. Instead, fallbacks must use a different role, a different validation method, an independent model/provider where available, or a non-LLM deterministic check.

The default rule is **fail closed**: if an agent errors, returns malformed output, lacks evidence, conflicts with another agent, or reaches a low-confidence conclusion, SignalForge must not quietly fill the gap with polished prose. It should recover in a bounded way, downgrade the claim, return a facts-only view, or ask for human validation.

| Failure or risk state | Primary response | Fallback path | User-visible result |
|---|---|---|---|
| **Transient provider error, timeout, or rate limit** | Retry only with exponential backoff and an idempotency key | Route the same typed task to a pre-approved alternate provider/model; preserve the same Decision Packet | “Recovered using fallback model” with run metadata, or “analysis delayed” if the fallback fails |
| **Malformed JSON or schema failure** | Run deterministic schema validation and reject the output | Use a constrained Repair Agent that may repair structure but may not introduce new facts; rerun only if the original evidence set is preserved | Structured validation error or repaired output labeled with the repair step |
| **Missing citation or unsupported claim** | Evidence Arbiter blocks the claim | Source Retrieval Agent searches only approved sources; if no source is found, remove the claim and retain the unknown | “Insufficient evidence—source required,” never a substituted number or fact |
| **Suspected hallucination** | Compare each factual claim to the Evidence Ledger and source excerpts | Independent Claim Verifier reviews the claim from the original evidence only; a second model/provider may critique, not overwrite, the first answer | Blocked finding, facts-only output, or human-review request |
| **Agent disagreement** | Calculate disagreement at the claim and recommendation level | Run a Debate Resolver that identifies the smallest discriminating test or data request; do not force consensus | Both views, their evidence, and the recommended resolving experiment |
| **Conflicting sources** | Preserve source conflict with timestamps and authority metadata | Source Quality Agent ranks recency, directness, source type, and scope; recommends which conflict requires human choice | “Sources conflict” state with no unqualified conclusion |
| **Stale or incomplete source coverage** | Freshness rules downgrade confidence | Refresh approved source, request a new export, or run a historical-only analysis | Stale-data banner with last verified timestamp and missing coverage |
| **Creative extraction uncertainty** | Mark fields as unknown rather than observed | Ask the user for transcript, original file, higher-quality asset, or manual scene correction | Partial Creative Twin with a clear request for the missing artifact |
| **Unsafe, policy-sensitive, or brand-boundary issue** | Brand Guardian pauses downstream generation | Compliance Reviewer and human approval queue evaluate the proposed claim or creative | Approval required; no auto-publish or automatic claim rewrite |
| **External side effect** | The Orchestrator creates a proposed action only | Human review and explicit confirmation are mandatory before publishing, connecting an account, spending, sending, or deleting | Pending approval state with a reversible action preview |

#### Fallback matrix by specialized agent

| Primary agent | First fallback | Independent verifier / non-LLM gate | Final safe outcome if unresolved |
|---|---|---|---|
| **Creative Analyst** | Asset Recovery Agent requests missing transcript/frame/metadata or re-extracts from the original asset | Field-level provenance and confidence validation | Partial Creative Twin; no fabricated scene or timing data |
| **Audience Strategist** | User Discovery Agent asks a single high-impact audience question | Brand Codex completeness check | Broad, low-confidence audience hypothesis or “audience definition required” |
| **Journey Simulator** | Alternate provider/model runs the same bounded persona packet | Evidence Arbiter checks that simulation language remains directional | Human-validation recommendation; no pseudo-human certainty |
| **Trend Researcher** | Source Retrieval Agent searches approved source registry and manual imports | Citation, recency, duplicate-source, and source-policy validators | “No verified trend signal available” |
| **Publishing Engineer** | Timing Analyst rebuilds the recommendation using only owned historical data | Metric-source checker and platform-specific availability rules | Multiple low-confidence test windows or “connect analytics / upload export” |
| **Creative Director** | Rules-based edit mapper translates validated diagnoses into a minimal edit brief | Link each recommendation to a Timeline Doctor finding | Diagnosis-only report without ungrounded creative advice |
| **Mutation Engineer** | Template-based controlled-variant generator | Change-log validator ensures variables and claim boundaries are preserved | Manual brief for a human creator instead of automated variants |
| **Outcome Analyst** | CSV/field reconciliation workflow requests missing metrics | Canonical metric dictionary, source completeness, and anomaly checks | Partial calibration report with no false accuracy claim |
| **Orchestrator** | Workflow Recovery Controller resumes only from the last persisted safe state | Task dependency checks, idempotency keys, and approval-state validation | Paused project with a clear recovery checklist |

#### The recovery protocol

Every agent task must follow this bounded protocol:

1. **Validate input.** Confirm that the Decision Packet, source permissions, task schema, and required evidence are present.
2. **Run the specialist.** Save the raw structured output separately from any user-facing synthesis.
3. **Validate output.** Check schema, citations, numeric provenance, freshness, scope, brand rules, and source conflicts.
4. **Classify the failure.** Mark it as transient, structural, evidence-related, disagreement-related, source-related, or policy-sensitive.
5. **Select one appropriate fallback.** Use an alternate model/provider, retrieval-only fallback, deterministic validator, or user question—not a blind loop.
6. **Run an independent verification gate.** The verifier works from the original evidence set and cannot inherit unsupported claims from the first agent.
7. **Degrade safely.** If unresolved, remove the unsupported conclusion, return a facts-only or partial result, and surface the exact gap.
8. **Escalate.** Request human validation or an explicit decision when the missing evidence materially changes the outcome or an external action is proposed.
9. **Learn from the incident.** Persist the failure class, agent/model version, fallback path, source set, and final outcome so the system can improve routing without silently hiding errors.

Retries must be bounded. The system should use one automatic retry for transient failures, one structurally constrained repair attempt for schema failures, and at most one alternate-provider attempt for inference failures before returning a safe degraded state. It must never loop indefinitely, multiply cost without a user-visible reason, or make an action more authoritative merely because it was generated repeatedly.

#### Quality gates before a recommendation appears

No recommendation should be displayed as “ready” until it passes the following gates:

| Gate | Required check | Fails closed when |
|---|---|---|
| **Schema gate** | Typed fields, accepted enums, valid confidence range, and declared assumptions | Required structure is absent or malformed |
| **Evidence gate** | Every factual/numeric claim maps to a source or user-provided field | A citation is missing, non-matching, stale, or outside source scope |
| **Metric gate** | Measured metrics have a canonical definition, value, time window, unit, source, and import status | The system attempts to infer, estimate, or combine incompatible metrics silently |
| **Conflict gate** | Material source or agent disagreements are retained and explained | The system has no justified resolution or discriminating test |
| **Brand and policy gate** | Claims, tone, disclosures, and approval rules comply with the Brand Codex | A prohibited, unsupported, regulated, or unapproved statement appears |
| **Action gate** | Any publish, connection, spend, message, delete, or data-retention event requires an explicit approval state | The action lacks human confirmation or a reversible preview |

#### Human escalation and agent health

Human escalation is not a sign that the system failed; it is a feature of a trustworthy decision platform. SignalForge must request human validation when evidence is incomplete, a decision has material commercial or compliance impact, sources conflict, agent disagreement exceeds a configured threshold, data freshness has expired, or an agent asks for a consequence-changing assumption.

The workspace should include an **Agent Health and Evidence Console**. It should show each task’s agent, model/provider, input version, source count, task status, retries, fallback used, validation verdict, residual uncertainty, latency, and human approval requirement. Users should be able to inspect and retry a failed task manually, swap to an approved BYOK model when configured, or disable a problematic connector. They should never have to guess whether an attractive report came from direct data, simulation, a fallback model, or an error-recovery path.

## Canonical end-to-end workflow

SignalForge should make its intelligence visible as a deliberate workflow. The product’s dashboard should show where a project is, what evidence is available, what is blocked, and what decision is waiting for a human.

| Stage | System action | User experience | Evidence and approval rule |
|---:|---|---|---|
| **1. Establish the workspace** | Create workspace, roles, Brand Brain, Brand Codex, and source policy | A cinematic onboarding brief that asks only the highest-value questions | User approves brand rules and source permissions |
| **2. Connect or import evidence** | Connect authorized accounts or import scripts, assets, links, CSVs, RSS/news, and research | A source map with status, scopes, freshness, coverage, and gaps | No source is treated as active until verified; manual imports remain clearly labeled |
| **3. Build the Decision Packet** | Select goal, audience, platform, creative assets, constraints, and decision needed | A concise “what we know / need / cannot verify” review screen | User can correct assumptions before any agent work begins |
| **4. Build the Creative Twin** | Extract structured creative, claim, proof, scene, CTA, and metadata features | A rich asset timeline with confidence and unavailable-field states | Extraction must not become an observed fact until its source is traceable |
| **5. Research the current context** | Collect approved trend, competitor, category, and platform evidence | A cited Trend Intelligence brief with freshness and coverage indicators | Uncited or stale sources are downgraded or blocked |
| **6. Simulate the audience journey** | Run the structured panel across scroll, comprehension, trust, relevance, objections, action, and recall | A segment-aware journey map with disagreement and uncertainty | Simulation remains visibly distinct from observed human research |
| **7. Diagnose and decide** | Evaluate Decision Matrix, Timeline Doctor, claim safety, novelty, and distribution readiness | A ranked recommendation, evidence dossier, and decision explanation | Evidence Arbiter blocks unsupported numbers and claims |
| **8. Design controlled alternatives** | Generate mutations from a diagnosed weakness or explicit hypothesis | Side-by-side diffs showing exactly what changed and why | Variants must preserve change logs and same-audience retests |
| **9. Plan publication** | Produce platform-specific upload-window experiments, captions, metadata, and measurement plan | A publishing calendar with several evidence-based test windows | User approves before any connected publication action |
| **10. Measure actual outcomes** | Ingest owned metrics via authorized integrations or CSVs | Prediction-versus-outcome view with completeness and measurement caveats | Observed outcomes are immutable audit records |
| **11. Calibrate and learn** | Compare prediction with outcome, update account-specific priors, identify next learning opportunity | A transparent calibration report and next-experiment proposal | The system explains changed recommendations and retains historical versions |
| **12. Refresh and alert** | Refresh approved feeds on a durable schedule and evaluate alert thresholds | Stale-data badges, source health, trend spikes, divergence alerts, and approval queues | Refreshes are idempotent, rate-limited, source-scoped, and auditable |

## Canonical free-first technology stack

This is the recommended technology stack for a SignalForge implementation developed in Antigravity IDE. It is designed for a sophisticated public product and a limited free beta. It does **not** imply that unlimited multi-agent inference, video processing, data acquisition, or public-scale operation can remain free forever.

| Layer | Recommended technology | Purpose and implementation rule |
|---|---|---|
| **Development environment** | Antigravity IDE with the included context-resilient knowledge pack; Sonnet thinking, Gemini Flash High, Gemini Pro, or another approved coding model as task-appropriate | Use durable Markdown contracts and repository state for continuity; keep application runtime independent of any development model |
| **Frontend** | React 19, Vite, TypeScript, Tailwind CSS 4, shadcn/ui, Framer Motion | Build a cinematic responsive interface with a stable design system and ReactBits-compatible integration zones |
| **Visualization** | Recharts, SVG/canvas primitives, React Flow where useful | Render timelines, confidence bands, source graphs, opportunity maps, experiment DAGs, and calibration views without fake live data |
| **Component integration** | ReactBits components imported behind dedicated wrapper components | Preserve accessibility, motion preferences, performance budgets, and visual consistency when adding future visual modules |
| **Authentication and database** | Supabase Auth, PostgreSQL, Row Level Security, `pgvector`, SQL migrations | Isolate tenants, store Brand Codex versions, evidence, agent findings, experiments, outcomes, and audit history |
| **File storage** | Supabase Storage or another S3-compatible store with signed URLs | Keep raw creative files private; store only file metadata and derived features in the database; apply retention rules |
| **Web hosting** | Cloudflare Pages | Host the public marketing site and static React application on a free-first edge platform |
| **API and policy gateway** | Cloudflare Workers with TypeScript and Zod | Enforce auth, quotas, schema validation, source policy, rate limits, signed uploads, and server-side model-key handling; do not use it for heavy media workloads |
| **Workflow state** | PostgreSQL job tables and explicit state machines | Model agent tasks, dependencies, retries, approvals, source health, and audit events durably; never rely on in-memory agent state |
| **Durable scheduled work** | Managed scheduler/cron appropriate to the deployed platform | Refresh approved sources, calculate stale states, and issue alerts; use durable, authenticated, idempotent jobs—not `setInterval` or process-local cron |
| **Agent orchestrator** | Custom TypeScript task-graph orchestrator with typed Zod contracts | Keep orchestration inspectable and bounded; start custom rather than adding a heavy framework before the workflow is stable |
| **Evidence retrieval** | `pgvector` plus metadata filters and source-scoped retrieval | Retrieve only approved, current evidence for an agent run; always return provenance and source timestamps |
| **LLM gateway** | Server-side provider adapter for Groq, Gemini Developer API, and user-supplied BYOK providers | Route structured tasks to the best available approved model; validate JSON; persist model and prompt versions; never expose shared keys to the client |
| **Local/open-source model option** | Ollama for development; Transformers.js, ONNX Runtime Web, and WebGPU for browser-side lightweight tasks | Offer privacy-preserving experiments and basic on-device classification or embeddings when a hosted model is not required |
| **Speech and visual preprocessing** | WebCodecs, HTML5 video APIs, canvas, Tesseract.js, MediaPipe Tasks, and client-side feature extraction | Process short clips and frames progressively in the browser; keep server-side heavy video work out of the initial free beta |
| **Trend and research ingestion** | RSS parser, approved news sources, official platform APIs, user links, compliant exports, and manual CSV imports | Prioritize authorized or public sources; preserve original URLs, timestamps, source status, and terms-aware collection policy |
| **Platform connectors** | Meta/Instagram Business surfaces, YouTube Data/Analytics, TikTok Business/creator surfaces, and other official APIs after approval | Ingest only user-authorized data; use clear disconnected, incomplete, rate-limited, and manual-import states |
| **Data quality** | Zod schemas, canonical metric definitions, source freshness rules, conflict detection, and Evidence Arbiter | Block unsupported factual/numeric claims; return insufficient-evidence states rather than plausible prose |
| **Notifications** | In-app notification center, browser notifications, and an optional email provider once current free-tier terms are verified | Deliver deduplicated, threshold-based, evidence-linked alerts with user-configurable preferences |
| **Observability** | Structured JSON logs, error tracking, job audit tables, model-run telemetry, and source-health monitors | Trace every finding from evidence through agent and model version to the final decision |
| **Testing** | Vitest, Playwright, schema fixtures based only on permitted non-customer data, accessibility checks, and visual regression screenshots | Test source policy, tenant isolation, evidence gating, scoring, task transitions, user approvals, and responsive visual quality |
| **Source control and delivery** | GitHub, conventional commits, pull requests, environment separation, encrypted secrets | Keep prompts, schemas, and policy changes versioned; never commit credentials or customer assets |

### Minimum viable data model for orchestration

The existing data model should be extended with `decision_packets`, `agent_runs`, `agent_findings`, `evidence_items`, `evidence_claim_links`, `source_connections`, `source_refresh_runs`, `source_health`, `user_questions`, `user_answers`, `workflow_tasks`, `workflow_dependencies`, `approval_requests`, `publishing_window_tests`, `publishing_recommendations`, `notification_rules`, `notification_events`, and `model_policy_versions`.

The crucial rule is that every final recommendation must be traceable through this chain:

> **Recommendation → Agent Finding → Decision Packet → Evidence Item / user-provided input → source or import metadata.**

## Free integrations and services

The goal is to make the product **free to build and free to operate at small beta scale**, not to promise unlimited public usage forever.

| Capability | Free-first option | Role in SignalForge | Main constraint |
|---|---|---|---|
| Database/auth | Supabase Free | Users, workspaces, tests, results, brand rules, model versions | 500 MB database, 1 GB storage, 5 GB egress, two active projects; free projects may pause after inactivity[12] |
| Frontend | Cloudflare Pages | Static React application | Keep heavy processing out of frontend hosting |
| Lightweight API | Cloudflare Workers Free | Request validation, quota checks, model proxy, Supabase writes | 100,000 requests/day and 10 ms CPU per invocation[13] |
| Primary text model | Groq Free | Structured persona evaluations, summaries, rewrite generation | Organization-level RPM/TPM/TPD limits; batch and cache aggressively[14] |
| Multimodal fallback | Gemini Developer API Free tier | Short image/video/transcript analysis for non-sensitive beta data | Limited free access; Google’s pricing page says free tier includes free input/output tokens and content may be used to improve products, so disclose this and do not use confidential client media without consent[15] |
| Local model fallback | Transformers.js + ONNX Runtime Web + WebGPU | Browser-side embeddings, classification, basic visual checks | Device performance varies; models are limited |
| Local development inference | Ollama | Run open models locally during development or private demos | Requires the user’s own machine resources; not a public hosted backend |
| Speech-to-text | Groq Whisper Free, browser transcription, or local whisper.cpp | Generate transcripts for short clips | Audio quotas and browser/device limitations |
| OCR | Tesseract.js or browser OCR | Extract captions and on-screen text | Accuracy depends on resolution and typography |
| Video metadata | HTML5 video APIs, WebCodecs, ffprobe locally | Duration, frame sampling, dimensions, timing | Avoid server-side FFmpeg initially |
| Image analysis | Browser canvas, OpenCV.js, local models, Gemini Free for small beta | Contrast, text density, layout, product visibility | Client-device limits and model quotas |
| Object/face detection | MediaPipe Tasks or ONNX models in browser | Basic scene and subject cues | Do not claim emotion detection as ground truth |
| Source control | GitHub Free | Repository, issues, releases, versioned prompts | Keep secrets out of the repository |
| Public research data | User uploads, permitted public datasets, official APIs | Benchmarking and model research | Respect platform terms, copyright, privacy, and robots rules |
| Campaign import | CSV upload first | Live-outcome calibration | Manual data entry initially |
| Later platform connectors | Meta Ads/Instagram official APIs, YouTube Analytics/Data API, TikTok Business APIs if approved | Outcome ingestion and publishing | Permissions, review, quotas, and platform-policy changes |
| Notifications | Email links, Supabase email, browser notifications | Job completion and reports | Avoid paid email providers at first |
| Analytics | Supabase event tables or a free analytics tier after checking terms | Activation, retention, test usage | Do not send sensitive creative content to third parties unnecessarily |

## Free-tier architecture

### Frontend

Use **React + Vite + TypeScript**, Tailwind, and a component library. Deploy the static build to Cloudflare Pages. The application should be a polished dashboard with:

- Project switcher.
- Brand Brain setup.
- Audience Builder.
- Creative upload and variant comparison.
- Timeline Doctor.
- Audience Matrix.
- Counterfactual Lab.
- Mutation queue.
- Experiment history.
- Calibration dashboard.
- Report export.

### Data model

Use Supabase Postgres with Row Level Security. The core tables should be:

- `profiles`
- `workspaces`
- `workspace_members`
- `brands`
- `brand_rules`
- `audiences`
- `audience_segments`
- `personas`
- `creative_assets`
- `creative_features`
- `creative_variants`
- `experiments`
- `experiment_hypotheses`
- `simulation_runs`
- `persona_responses`
- `prediction_scores`
- `diagnoses`
- `mutations`
- `human_validation_runs`
- `campaign_outcomes`
- `calibration_metrics`
- `model_versions`
- `evidence_sources`
- `audit_events`

Use JSONB for flexible structured outputs, but promote frequently queried fields into typed columns. Store prompt versions and model IDs with every prediction.

### AI request pattern

Do not make 100 independent model calls. Use this pattern:

1. Extract or accept structured creative features.
2. Build a compact audience and objective context.
3. Select a small stratified persona panel.
4. Send one batched structured request where possible.
5. Validate the JSON schema.
6. Store each persona result.
7. Aggregate scores deterministically.
8. Calculate disagreement and uncertainty.
9. Ask a model to explain the measured findings.
10. Generate only targeted mutations.
11. Retest the mutations using the same panel.

The LLM should not invent the final score. The application should compute the score from structured observations and preserve the raw evidence.

### Media pipeline

For the free MVP, avoid a server-side media pipeline. Let users provide a transcript and one poster frame. Then add short, low-resolution uploads processed in the browser using Web APIs, WebCodecs, canvas, Tesseract.js, and local or quota-limited transcription.

If server-side media processing becomes necessary, keep it an opt-in beta feature using a local development worker or a temporary free environment. Do not design the business around free GPU hosting. Hugging Face Spaces’ free options are suitable for static demos and limited ZeroGPU experiments, not dependable production GPU infrastructure.[16]

## Security and trust requirements

Even a free beta needs professional boundaries:

- Use Row Level Security on every tenant-owned table.
- Never expose shared model API keys in frontend code.
- Use short-lived signed asset URLs.
- Delete raw videos after processing unless the user explicitly saves them.
- Keep derived transcripts and features separate from raw uploads.
- Allow workspace deletion and data export.
- Log model version, prompt version, and evidence source.
- Disclose that synthetic personas are simulations.
- Do not infer sensitive personal traits from uploaded videos.
- Do not claim facial emotion recognition is ground truth.
- Do not scrape private accounts, bypass rate limits, or automate user accounts without permission.
- Use official platform APIs for campaign data when possible.
- Add a visible “insufficient evidence” state.

## What not to promise

Do not promise:

- Exact Instagram reach.
- Guaranteed virality.
- Exact revenue prediction.
- Real human equivalence.
- Psychological diagnosis.
- Accurate emotion measurement from a face alone.
- That simulated audiences replace research panels.
- That a high score means an ad will perform in every market.

The strongest positioning is credible:

> **“Screen more creative ideas, understand audience reactions earlier, and make better experiments before committing production or media budget.”**

## Antigravity IDE build workflow

Use Antigravity IDE as a disciplined engineering workspace, not as an unstructured code generator. Attach the canonical blueprint and add the accompanying Antigravity knowledge pack to the repository. Every model session must read the compact master instruction, context protocol, current build state, and relevant ticket before modifying code. The project documentation—not temporary model memory—must preserve decisions and progress.

### Model-routing and build sequence

1. **Durable project memory:** Create the blueprint index, product constitution, architecture, decision log, build state, and testable TODO list in the repository.
2. **Architecture and security:** Use the strongest available reasoning model for schema design, RLS/authorization, API boundaries, evidence contracts, job states, source policy, model routing, and recovery logic.
3. **Design system:** Establish a high-quality cinematic design system, ReactBits-compatible wrapper zones, dashboards, timelines, reports, empty states, loading states, accessibility, and reduced-motion behavior.
4. **Core MVP:** Build the text-first three-variant comparison flow with honest empty/disconnected/insufficient-evidence states.
5. **Structured AI:** Add schema-validated persona responses, deterministic aggregation, evidence gating, and model/prompt versioning.
6. **Brand Brain:** Add workspace memory, brand rules, claim approvals, and audit history.
7. **Counterfactuals and mutations:** Add controlled variable changes, delta explanations, targeted generation, change logs, and automatic same-audience retesting.
8. **Trend and Publishing Intelligence:** Add compliant sources, citations, source health, timing experiments, and platform-readiness analysis without private-algorithm claims.
9. **Calibration:** Add campaign CSV import, outcomes, prediction-versus-outcome accuracy, and next-experiment recommendations.
10. **Hardening:** Use an independent review pass for authorization, source-policy enforcement, prompt injection, data deletion, fallback behavior, quotas, mobile responsiveness, accessibility, and visual quality.

Make small, testable changes. After each ticket, run relevant tests, update the durable build state and decision log, record limitations honestly, and leave a compact handoff for the next model. Keep the repository in GitHub from day one.

## Build order

| Stage | Deliverable | Free feasibility | Success signal |
|---|---|---:|---|
| **0** | Landing page, demo report, and waitlist | Very high | People understand the value without explanation |
| **1** | Three text/script variants versus a small audience panel | Very high | Users prefer the comparison over generic ChatGPT advice |
| **2** | Brand Brain and audience segments | High | Recommendations become brand-specific and reusable |
| **3** | First-frame/image analysis | High | Users catch visual problems before editing videos |
| **4** | Counterfactual Lab | High | Users run multiple controlled experiments instead of asking for one score |
| **5** | Mutation and retesting loop | Medium | Users repeatedly generate, test, and select variants |
| **6** | Short-video and transcript support | Medium | Users trust timeline diagnosis on real assets |
| **7** | CSV outcome calibration | High | Prediction accuracy and ranking accuracy become measurable |
| **8** | Human-validation escalation | Medium | High-uncertainty tests lead to real evidence |
| **9** | Agency/team workspaces | High | Multiple projects and clients can use the same system |
| **10** | Official campaign integrations | Medium/low | Users can connect real performance data without manual imports |

## The version that would impress the market

The strongest demo is not a score card. It is an end-to-end story:

1. Upload three product-demo variants.
2. Select “cold SaaS buyers” and “trial activation” as the target.
3. See that Variant A wins attention but loses trust, while Variant B wins comprehension and Variant C wins purchase intent.
4. Click the timeline and see the exact moment where Variant A makes an unsupported claim.
5. Ask the system to generate a proof-first alternative.
6. Watch it generate three targeted mutations.
7. Run those mutations through the same audience journey.
8. See Variant B2 become the recommended version for cold traffic.
9. Export the creative brief and experiment hypothesis.
10. Later upload the actual campaign CSV.
11. See which prediction was correct and how the audience model recalibrated.

That is a product companies can imagine using repeatedly. It demonstrates intelligence, action, transparency, and learning.

## Final strategic position

The product should be described as:

> **The operating system for creative decisions.**

The wedge is product-demo and paid-social video testing. The expansion is creative intelligence across the full customer journey. The moat is the calibrated graph connecting brands, audiences, creative features, simulated responses, human validation, and real outcomes.

The final product is **more ambitious than Viralyst**, uses Guildly’s best workflow ideas, and avoids building Guildly’s broad infrastructure burden. It does not try to win through the number of personas. It wins through:

- Better decision quality.
- Better explanations.
- Better controlled experiments.
- Better brand memory.
- Better outcome calibration.
- Better evidence discipline.
- Better transition from insight to the next piece of creative.

That is the product most likely to impress serious companies rather than only impress people during a one-time AI demo.

## References

[1]: https://www.anthropic.com/claude/fable "Claude Fable — Anthropic"

[2]: https://getminds.ai/blog/ai-ad-creative-testing-tools-2026 "Ad & Creative Testing Platforms: 16 Tools Compared — Minds"

[3]: https://www.electrictwin.com/ "Electric Twin — Synthetic Audiences for Enterprise Research"

[4]: https://aaru.com/ "Aaru — Behavior simulation at the scale of the real world"

[5]: https://www.syntheticusers.com/ "Synthetic Users — User research at the speed of AI"

[6]: https://www.brandmaven.ai/product/audience-testing "Brandmaven — Synthetic Audience Testing"

[7]: https://trypencil.com/the-platform "Pencil — The Platform"

[8]: https://motionapp.com/ "Motion — Creative Analytics"

[9]: https://about.instagram.com/blog/announcements/instagram-ranking-explained "Instagram Ranking Explained — Instagram"

[10]: https://transparency.meta.com/features/explaining-ranking/ig-feed-recommendations/ "Instagram Feed Recommendations — Meta Transparency Center"

[11]: https://www.pymc-labs.com/blog-posts/synthetic-consumers-a-practical-guide "Synthetic Consumers & AI Market Research — PyMC Labs"

[12]: https://supabase.com/pricing "Pricing & Fees — Supabase"

[13]: https://developers.cloudflare.com/workers/platform/limits/ "Limits — Cloudflare Workers"

[14]: https://console.groq.com/docs/rate-limits "Rate Limits — GroqDocs"

[15]: https://ai.google.dev/gemini-api/docs/pricing "Gemini Developer API Pricing — Google AI for Developers"

[16]: https://huggingface.co/docs/hub/spaces-overview "Spaces Overview — Hugging Face"

[17]: https://help.instagram.com/788388387972460/ "About Instagram Insights — Instagram Help Center"

[18]: https://www.tiktok.com/creator-academy/en/article/analytics-tool-video-performance "Using analytics as a tool to improve video performance — TikTok Creator Academy"

[19]: https://support.google.com/youtubecreatorstudio/answer/9314416?hl=en "Understand your YouTube audience — YouTube Studio Help"
