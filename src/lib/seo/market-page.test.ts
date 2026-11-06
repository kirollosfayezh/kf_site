import { describe, expect, it } from "vitest";
import { extractFaq } from "../faq.ts";
import { marketCard, marketLangs, marketLinks, marketPageSeo, isMarketSlug } from "./market-page.ts";
import { PAGES, pageForPath } from "./pages.ts";
import { seoTags, type SeoTag } from "./tags.ts";
import type { ArticleLike } from "./types.ts";

const ORIGIN = "https://kf.test";
// JSON-LD is read by path in these assertions; `any` keeps them short.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Node = Record<string, any>;
const jsonld = (tags: SeoTag[]) => tags.flatMap((t) => (t.kind === "jsonld" ? [t.data as Node] : []));
const hreflangs = (tags: SeoTag[]) =>
  tags.flatMap((t) => (t.kind === "link" && t.rel === "alternate" && t.hreflang ? [t.hreflang] : []));

/** Placeholder copy — the real pages live in kf_backend `scripts/markets/`. */
function market(over: Partial<ArticleLike> = {}): ArticleLike {
  return {
    id: "m1",
    slug: "saudi-arabia",
    published: true,
    title: { en: "Placeholder heading", ar: "عنوان تجريبي", de: "Platzhalter", fr: "" },
    summary: { en: "Placeholder intro.", ar: "مقدمة تجريبية." },
    body: {
      en: "Intro.\n\n## Common questions\n\n### Do you work remotely?\n\nYes.",
      ar: "مقدمة.\n\n## أسئلة شائعة\n\n### هل تعملون عن بعد؟\n\nنعم.",
      de: "Ein Text, den jemand im Dashboard eingetippt hat.",
    },
    meta: {
      seoTitle: { en: "Placeholder title | KF Tech", ar: "عنوان تجريبي | KF Tech", de: "Platzhalter | KF Tech" },
      seoDescription: { en: "Placeholder description for the page.", ar: "وصف تجريبي للصفحة." },
    },
    updatedAt: "2026-11-06T10:00:00.000Z",
    ...over,
  };
}

describe("marketLangs", () => {
  it("is English and Arabic only, never a German or French text typed into the dashboard", () => {
    expect(marketLangs(market())).toEqual(["en", "ar"]);
  });

  it("drops Arabic until both its heading and body are written", () => {
    expect(marketLangs(market({ body: { en: "Body." } }))).toEqual(["en"]);
    expect(marketLangs(market({ title: { en: "Heading" } }))).toEqual(["en"]);
  });

  it("drops Arabic when the site has it switched off", () => {
    expect(marketLangs(market(), ["en", "de"])).toEqual(["en"]);
  });
});

describe("marketPageSeo", () => {
  it("lives at the root, takes the SEO fields per language and carries its FAQ", () => {
    const item = market();
    const faq = extractFaq(item.body!.ar!);
    const page = marketPageSeo(item, "ar", undefined, faq);
    expect(page.path).toBe("/saudi-arabia");
    expect(page.title).toBe("عنوان تجريبي | KF Tech");
    expect(page.desc).toBe("وصف تجريبي للصفحة.");
    expect(page.kind).toBe("market");
    expect(page.langs).toEqual(["en", "ar"]);
    expect(page.faq).toEqual([{ q: "هل تعملون عن بعد؟", a: "نعم." }]);
  });

  it("serves English on a language the page is not written in", () => {
    const page = marketPageSeo(market(), "de");
    expect(page.title).toBe("Placeholder title | KF Tech");
    expect(page.desc).toBe("Placeholder description for the page.");
    expect(page.crumb).toBe("Saudi Arabia");
  });

  it("falls back to the heading and summary when the SEO fields are blank", () => {
    const page = marketPageSeo(market({ meta: {} }), "en");
    expect(page.title).toBe("Placeholder heading | KF Tech Solutions");
    expect(page.desc).toBe("Placeholder intro.");
  });
});

