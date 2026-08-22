/**
 * Connector provider catalog (pure). Declares what each authorized source
 * could unlock and which scopes that needs. Nothing here implies a provider
 * is reachable: the OAuth flow for every provider is a deferred live step
 * (review item F-1), and the UI must say so.
 */

export type ProviderId = "meta" | "google" | "youtube" | "tiktok" | "linkedin" | "x" | "rss";

export interface ProviderSpec {
  id: ProviderId;
  label: string;
  /** Scopes the analytics capability needs; names are provider-neutral until OAuth apps are registered. */
  analyticsScopes: string[];
  /** Evidence the connection can produce, stated as capability not promise. */
  unlocks: string[];
  /** Whether a consent flow exists in this build. */
  consentFlow: "oauth_pending_registration" | "none_required";
  /** Data Vanta will never request or infer from this provider. */
  neverCollects: string[];
}

export const PROVIDERS: readonly ProviderSpec[] = [
  { id: "meta", label: "Meta (Facebook, Instagram)", analyticsScopes: ["owned_post_insights", "owned_ad_insights"], unlocks: ["Observed reach and engagement for posts you own", "Observed ad delivery and spend"], consentFlow: "oauth_pending_registration", neverCollects: ["Other accounts' private metrics", "Ranking algorithm internals"] },
  { id: "google", label: "Google Ads", analyticsScopes: ["owned_ad_insights"], unlocks: ["Observed ad delivery, spend, and conversions you track"], consentFlow: "oauth_pending_registration", neverCollects: ["Search ranking signals", "Competitor account data"] },
  { id: "youtube", label: "YouTube", analyticsScopes: ["owned_channel_analytics"], unlocks: ["Observed views and retention on your own videos"], consentFlow: "oauth_pending_registration", neverCollects: ["Recommendation algorithm internals"] },
  { id: "tiktok", label: "TikTok", analyticsScopes: ["owned_video_insights"], unlocks: ["Observed views and completion on your own videos"], consentFlow: "oauth_pending_registration", neverCollects: ["For You feed ranking", "Unowned account metrics"] },
  { id: "linkedin", label: "LinkedIn", analyticsScopes: ["owned_page_analytics"], unlocks: ["Observed impressions and engagement on pages you administer"], consentFlow: "oauth_pending_registration", neverCollects: ["Member profile data beyond aggregate analytics"] },
  { id: "x", label: "X", analyticsScopes: ["owned_post_metrics"], unlocks: ["Observed impressions on your own posts"], consentFlow: "oauth_pending_registration", neverCollects: ["Timeline ranking internals"] },
  { id: "rss", label: "Public RSS or Atom feed", analyticsScopes: [], unlocks: ["Sourced claims from public articles, with citation and fetch time"], consentFlow: "none_required", neverCollects: ["Performance metrics (feeds carry none)"] }
];

export function providerSpec(id: string): ProviderSpec | null {
  return PROVIDERS.find((p) => p.id === id) ?? null;
}

/** Providers whose data could feed outcome calibration or test-window planning. */
export function analyticsProviders(): ProviderSpec[] {
  return PROVIDERS.filter((p) => p.analyticsScopes.length > 0);
}
