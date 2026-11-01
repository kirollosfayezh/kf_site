import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PAGES } from "../../src/lib/seo/index.ts";
import type { BuildContext } from "./context.ts";
import { writeRobots } from "./robots.ts";
import { writeSitemap } from "./sitemap.ts";

const ORIGIN = "https://kf.test";

function context(overrides: Partial<BuildContext> = {}): BuildContext {
  return {
    pages: PAGES,
    settings: null,
    articles: [],
    projects: [],
    legal: [],
    services: [],
    solutions: [],
    faqs: [],
    testimonials: [],
    aboutSections: [],
    promos: [],
    translations: {},
    langs: ["en", "ar"],
    overrides: 0,
    ...overrides,
  };
}

let dir = "";
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "kf-seo-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("writeSitemap", () => {
  it("lists every indexable page in every language, and nothing noindex", async () => {
    const count = await writeSitemap(dir, ORIGIN, context());
    const xml = await readFile(join(dir, "sitemap.xml"), "utf8");
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(count).toBe(locs.length);
    expect(locs).toContain(`${ORIGIN}/services`);
    expect(locs).toContain(`${ORIGIN}/ar/services`);
    expect(locs.some((l) => l.includes("/campaign") || l.includes("/404") || l.includes("/q"))).toBe(false);
    expect(xml).toContain(`<xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}/services" />`);
  });

  it("lists an article only in the languages it is actually written in", async () => {
    const articles = [
      {
        slug: "pos-guide",
        title: { en: "POS guide", ar: "دليل" },
        body: { en: "Body", ar: "" },
        updatedAt: "2026-05-04T10:00:00Z",
      },
    ];
    await writeSitemap(dir, ORIGIN, context({ articles }));
    const xml = await readFile(join(dir, "sitemap.xml"), "utf8");
    expect(xml).toContain(`<loc>${ORIGIN}/blog/pos-guide</loc>\n    <lastmod>2026-05-04</lastmod>`);
    expect(xml).not.toContain(`${ORIGIN}/ar/blog/pos-guide`);
  });

  it("drops a page an editor marked noindex in the dashboard", async () => {
    const pages = { ...PAGES, about: { ...PAGES.about, noindex: true } };
    await writeSitemap(dir, ORIGIN, context({ pages }));
    expect(await readFile(join(dir, "sitemap.xml"), "utf8")).not.toContain(`${ORIGIN}/about`);
  });
});

describe("writeRobots", () => {
  it("keeps private quote links out of every language, allows assistants, and names the sitemap", async () => {
    await writeRobots(dir, ORIGIN);
    const txt = await readFile(join(dir, "robots.txt"), "utf8");
    for (const p of ["/q/", "/ar/q/", "/de/q/", "/fr/q/"]) expect(txt).toContain(`Disallow: ${p}\n`);
    expect(txt).not.toContain("Disallow: /campaign");
    expect(txt).toContain("User-agent: OAI-SearchBot\nAllow: /");
    expect(txt.trimEnd().endsWith(`Sitemap: ${ORIGIN}/sitemap.xml`)).toBe(true);
  });
});
