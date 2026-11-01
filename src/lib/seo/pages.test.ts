import { describe, expect, it } from "vitest";
import { mergeSeoOverrides } from "./overrides.ts";
import { INDEXABLE_PAGES, PAGES, PRERENDER_PAGES, pageForPath, pageForPathIn } from "./pages.ts";

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
