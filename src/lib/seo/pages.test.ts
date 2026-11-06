import { beforeAll, describe, expect, it } from "vitest";
import ar from "../dict/ar.json";
import de from "../dict/de.json";
import fr from "../dict/fr.json";
import { primeDict } from "../dict/index.ts";
import { LANGS } from "../langs.ts";
import { mergeSeoOverrides } from "./overrides.ts";
import { INDEXABLE_PAGES, PAGES, PRERENDER_PAGES, pageForPath, pageForPathIn } from "./pages.ts";
import { fitDesc, fitTitle, resolveDesc, resolveTitle } from "./text.ts";

describe("pageForPath", () => {
  it("resolves static routes, ignoring a trailing slash", () => {
    expect(pageForPath("/services")).toBe(PAGES.services);
    expect(pageForPath("/services/")).toBe(PAGES.services);
    expect(pageForPath("/")).toBe(PAGES.home);
  });

  it("returns null for routes whose page writes its own metadata", () => {
    for (const path of ["/blog/some-post", "/projects/gentrack", "/legal/privacy", "/services/web-development"]) {
      expect(pageForPath(path)).toBeNull();
    }
  });

  it("maps private quote links to the noindex quote entry", () => {
    expect(pageForPath("/q/abc123")).toBe(PAGES.quote);
    expect(PAGES.quote.noindex).toBe(true);
  });

  it("falls back to the not-found entry for anything unknown", () => {
    expect(pageForPath("/nope")).toBe(PAGES.notFound);
  });
});

describe("page lists", () => {
  it("keeps noindex pages out of the sitemap list", () => {
    expect(INDEXABLE_PAGES.some((p) => p.noindex)).toBe(false);
    expect(INDEXABLE_PAGES).toContain(PAGES.home);
  });

  it("prerenders the campaign page (for its share card) but never /404 or /q", () => {
    const paths = PRERENDER_PAGES.map((p) => p.path);
    expect(paths).toContain("/campaign");
    expect(paths).not.toContain("/404");
    expect(paths).not.toContain("/q");
  });
});

describe("mergeSeoOverrides", () => {
  it("returns the compiled-in table when there is nothing to merge", () => {
    expect(mergeSeoOverrides(null)).toBe(PAGES);
    expect(mergeSeoOverrides([])).toBe(PAGES);
  });

  it("treats a blank field as inherit, never as clear", () => {
    const merged = mergeSeoOverrides([{ key: "about", title: "  ", description: { en: "" }, keywords: " " }]);
    expect(merged.about.title).toBe(PAGES.about.title);
    expect(merged.about.desc).toBe(PAGES.about.desc);
    expect(merged.about.keywords).toBe(PAGES.about.keywords);
  });

  it("reads a legacy string override as English and keeps translations apart", () => {
    const merged = mergeSeoOverrides([
      { key: "about", title: "Who we are", description: { en: "Desc", ar: " وصف ", de: "" } },
    ]);
    expect(merged.about.title).toBe("Who we are");
    expect(merged.about.desc).toBe("Desc");
    expect(merged.about.titleByLang).toBeUndefined();
    expect(merged.about.descByLang).toEqual({ ar: "وصف" });
  });

  it("only overrides noindex with an explicit boolean", () => {
    const merged = mergeSeoOverrides([
      { key: "campaign", noindex: null },
      { key: "about", noindex: true },
    ]);
    expect(merged.campaign.noindex).toBe(true);
    expect(merged.about.noindex).toBe(true);
    expect(mergeSeoOverrides([{ key: "campaign", noindex: false }]).campaign.noindex).toBe(false);
  });

  it("never claims dimensions for a dashboard share image", () => {
    const merged = mergeSeoOverrides([{ key: "home", image: "https://cdn.test/card.jpg" }]);
    expect(merged.home.image).toBe("https://cdn.test/card.jpg");
    expect(merged.home.imageSized).toBe(false);
  });

  it("ignores rows for routes that no longer exist and does not mutate PAGES", () => {
    const before = PAGES.about.title;
    const merged = mergeSeoOverrides([{ key: "old-route", title: "Stale" }, { key: "about", title: "New" }]);
    expect(merged["old-route"]).toBeUndefined();
    expect(PAGES.about.title).toBe(before);
    expect(pageForPathIn(merged, "/about")?.title).toBe("New");
  });
});

/**
 * What actually reaches the results page, in every language, with the shipped
 * dictionaries loaded as the build loads them. `fitTitle` drops a trailing
 * "| KF Tech…" past 60 characters, which is how /services used to ship with no
 * brand in its <title>; `fitDesc` cuts past 160.
 */
describe("static page titles and descriptions", () => {
  beforeAll(() => {
    primeDict("ar", ar);
    primeDict("de", de);
    primeDict("fr", fr);
  });

  const cases = INDEXABLE_PAGES.flatMap((page) => LANGS.map((lang) => [page.path, lang, page] as const));

  it.each(cases)("%s (%s) keeps the brand in a title that fits", (_path, lang, page) => {
    const title = fitTitle(resolveTitle(page, lang));
    expect(title).toContain("KF Tech");
    expect(title.length).toBeLessThanOrEqual(70);
  });

  it.each(cases)("%s (%s) ships its whole description", (_path, lang, page) => {
    const desc = resolveDesc(page, lang);
    expect(fitDesc(desc)).toBe(desc.replace(/\s+/g, " ").trim());
    expect(desc.length).toBeLessThanOrEqual(160);
  });

  it.each(cases)("%s (%s) is translated, not English", (_path, lang, page) => {
    if (lang === "en") return;
    const dict: Record<string, string> = { ar, de, fr }[lang];
    for (const text of [page.title, page.desc, page.keywords]) {
      if (text) expect(dict[text]?.trim(), text).toBeTruthy();
    }
  });

  it("names the company in the home and about descriptions in every language", () => {
    for (const lang of LANGS) {
      expect(resolveDesc(PAGES.home, lang)).toContain("KF Tech Solutions");
      expect(resolveDesc(PAGES.about, lang)).toContain("KF Tech Solutions");
    }
    expect(resolveDesc(PAGES.home, "ar")).toContain("كي إف تك");
  });

  it("opens the Arabic home and about descriptions with Arabic, so snippets stay right-to-left", () => {
    for (const page of [PAGES.home, PAGES.about]) {
      expect(resolveDesc(page, "ar")).toMatch(/^[\u0600-\u06FF]/);
    }
  });

  it("dates every prerendered page's copy with a literal day", () => {
    for (const page of PRERENDER_PAGES) expect(page.lastmod, page.path).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
