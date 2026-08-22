/**
 * RSS / Atom parsing (Upgrade F): the one permitted public-source type that
 * needs no account. Pure, regex-based, tolerant of either format. Returns
 * typed items with the fields a `sourced_claim` evidence row needs:
 * title, link, published date, and a bounded summary. Never fabricates a
 * date: missing dates stay null.
 */

export interface FeedItem {
  title: string;
  link: string | null;
  published_at: string | null;
  summary: string | null;
  guid: string;
}

export interface ParsedFeed {
  format: "rss" | "atom" | "unknown";
  title: string | null;
  items: FeedItem[];
  warnings: string[];
}

const MAX_ITEMS = 100;
const MAX_SUMMARY = 1000;

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : null;
}

function attr(block: string, name: string, attrName: string): string | null {
  const m = block.match(new RegExp(`<${name}\\b[^>]*\\b${attrName}="([^"]*)"`, "i"));
  return m ? decode(m[1]) : null;
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function isoDate(raw: string | null): string | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString();
}

export function parseFeed(xml: string): ParsedFeed {
  const warnings: string[] = [];
  const isAtom = /<feed[\s>]/i.test(xml) && /<entry[\s>]/i.test(xml);
  const isRss = /<rss[\s>]|<channel[\s>]/i.test(xml);
  if (!isAtom && !isRss) return { format: "unknown", title: null, items: [], warnings: ["not an RSS or Atom document"] };

  const blocks = isAtom ? xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ?? [] : xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  if (blocks.length > MAX_ITEMS) warnings.push(`feed has ${blocks.length} items; first ${MAX_ITEMS} kept`);

  const items: FeedItem[] = [];
  for (const block of blocks.slice(0, MAX_ITEMS)) {
    const title = tag(block, "title") ?? "";
    const link = isAtom ? attr(block, "link", "href") ?? tag(block, "link") : tag(block, "link");
    const published = isAtom
      ? tag(block, "published") ?? tag(block, "updated")
      : tag(block, "pubDate") ?? tag(block, "dc:date");
    const summaryRaw = isAtom ? tag(block, "summary") ?? tag(block, "content") : tag(block, "description") ?? tag(block, "content:encoded");
    const guid = isAtom ? tag(block, "id") : tag(block, "guid");
    if (!title && !link) {
      warnings.push("item without title or link skipped");
      continue;
    }
    const publishedIso = isoDate(published);
    if (published && !publishedIso) warnings.push(`unparseable date "${published.slice(0, 40)}" kept as null`);
    items.push({
      title: title || "(untitled)",
      link: link && /^https?:\/\//i.test(link) ? link : null,
      published_at: publishedIso,
      summary: summaryRaw ? summaryRaw.slice(0, MAX_SUMMARY) : null,
      guid: guid || link || title,
    });
  }

  const feedTitle = isAtom ? tag(xml.split(/<entry[\s>]/i)[0], "title") : tag(xml.split(/<item[\s>]/i)[0], "title");
  return { format: isAtom ? "atom" : "rss", title: feedTitle, items, warnings };
}

/** Hosts a feed refresh may contact. Anything else is refused: no scraping of arbitrary pages. */
export function isPermittedFeedUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (u.username || u.password) return false;
    const host = u.hostname;
    if (host === "localhost" || /^(\d+\.){3}\d+$/.test(host) || host.endsWith(".local") || host.endsWith(".internal")) return false;
    return true;
  } catch {
    return false;
  }
}
