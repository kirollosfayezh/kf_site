import { afterEach, describe, expect, it } from "vitest";
import type { SiteSettings } from "../../services/api-types.ts";
import { identityFromSettings } from "../contact.ts";
import { primeDict } from "../dict/index.ts";
import { articlePageSeo } from "./cms.ts";
import { PAGES } from "./pages.ts";
import { SITE, resetSiteIdentity, setSiteIdentity } from "./site.ts";
import { seoTags, tagsToHtml, type SeoTag } from "./tags.ts";
import { fitTitle } from "./text.ts";

const ORIGIN = "https://kf.test";
const links = (tags: SeoTag[], rel: string) =>
  tags.flatMap((t) => (t.kind === "link" && t.rel === rel ? [t] : []));
const meta = (tags: SeoTag[], key: string) =>
  tags.find((t): t is Extract<SeoTag, { kind: "meta" }> => t.kind === "meta" && t.key === key)?.content;
const jsonld = (tags: SeoTag[]) =>
  tags.flatMap((t) => (t.kind === "jsonld" ? [t.data as Record<string, unknown>] : []));
// JSON-LD is read by path in these assertions; `any` keeps them short.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = Record<string, any>;
const node = (tags: SeoTag[], type: string): Node =>
  jsonld(tags).find((d) => [d["@type"]].flat().includes(type)) as Node;
const ARABIC_ALIAS = "كي إف تك";

afterEach(resetSiteIdentity);

