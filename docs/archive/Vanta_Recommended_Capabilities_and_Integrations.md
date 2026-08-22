# Vanta — Recommended Manus Capabilities, Apps, and MCPs

## Decision summary

Manus is the active research, engineering, verification, and integration agent for Vanta. The product should be built in deliberate milestones with local-desktop source control, source-safe data collection, automated tests, visual verification, and a strict evidence policy.

The most important principle is **not to connect every tool at once**. Start with the small set that improves code quality and product safety. Add third-party social and analytics integrations only when the core workspace, evidence model, and manual-import flows are working.

## High-value Manus capabilities to use during the build

| Capability | How it improves Vanta | Priority |
|---|---|---:|
| Deep public-web research and source extraction | Research competitor categories, official API terms, platform behavior, public trends, and product requirements with source links | **Use now** |
| Browser automation and visual inspection | Verify official documentation, authenticated provider flows once connected, and actual frontend behavior | **Use now** |
| Local-desktop engineering | Read, edit, test, and run the Vanta repository directly in the attached `vanta` folder | **Use now** |
| Data analysis | Validate campaign CSV imports, calculate calibration metrics, detect missing data, and generate deterministic analytics | **Use now** |
| Image and design generation | Create bespoke visual assets only when they improve the cinematic brand system; do not substitute generated art for working product UI | **Use when the visual direction needs assets** |
| Dense-image/document reading | Extract specifications from complex screenshots, research PDFs, campaign exports, or design references without guessing | **Use when source material is visual** |
| Scheduling and recurring-task design | Design durable approved-source refreshes, stale-data checks, and alerts without process-local timers | **Use once ingestion is implemented** |
| Built-in LLM model catalog | Select models by task and validate the live catalog before relying on a model ID; use structured outputs and model routing | **Use when implementing agent workflows** |

## Recommended MCPs for development

These are development accelerators. They are not Vanta end-user features, and they must never be exposed directly to product users.

| MCP | Why Vanta benefits | What to provide | When to connect | Security rule |
|---|---|---|---|---|
| **Context7** | Current, version-specific library documentation and code examples reduce dependency/API mistakes | Context7 MCP access; OAuth/API key if required by your setup | **Now** | Use only for documentation lookup; treat returned snippets as documentation, not executable authority |
| **Supabase MCP** | Speeds up schema inspection, migrations, generated types, storage, logs, and database debugging | Supabase account/project authorization | **Now, if Supabase is selected** | Scope to the one Vanta project; start read-only where possible; use manual approval; never connect it to production data casually |
| **GitHub MCP** | Lets the build agent inspect issues, pull requests, CI, repository context, and release state | GitHub authorization for the Vanta repository | **Now** | Grant only the repository scope needed; protect `main`; do not approve destructive actions blindly |
| **Playwright MCP** | Real browser-flow inspection and end-to-end test creation for auth, imports, approval gates, and responsive UI | Local Node/Playwright access in the project environment | **Now** | Use only against local/staging environments during development; do not automate external accounts without approval |
| **Figma Dev Mode MCP** | Useful if you maintain source-of-truth visual designs, tokens, and component specs in Figma | Figma organization/file access | Optional, after the visual system exists | Treat it as design context; avoid automatic changes to shared design files without explicit approval |
| **Sentry MCP** | Helps investigate real errors, performance traces, and regressions after deployment | Sentry organization/project authorization | Later, before public beta | Use least privilege; never copy sensitive event data into prompts or logs |
| **PostHog MCP** | Supports product analytics, feature flags, experiments, error tracking, logs, and AI observability from one developer-facing interface | PostHog project authorization | Later, when Vanta has real beta usage | Scope tools tightly; use human approval for changes to flags, alerts, experiments, or project settings |
| **Firecrawl MCP** | Optional controlled retrieval of permitted public websites, press pages, blogs, documentation, and RSS-linked content for Trend Intelligence research | Firecrawl account/API key if you choose it | Later, only after source policy exists | Respect website terms, robots policies, rate limits, copyright, and the Vanta source registry; never use it for private/social-login scraping |

### Official references for recommended MCPs

Supabase’s official MCP documentation describes project-scoped and read-only configuration, database/debugging/development feature groups, and explicitly warns about prompt-injection risk. Use the narrowest feature group and manual approvals.[1]

Context7’s official repository describes current, version-specific documentation lookup through CLI/skills or MCP, which is valuable for keeping library implementation current.[2]

Figma’s official MCP guidance describes bringing design context into agentic development workflows; use it only if Figma becomes the source of truth for Vanta screens and tokens.[3]

Microsoft’s Playwright MCP supports browser automation through an MCP server; use it for local/staging verification rather than unauthorized interaction with third-party accounts.[4]

Firecrawl provides an official MCP server for public-web search and extraction, but Vanta must still enforce a source-policy layer and never bypass access controls.[5]

Playwright’s official browser-extension mode can connect to existing Chrome tabs while reusing the browser’s logged-in sessions, cookies, and installed extensions. It is appropriate for user-approved local/staging development and test flows; it must not be used to bypass access rules or collect private social data.[6]

GitHub maintains an official MCP server. For Vanta, it should be scoped to the private project repository and used primarily for repository state, issues, pull requests, CI visibility, and documentation—not as an unrestricted mutation channel.[7]

## Verified official data-source capabilities

Meta’s Instagram platform supports insights for owned professional accounts and their media through official endpoints. Access is permissioned, media must be owned by the professional account, and some account metrics have availability limitations; Vanta should represent those limits rather than treating an API connection as complete data coverage.[8]