describe("a market page's tags", () => {
  it("names en, ar and x-default only, and its WebPage is about the Organization", () => {
    const item = market();
    const tags = seoTags(marketPageSeo(item, "en", undefined, extractFaq(item.body!.en!)), "en", ORIGIN);
    expect(hreflangs(tags).sort()).toEqual(["ar", "en", "x-default"]);
    const graph = jsonld(tags);
    const page = graph.find((n) => n["@id"] === `${ORIGIN}/saudi-arabia`)!;
    expect(page["@type"]).toBe("WebPage");
    expect(page.about).toEqual({ "@id": `${ORIGIN}/#organization` });
    expect(page.breadcrumb).toEqual({ "@id": `${ORIGIN}/saudi-arabia#breadcrumb` });
    const types = graph.map((n) => n["@type"]).flat();
    expect(types).toContain("FAQPage");
    expect(types).toContain("BreadcrumbList");
    // No Service or Place node of its own: Organization, WebSite, WebPage,
    // breadcrumb and FAQ.
    expect(types).not.toContain("Service");
    expect(types).not.toContain("Place");
  });

  it("canonicalises a German visit to the English URL", () => {
    const tags = seoTags(marketPageSeo(market(), "de"), "de", ORIGIN);
    const canonical = tags.find((t) => t.kind === "link" && t.rel === "canonical");
    expect(canonical).toMatchObject({ href: `${ORIGIN}/saudi-arabia` });
    expect(hreflangs(tags)).not.toContain("de");
  });
});

describe("marketLinks", () => {
  const cards = [marketCard(market()), marketCard(market({ id: "m2", slug: "uae", body: { en: "Body." } }))];

  it("lists the published markets in their fixed order, translated only where written", () => {
    expect(marketLinks(cards, "ar")).toEqual([
      { slug: "saudi-arabia", name: "Saudi Arabia", path: "/saudi-arabia", translated: true },
      { slug: "uae", name: "UAE", path: "/uae", translated: false },
    ]);
    expect(marketLinks(cards, "de").every((l) => !l.translated)).toBe(true);
  });

  it("leaves out drafts, unknown slugs and an empty list", () => {
    expect(marketLinks([{ ...cards[0], published: false }], "en")).toEqual([]);
    expect(marketLinks([{ ...cards[0], slug: "egypt" }], "en")).toEqual([]);
    expect(marketLinks(null, "en")).toEqual([]);
  });

  it("builds cards without bodies, naming the languages prerendered", () => {
    expect(cards[0].body).toBeUndefined();
    expect(cards[0].meta).toEqual({ langs: ["en", "ar"] });
  });
});

describe("market routes", () => {
  it("are self-described by exact path, never by prefix", () => {
    expect(isMarketSlug("uae")).toBe(true);
    expect(isMarketSlug("egypt")).toBe(false);
    expect(pageForPath("/uae")).toBeNull();
    expect(pageForPath("/saudi-arabia/")).toBeNull();
    expect(pageForPath("/gulf")).toBeNull();
    expect(pageForPath("/uae-offers")).toBe(PAGES.notFound);
    expect(pageForPath("/gulfstream")).toBe(PAGES.notFound);
    expect(pageForPath("/services/web-development")).toBeNull();
  });
});

describe("switchLanguagePath", () => {
  it("keeps the page when it exists in the chosen language", async () => {
    const { switchLanguagePath } = await import("./market-page.ts");
    expect(switchLanguagePath("ar", "/uae")).toBe("/ar/uae");
    expect(switchLanguagePath("en", "/saudi-arabia")).toBe("/saudi-arabia");
    expect(switchLanguagePath("de", "/services/automation")).toBe("/de/services/automation");
  });
  it("sends German and French readers of a country page to their home page", async () => {
    const { switchLanguagePath } = await import("./market-page.ts");
    expect(switchLanguagePath("de", "/uae")).toBe("/de");
    expect(switchLanguagePath("fr", "/gulf/")).toBe("/fr");
  });
});