describe("seoTags", () => {
  it("gives the not-found page no canonical (its /404 path is itself a 404)", () => {
    const tags = seoTags(PAGES.notFound, "en", ORIGIN);
    expect(links(tags, "canonical")).toEqual([]);
    expect(meta(tags, "robots")).toBe("noindex,follow");
    expect(links(seoTags(PAGES.home, "en", ORIGIN), "canonical")).toHaveLength(1);
  });

  it("omits everything that needs an absolute origin when none is configured", () => {
    const tags = seoTags(PAGES.services, "en", "");
    expect(links(tags, "canonical")).toHaveLength(0);
    expect(jsonld(tags)).toHaveLength(0);
    // ...but the origin-independent tags still ship.
    expect(tags[0]).toEqual({ kind: "title", text: fitTitle(PAGES.services.title) });
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

  it("emits the organisation, website, page and breadcrumb graph on an inner page", () => {
    const types = jsonld(seoTags(PAGES.about, "en", ORIGIN)).map((d) => d["@type"]);
    expect(types).toEqual([["Organization", "LocalBusiness"], "WebSite", ["AboutPage", "ProfilePage"], "BreadcrumbList"]);
  });

  it("makes /about a profile of the founder, about the company", () => {
    const page = node(seoTags(PAGES.about, "en", ORIGIN), "AboutPage");
    expect(page.mainEntity["@id"]).toBe(`${ORIGIN}/about#founder`);
    // Inlined, not referenced: Google's ProfilePage check reads the name here.
    expect(page.mainEntity.name).toBe(SITE.founder);
    expect(page.about["@id"]).toBe(`${ORIGIN}/#organization`);
  });

  it("keys each page's WebPage node by its own language URL and links its breadcrumb", () => {
    const tags = seoTags(PAGES.services, "ar", ORIGIN);
    const page = node(tags, "CollectionPage");
    expect(page["@id"]).toBe(`${ORIGIN}/ar/services`);
    expect(page.inLanguage).toBe("ar");
    expect(page.isPartOf).toEqual({ "@id": `${ORIGIN}/#website` });
    expect(page.breadcrumb["@id"]).toBe(node(tags, "BreadcrumbList")["@id"]);
    expect(node(seoTags(PAGES.contact, "en", ORIGIN), "ContactPage")).toBeTruthy();
  });

  it("gives the not-found page and the private quote shell no WebPage node", () => {
    for (const page of [PAGES.notFound, PAGES.quote]) {
      const types = jsonld(seoTags(page, "en", ORIGIN)).map((d) => d["@type"]);
      expect(types).toEqual([["Organization", "LocalBusiness"], "WebSite"]);
    }
  });

  it("names every alias on the Organization, but an Arabic site name only on Arabic pages", () => {
    for (const lang of ["en", "ar", "de", "fr"] as const) {
      const tags = seoTags(PAGES.home, lang, ORIGIN);
      expect(node(tags, "Organization").alternateName).toContain(ARABIC_ALIAS);
      expect(node(tags, "Organization").alternateName).toContain("KFTech Solutions");
      expect(node(tags, "WebSite").alternateName.includes(ARABIC_ALIAS)).toBe(lang === "ar");
    }
  });

  it("states the company's size, industry and brand name in machine-readable form", () => {
    const tags = seoTags(PAGES.home, "en", ORIGIN);
    const org = node(tags, "Organization");
    expect(org.numberOfEmployees).toEqual({ "@type": "QuantitativeValue", minValue: 2, maxValue: 9 });
    expect(org.foundingDate).toBe("2020");
    expect(org.description).toBe(SITE.description);
    expect(org).not.toHaveProperty("legalName");
    expect(org).not.toHaveProperty("aggregateRating");
    expect(meta(tags, "application-name")).toBe("KF Tech Solutions");
  });

  it("translates the Organization description on a translated page", () => {
    primeDict("ar", { [SITE.description]: "KF Tech Solutions استوديو برمجيات مستقل في القاهرة." });
    expect(node(seoTags(PAGES.home, "ar", ORIGIN), "Organization").description).toBe(
      "KF Tech Solutions استوديو برمجيات مستقل في القاهرة.",
    );
  });

  it("lists directory profiles after the social ones", () => {
    setSiteIdentity({ profiles: ["https://clutch.co/profile/x"] });
    const sameAs = node(seoTags(PAGES.home, "en", ORIGIN), "Organization").sameAs as string[];
    expect(sameAs.at(-1)).toBe("https://clutch.co/profile/x");
    expect(sameAs.slice(0, SITE.sameAs.length)).toEqual([...SITE.sameAs]);
  });

  it("carries the brand facts an editor set in the dashboard", () => {
    const settings = {
      contact: {},
      social: { linkedin: "https://www.linkedin.com/company/kf-x/" },
      brand: {
        alternateNames: { en: ["KFT"], ar: ["كيه إف"], de: [], fr: [] },
        foundingDate: "2019",
        founderProfiles: ["https://github.com/someone"],
        profiles: ["https://clutch.co/profile/kf"],
        notAffiliatedWith: [{ name: "Other KF", url: "https://other-kf.test" }],
      },
    } as unknown as SiteSettings;
    setSiteIdentity(identityFromSettings(settings));
    const tags = seoTags(PAGES.about, "en", ORIGIN);
    const org = node(tags, "Organization");
    expect(org.alternateName).toEqual(["KFT", "كيه إف"]);
    expect(org.foundingDate).toBe("2019");
    expect(org.sameAs).toEqual(["https://www.linkedin.com/company/kf-x/", "https://clutch.co/profile/kf"]);
    expect(org.disambiguatingDescription).toContain("not affiliated with Other KF (other-kf.test)");
    expect(org.founder.sameAs).toEqual(["https://github.com/someone"]);
    expect(node(tags, "AboutPage").mainEntity.sameAs).toEqual(["https://github.com/someone"]);
    // An empty language keeps nothing of its own: the Latin aliases only.
    expect(node(tags, "WebSite").alternateName).toEqual(["KFT"]);
  });

  it("adds a BlogPosting for an article", () => {
    const post = articlePageSeo(
      { slug: "pos-guide", title: { en: "Choosing a POS" }, body: { en: "Body text." }, createdAt: "2026-01-02T00:00:00Z" },
      "en",
    );
    const article = jsonld(seoTags(post, "en", ORIGIN)).find((d) => d["@type"] === "BlogPosting");
    expect(article).toMatchObject({ headline: "Choosing a POS", url: `${ORIGIN}/blog/pos-guide`, datePublished: "2026-01-02T00:00:00Z" });
    // The author is the founder's node, by id, without the company's profiles.
    expect(article?.author).toEqual({ "@type": "Person", "@id": `${ORIGIN}/about#founder`, name: "Kirollos Fayez", url: `${ORIGIN}/about` });
    // mainEntityOfPage now resolves to a node on the same page.
    const page = node(seoTags(post, "en", ORIGIN), "ItemPage");
    expect((article!.mainEntityOfPage as { "@id": string })["@id"]).toBe(page["@id"]);
  });

  it("claims the language an untranslated article is actually served in", () => {
    const post = articlePageSeo({ slug: "pos-guide", title: { en: "Choosing a POS" }, body: { en: "Body." } }, "de");
    const tags = seoTags(post, "de", ORIGIN);
    expect(node(tags, "BlogPosting").inLanguage).toBe("en");
    expect(node(tags, "ItemPage").inLanguage).toBe("en");
  });

  it("keeps the founder and the company as separate, linked entities", () => {
    const org = jsonld(seoTags(PAGES.home, "en", ORIGIN))[0];
    const founder = org.founder as Record<string, unknown>;
    expect(founder["@id"]).toBe(`${ORIGIN}/about#founder`);
    expect(founder.worksFor).toEqual({ "@id": `${ORIGIN}/#organization` });
    const companyProfiles = org.sameAs as string[];
    expect((founder.sameAs as string[]).some((u) => companyProfiles.includes(u))).toBe(false);
    expect(org.disambiguatingDescription).toMatch(/not affiliated with KFTECH Software Solutions \(kftechsols\.com\)/);
  });

  it("points every indexable page at its Markdown twin, in the canonical's language", () => {
    const twin = (tags: SeoTag[]) => links(tags, "alternate").filter((l) => l.type === "text/markdown").map((l) => l.href);
    expect(twin(seoTags(PAGES.home, "en", ORIGIN))).toEqual([`${ORIGIN}/index.md`]);
    expect(twin(seoTags(PAGES.home, "ar", ORIGIN))).toEqual([`${ORIGIN}/ar/index.md`]);
    expect(twin(seoTags(PAGES.services, "de", ORIGIN))).toEqual([`${ORIGIN}/de/services.md`]);
    // An untranslated post canonicalises to English, so its twin does too.
    const post = articlePageSeo({ slug: "x", title: { en: "X" }, body: { en: "Body" } }, "de");
    expect(twin(seoTags(post, "de", ORIGIN))).toEqual([`${ORIGIN}/blog/x.md`]);
    for (const page of [PAGES.campaign, PAGES.notFound, PAGES.quote]) expect(twin(seoTags(page, "en", ORIGIN))).toEqual([]);
    expect(twin(seoTags(PAGES.about, "en", ""))).toEqual([]);
    expect(tagsToHtml(seoTags(PAGES.about, "en", ORIGIN))).toContain(
      `<link rel="alternate" href="${ORIGIN}/about.md" type="text/markdown" data-kf-seo="1" />`,
    );
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