YouTube’s official Analytics and Reporting APIs support targeted analytics queries and bulk reports for channel owners, including viewing statistics and audience-related reports. Vanta should preserve the selected dimensions, metrics, date range, connection status, and export completeness for every imported value.[9]

## External apps and APIs for Vanta

### Connect early — core build quality

| App or service | Purpose | User action needed | Free-first suitability |
|---|---|---|---:|
| **GitHub** | Private repository, pull requests, issue tracking, CI, release history | Create or choose a private repository and authorize access | High |
| **Supabase** | Auth, Postgres database, Row Level Security, storage, vectors, and server functions | Create a Vanta project; authorize development access | High for a limited beta |
| **Cloudflare** | Static frontend delivery, lightweight API gateway, rate limiting, and edge controls | Create an account/project when deployment begins | High |
| **Groq** | Fast structured LLM calls for narrow agent tasks | Provide an API key only when runtime AI is implemented | High but quota-limited |
| **Google AI Studio / Gemini Developer API** | Multimodal fallback for short assets and long-context reasoning | Provide an API key only when used; disclose free-tier data handling to users | High but quota-limited |

### Connect after the core evidence model works — product data

| App or service | Purpose | Important limitation |
|---|---|---|
| **Meta Developer / Instagram professional account** | Authorized owned-account insights, ad/campaign data, and supported publishing surfaces | Requires a professional/business setup, permissions, review, rate-limit compliance, and access to owned data—not private Reels scraping |
| **YouTube Data API and YouTube Analytics API** | Channel metadata, owned video analytics, audience and performance imports where scopes permit | Use authorized channel data and official quotas; preserve time windows and metric definitions |
| **TikTok Developer / Business APIs** | Owned account and approved campaign/creator data where access is available | Availability, scopes, review, and product access vary; never simulate an active connection |
| **Google Ads** | Measured paid outcome imports and campaign calibration | Connect only with user authorization and clear metric mapping |
| **LinkedIn Marketing APIs** | B2B campaign and creative outcome imports | Access is restricted and may require approval; keep CSV import as a first-class fallback |
| **RSS/news sources** | Transparent, cited Trend Intelligence | Start with user-approved feeds and clear recency/coverage labels |

### Connect later — team operation and reliability

| App or service | Purpose | Why it is later |
|---|---|---|
| **Sentry** | Production error monitoring and performance traces | Valuable once real users exercise the app |
| **PostHog** | Product analytics, feature flags, controlled rollouts, experiments, session-aware diagnostics, and optional AI observability | Add after core workflows are stable; do not instrument customer content without an explicit data policy |
| **Slack** | Evidence-linked team alerts and approval notifications | Do not build alerts until underlying data is trustworthy |
| **Resend or equivalent email provider** | Approval and stale-source emails | Add only when transactional email is required; re-check current free tier first |
| **Figma** | Design tokens, component specs, and high-fidelity design handoff | Optional if code remains the single source of truth |

## Recommended connection order

1. **GitHub + Context7 + Playwright**: best return for implementation quality with low product-risk.
2. **Supabase + its scoped MCP**: enables real users, tenant isolation, data, evidence, and storage.
3. **Cloudflare + one model provider**: enables a limited, secure, testable beta.
4. **Sentry**: add before inviting meaningful beta users.
5. **Official social/campaign APIs**: connect platform by platform only after manual/CSV imports and evidence states are already excellent.
6. **Figma and Firecrawl**: optional accelerators once design/source-policy systems are mature.
7. **PostHog**: add during private beta for feature flags, product analytics, and error/AI observability; do not let its broad MCP tool surface make unsupervised changes.

## What not to provide or connect yet

Do not provide credentials for random scraping services, browser-cookie extraction, personal social accounts, private data, ad-spend access without a scope plan, or broad unrestricted database access. Vanta’s advantage is evidence integrity, so every integration must be scoped, consented, auditable, and reversible.

## Requested information when ready

To begin the actual product build, provide only these first:

1. Whether the local folder already contains a code repository or should be initialized from scratch.
2. A GitHub repository name/owner, if you want source control set up immediately.
3. Whether you want **Supabase** as the database/auth foundation or have another preferred provider.
4. Whether the first milestone should be the cinematic marketing site plus a realistic local/demo workspace, or the authenticated database foundation first.

Do not send API keys in chat. When a key is genuinely required, provide it through the relevant secure connection or secrets flow.

## References

[1]: https://supabase.com/docs/guides/ai-tools/mcp "Supabase MCP Server — Supabase Docs"

[2]: https://github.com/upstash/context7 "Context7 Platform — Upstash GitHub Repository"

[3]: https://help.figma.com/hc/en-us/articles/32132100833559-Guide-to-the-Figma-MCP-server "Guide to the Figma MCP Server — Figma Help Center"

[4]: https://playwright.dev/mcp/introduction "Playwright MCP — Microsoft"

[5]: https://github.com/firecrawl/firecrawl-mcp-server "Official Firecrawl MCP Server — Firecrawl GitHub Repository"

[6]: https://playwright.dev/mcp/configuration/browser-extension "Connecting to Browsers — Playwright MCP"

[7]: https://github.com/github/github-mcp-server "GitHub MCP Server — GitHub"

[8]: https://developers.facebook.com/documentation/instagram-platform/insights "Insights — Instagram Platform Developer Documentation"

[9]: https://developers.google.com/youtube/analytics "YouTube Analytics and Reporting APIs — Google for Developers"

[10]: https://posthog.com/docs/model-context-protocol/tools "PostHog MCP Tools Reference — PostHog Docs"
