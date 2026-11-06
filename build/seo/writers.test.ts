import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PAGES, disambiguation, resetSiteIdentity } from "../../src/lib/seo/index.ts";
import type { BuildContext } from "./context.ts";
import { writeLlmsFull, writeLlmsTxt } from "./llms.ts";
import { writeMarkdownTwins } from "./markdown.ts";
import { AI_CRAWLERS, writeRobots } from "./robots.ts";
import { lastmodFor, writeSitemap } from "./sitemap.ts";

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

  it("moves the identity pages' lastmod when the settings change, and nothing else's", async () => {
    const settings = { updatedAt: "2099-01-02T08:00:00Z" } as BuildContext["settings"];
    await writeSitemap(dir, ORIGIN, context({ settings }));
    const xml = await readFile(join(dir, "sitemap.xml"), "utf8");
    const lastmod = (loc: string) => xml.match(new RegExp(`<loc>${loc}</loc>\\s*<lastmod>([^<]+)</lastmod>`))?.[1];
    expect(lastmod(`${ORIGIN}/about`)).toBe("2099-01-02");
    expect(lastmod(`${ORIGIN}/ar/about`)).toBe("2099-01-02");
    expect(lastmod(`${ORIGIN}/services`)).toBe(lastmodFor(context(), "services"));
    expect(lastmod(`${ORIGIN}/services`)).not.toBe("2099-01-02");
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

  it("repeats the same rules under every group, since a crawler obeys only its own", async () => {
    await writeRobots(dir, ORIGIN);
    const txt = await readFile(join(dir, "robots.txt"), "utf8");
    const groups = txt.split(/\n(?=User-agent: )/).filter((g) => g.startsWith("User-agent: "));
    expect(groups).toHaveLength(1 + AI_CRAWLERS.length);
    for (const g of groups) {
      expect(g).toContain("Disallow: /q/\n");
      expect(g).toContain("Disallow: /article-shell.html\n");
      expect(g).toContain("Content-Signal: search=yes, ai-input=yes, ai-train=yes");
    }
  });
});

const exists = (path: string) => access(path).then(() => true, () => false);

const POST = {
  slug: "pos-guide",
  title: { en: "POS guide", ar: "دليل نقاط البيع" },
  summary: { en: "Choosing a POS.", ar: "اختيار نظام نقاط البيع." },
  body: { en: "Read [our services](/services) first.\n\n![shot](/img/a.png)", ar: "النص" },
  createdAt: "2026-05-01T10:00:00Z",
  updatedAt: "2026-05-04T10:00:00Z",
};

describe("writeMarkdownTwins", () => {
  afterEach(resetSiteIdentity);

  it("writes one twin per indexable page per language, and none for noindex, /404 or /q", async () => {
    const count = await writeMarkdownTwins(dir, ORIGIN, context({ articles: [POST] }));
    for (const f of ["index.md", "ar/index.md", "about.md", "ar/about.md", "services.md", "book.md"]) {
      expect(await exists(join(dir, f)), f).toBe(true);
    }
    for (const f of ["campaign.md", "404.md", "q.md", "ar/campaign.md"]) expect(await exists(join(dir, f)), f).toBe(false);
    // 8 indexable static pages and the post, in both languages.
    expect(count).toBe(2 * (8 + 1));
  });

  it("writes an item only in the languages it exists in, with the canonical URL in its front block", async () => {
    const english = { ...POST, slug: "english-only", title: { en: "English only" }, body: { en: "Body" } };
    await writeMarkdownTwins(dir, ORIGIN, context({ articles: [POST, english] }));
    expect(await exists(join(dir, "blog/english-only.md"))).toBe(true);
    expect(await exists(join(dir, "ar/blog/english-only.md"))).toBe(false);

    const ar = await readFile(join(dir, "ar/blog/pos-guide.md"), "utf8");
    expect(ar.startsWith("---\ntitle: ")).toBe(true);
    expect(ar).toContain(`\nurl: ${ORIGIN}/ar/blog/pos-guide\n`);
    expect(ar).toContain("\nlanguage: ar\n");
    expect(ar).toContain("\n# دليل نقاط البيع\n");

    const en = await readFile(join(dir, "blog/pos-guide.md"), "utf8");
    expect(en).toContain(`\nurl: ${ORIGIN}/blog/pos-guide\n`);
    expect(en).toContain("\npublished: 2026-05-01\nmodified: 2026-05-04\nauthor: Kirollos Fayez\n");
    // Root-relative links are made absolute: a twin is read out of context.
    expect(en).toContain(`[our services](${ORIGIN}/services)`);
    expect(en).toContain(`![shot](${ORIGIN}/img/a.png)`);
    expect(en.trimEnd().endsWith(disambiguation(ORIGIN))).toBe(true);
  });

  it("gives /about the identity facts and the fallback why/process cards", async () => {
    await writeMarkdownTwins(dir, ORIGIN, context());
    const about = await readFile(join(dir, "about.md"), "utf8");
    expect(about).toContain(`\nurl: ${ORIGIN}/about\n`);
    expect(about).toContain("- Founded: 2020");
    expect(about).toContain("kftechsols.com");
    expect(about).toContain("https://www.snapchat.com/add/kftechsolutions");
    expect(about).toContain("**Built For Your Business**");
    expect(about).toContain("1. **Discover**");
  });
});

describe("llms.txt and llms-full.txt", () => {
  afterEach(resetSiteIdentity);

  it("states the identity facts, including the Arabic alias and the machine-readable versions", async () => {
    await writeLlmsTxt(dir, ORIGIN, context());
    const txt = await readFile(join(dir, "llms.txt"), "utf8");
    expect(txt).toContain("in Cairo, Egypt, founded by Kirollos Fayez in 2020");
    expect(txt).toContain("- Also known as: KF Tech, KFTech, KFTech Solutions; in Arabic: كي إف تك");
    expect(txt).toContain("- Founded: 2020");
    // The team size is structured data only — the owner asked for it never to appear as text.
    expect(txt).not.toContain("2–9");
    expect(txt).toContain("https://www.snapchat.com/add/kftechsolutions");
    expect(txt).toContain("## Machine-readable versions");
    expect(txt).toContain(`${ORIGIN}/llms-full.txt`);
    expect(txt).toContain("Cairo, Egypt — working worldwide");
  });

  it("appends the English pages in full, an article included, under the llms.txt text", async () => {
    const full = await writeLlmsFull(dir, ORIGIN, context({ articles: [POST] }));
    const txt = await readFile(join(dir, "llms-full.txt"), "utf8");
    expect(txt.startsWith("# KF Tech Solutions\n")).toBe(true);
    expect(txt).toContain(disambiguation(ORIGIN));
    expect(txt).toContain("\n## Full pages\n");
    expect(txt).toContain("\n# POS guide\n");
    expect(txt).not.toContain("دليل نقاط البيع");
    // home, about, services, contact and the post.
    expect(full).toMatchObject({ pages: 5, dropped: 0 });
    expect(full.bytes).toBe(Buffer.byteLength(txt, "utf8"));
  });

  it("never lists a twin in the sitemap", async () => {
    const ctx = context({ articles: [POST] });
    await writeMarkdownTwins(dir, ORIGIN, ctx);
    await writeSitemap(dir, ORIGIN, ctx);
    expect(await readFile(join(dir, "sitemap.xml"), "utf8")).not.toContain(".md<");
  });
});
