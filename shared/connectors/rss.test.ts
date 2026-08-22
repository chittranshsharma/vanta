import { describe, expect, it } from "vitest";
import { isPermittedFeedUrl, parseFeed } from "./rss";

const rss = `<?xml version="1.0"?><rss version="2.0"><channel><title>Example Blog</title>
<item><title>Post &amp; One</title><link>https://example.com/1</link><pubDate>Mon, 03 Mar 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Hello <b>world</b></p>]]></description><guid>g1</guid></item>
<item><title>No date</title><link>https://example.com/2</link><description>x</description></item>
<item><title>Bad date</title><link>https://example.com/3</link><pubDate>yesterday</pubDate></item>
<item><description>orphan</description></item>
</channel></rss>`;

const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom Feed</title>
<entry><title>Entry A</title><link href="https://example.com/a"/><published>2026-03-04T12:00:00Z</published><summary>Sum</summary><id>urn:a</id></entry>
</feed>`;

describe("parseFeed", () => {
  it("parses RSS items with decoded entities and stripped HTML", () => {
    const f = parseFeed(rss);
    expect(f.format).toBe("rss");
    expect(f.title).toBe("Example Blog");
    expect(f.items[0]).toEqual({
      title: "Post & One",
      link: "https://example.com/1",
      published_at: "2026-03-03T10:00:00.000Z",
      summary: "Hello world",
      guid: "g1",
    });
  });

  it("keeps missing or unparseable dates as null and warns", () => {
    const f = parseFeed(rss);
    expect(f.items[1].published_at).toBeNull();
    expect(f.items[2].published_at).toBeNull();
    expect(f.warnings.some((w) => w.includes("unparseable date"))).toBe(true);
  });

  it("skips items without title or link", () => {
    const f = parseFeed(rss);
    expect(f.items).toHaveLength(3);
    expect(f.warnings).toContain("item without title or link skipped");
  });

  it("parses Atom entries with href links", () => {
    const f = parseFeed(atom);
    expect(f.format).toBe("atom");
    expect(f.items[0].link).toBe("https://example.com/a");
    expect(f.items[0].published_at).toBe("2026-03-04T12:00:00.000Z");
    expect(f.items[0].guid).toBe("urn:a");
  });

  it("rejects non-feed documents", () => {
    expect(parseFeed("<html><body>nope</body></html>").format).toBe("unknown");
  });

  it("drops non-http links", () => {
    const f = parseFeed(`<rss><channel><item><title>t</title><link>javascript:alert(1)</link></item></channel></rss>`);
    expect(f.items[0].link).toBeNull();
  });
});

describe("isPermittedFeedUrl", () => {
  it("allows https public hosts only", () => {
    expect(isPermittedFeedUrl("https://example.com/feed.xml")).toBe(true);
    expect(isPermittedFeedUrl("http://example.com/feed.xml")).toBe(false);
    expect(isPermittedFeedUrl("https://localhost/feed")).toBe(false);
    expect(isPermittedFeedUrl("https://10.0.0.1/feed")).toBe(false);
    expect(isPermittedFeedUrl("https://user:pw@example.com/feed")).toBe(false);
    expect(isPermittedFeedUrl("https://db.internal/feed")).toBe(false);
    expect(isPermittedFeedUrl("not a url")).toBe(false);
  });
});
