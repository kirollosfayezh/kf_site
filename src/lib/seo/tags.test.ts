import { describe, expect, it } from "vitest";
import { articlePageSeo } from "./cms.ts";
import { PAGES } from "./pages.ts";
import { seoTags, tagsToHtml, type SeoTag } from "./tags.ts";

const ORIGIN = "https://kf.test";
const links = (tags: SeoTag[], rel: string) =>
  tags.flatMap((t) => (t.kind === "link" && t.rel === rel ? [t] : []));
const meta = (tags: SeoTag[], key: string) =>
  tags.find((t): t is Extract<SeoTag, { kind: "meta" }> => t.kind === "meta" && t.key === key)?.content;
const jsonld = (tags: SeoTag[]) =>
  tags.flatMap((t) => (t.kind === "jsonld" ? [t.data as Record<string, unknown>] : []));

describe("seoTags", () => {
  it("omits everything that needs an absolute origin when none is configured", () => {
    const tags = seoTags(PAGES.services, "en", "");
    expect(links(tags, "canonical")).toHaveLength(0);
    expect(jsonld(tags)).toHaveLength(0);
    // ...but the origin-independent tags still ship.
    expect(tags[0]).toEqual({ kind: "title", text: PAGES.services.title.replace(/ \| KF Tech Solutions$/, "") });
    expect(meta(tags, "description")).toBe(PAGES.services.desc);
  });

  it("canonicalises each language to its own URL", () => {
    expect(links(seoTags(PAGES.services, "ar", ORIGIN), "canonical")[0].href).toBe(`${ORIGIN}/ar/services`);
    expect(links(seoTags(PAGES.services, "en", ORIGIN), "canonical")[0].href).toBe(`${ORIGIN}/services`);
  });

  it("limits hreflang to the languages the site serves", () => {
    const tags = seoTags(PAGES.about, "en", ORIGIN, { siteLangs: ["en", "ar"] });
    const alternates = links(tags, "alternate").filter((l) => l.hreflang);
    expect(alternates.map((a) => a.hreflang)).toEqual(["en", "ar", "x-default"]);
    expect(tags.filter((t) => t.kind === "meta" && t.key === "og:locale:alternate")).toHaveLength(1);
  });

  it("canonicalises a language the page does not exist in to the English URL", () => {
    const page = { ...PAGES.about, langs: ["en" as const] };
    const tags = seoTags(page, "de", ORIGIN);
    expect(links(tags, "canonical")[0].href).toBe(`${ORIGIN}/about`);
    // A cluster of one advertises nothing.
    expect(links(tags, "alternate").filter((l) => l.hreflang)).toHaveLength(0);
  });

  it("marks noindex pages and leaves them out of the hreflang cluster", () => {
    const tags = seoTags(PAGES.campaign, "en", ORIGIN);
    expect(meta(tags, "robots")).toBe("noindex,follow");
    expect(links(tags, "alternate").filter((l) => l.hreflang)).toHaveLength(0);
  });

  it("links the language's RSS feed from the blog index", () => {
    const feeds = links(seoTags(PAGES.blog, "fr", ORIGIN), "alternate").filter((l) => l.type === "application/rss+xml");
    expect(feeds.map((f) => f.href)).toEqual([`${ORIGIN}/fr/feed.xml`, `${ORIGIN}/feed.xml`]);
  });

  it("emits the organisation, website and breadcrumb graph on an inner page", () => {
    const types = jsonld(seoTags(PAGES.about, "en", ORIGIN)).map((d) => d["@type"]);
    expect(types).toEqual([["Organization", "LocalBusiness"], "WebSite", "BreadcrumbList"]);
  });

  it("adds a BlogPosting for an article", () => {
    const post = articlePageSeo(
      { slug: "pos-guide", title: { en: "Choosing a POS" }, body: { en: "Body text." }, createdAt: "2026-01-02T00:00:00Z" },
      "en",
    );
    const article = jsonld(seoTags(post, "en", ORIGIN)).find((d) => d["@type"] === "BlogPosting");
    expect(article).toMatchObject({ headline: "Choosing a POS", url: `${ORIGIN}/blog/pos-guide`, datePublished: "2026-01-02T00:00:00Z" });
  });
});

describe("tagsToHtml", () => {
  it("escapes attribute values", () => {
    const html = tagsToHtml([{ kind: "meta", attr: "name", key: "description", content: 'Fish & "chips" <b>' }]);
    expect(html).toBe('<meta name="description" content="Fish &amp; &quot;chips&quot; &lt;b&gt;" data-kf-seo="1" />');
  });

  it("cannot be broken out of by a </script> inside JSON-LD", () => {
    const html = tagsToHtml([{ kind: "jsonld", data: { name: "</script><script>alert(1)</script>" } }]);
    expect(html).not.toContain("</script><script>");
    expect(JSON.parse(html.replace(/^<script[^>]*>/, "").replace(/<\/script>$/, ""))).toEqual({
      name: "</script><script>alert(1)</script>",
    });
  });

  it("renders optional link attributes only when present", () => {
    expect(tagsToHtml([{ kind: "link", rel: "canonical", href: "https://kf.test/" }])).toBe(
      '<link rel="canonical" href="https://kf.test/" data-kf-seo="1" />',
    );
  });
});
