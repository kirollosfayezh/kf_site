import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ARABIC_ALIAS, auditDist, type AuditResult, type VercelConfig } from "./audit.mjs";

const ORIGIN = "https://kf.test";
const TODAY = "2026-11-06";
const VERCEL: VercelConfig = {
  rewrites: [
    { source: "/q/(.*)", destination: "/article-shell.html" },
    { source: "/demos/:slug", destination: "https://backend.test/demos/:slug" },
  ],
  redirects: [
    // Matches every path, but only on another host: must not excuse a broken link.
    { source: "/:path(.*)", has: [{ type: "host", value: "kf.vercel.app" }], destination: `${ORIGIN}/:path` },
  ],
};

/** Base paths that exist in both languages; everything else is English only. */
const BILINGUAL = ["/", "/about"];

const url = (path: string) => `${ORIGIN}${path}`;
const langOf = (path: string) => (path === "/ar" || path.startsWith("/ar/") ? "ar" : "en");
const baseOf = (path: string) => (langOf(path) === "ar" ? path.slice(3) || "/" : path);
const inLang = (lang: string, base: string) => (lang === "en" ? base : `/ar${base === "/" ? "" : base}`);

interface PageOpts {
  htmlLang?: string;
  title?: string | string[];
  desc?: string;
  robots?: string;
  canonical?: string | null;
  alternates?: { hreflang: string; href: string }[] | null;
  og?: Record<string, string>;
  /** The inner HTML of `#root`. */
  body?: string;
  /** JSON-LD blocks; a string is written as-is (to test a parse failure). */
  ld?: (object | string)[];
  twin?: string;
}

function organisation() {
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "LocalBusiness"],
    "@id": `${ORIGIN}/#organization`,
    name: "KF Tech Solutions",
    alternateName: ["KF Tech", "KFTech", "KFTech Solutions", ARABIC_ALIAS],
    founder: { "@type": "Person", "@id": `${ORIGIN}/about#founder`, name: "Kirollos Fayez" },
    foundingDate: "2020",
    disambiguatingDescription: "Not affiliated with KFTECH Software Solutions (kftechsols.com).",
    numberOfEmployees: { "@type": "QuantitativeValue", minValue: 2, maxValue: 9 },
  };
}

function website() {
  return { "@context": "https://schema.org", "@type": "WebSite", "@id": `${ORIGIN}/#website`, name: "KF Tech Solutions", publisher: { "@id": `${ORIGIN}/#organization` } };
}

function webPage(path: string, title: string) {
  const about = baseOf(path) === "/about";
  return {
    "@context": "https://schema.org",
    "@type": about ? ["AboutPage", "ProfilePage"] : "WebPage",
    "@id": url(path),
    name: title,
    isPartOf: { "@id": `${ORIGIN}/#website` },
    publisher: { "@id": `${ORIGIN}/#organization` },
    ...(about ? { mainEntity: { "@type": "Person", "@id": `${ORIGIN}/about#founder`, name: "Kirollos Fayez" } } : {}),
  };
}

/** A minimal prerendered page that passes every check. */
function page(path: string, o: PageOpts = {}): string {
  const lang = langOf(path);
  const base = baseOf(path);
  const notFound = path === "/404.html";
  const noindex = notFound || base === "/campaign";
  // Arabic text first on /ar, and one description per page: either would warn.
  const name = `${lang === "ar" ? "صفحة " : ""}${base === "/" ? "Home" : base.slice(1)} page`;
  const title = o.title ?? `${name} | KF Tech Solutions`;
  const titles = Array.isArray(title) ? title : [title];
  const desc = o.desc ?? `${name}: KF Tech Solutions builds custom software, web and mobile apps and AI automation in Cairo, Egypt.`;
  const canonical = o.canonical === undefined ? (notFound ? null : url(path)) : o.canonical;
  const alternates =
    o.alternates === undefined
      ? BILINGUAL.includes(base)
        ? [
            { hreflang: "en", href: url(inLang("en", base)) },
            { hreflang: "ar", href: url(inLang("ar", base)) },
            { hreflang: "x-default", href: url(inLang("en", base)) },
          ]
        : null
      : o.alternates;
  const og = {
    "og:site_name": "KF Tech Solutions",
    "og:locale": lang === "ar" ? "ar_EG" : "en_US",
    "og:image": `${ORIGIN}/og-default.png`,
    "og:image:width": "1200",
    "og:image:height": "630",
    ...(canonical ? { "og:url": canonical } : {}),
    ...o.og,
  };
  const facts =
    base === "/about"
      ? `<section id="founder"><p>Founded in 2020. Our only website is kftechsolutions.dev; not connected to kftechsols.com.</p></section>`
      : "";
  const body =
    o.body ??
    `<header><a href="/">KF Tech Solutions</a> <a href="/about">About</a></header><main><h1>${titles[0]}</h1>` +
      `<p>KF Tech Solutions${lang === "ar" ? ` (${ARABIC_ALIAS})` : ""} &amp; friends.</p>${facts}</main>`;
  const ld = o.ld ?? [organisation(), website(), ...(noindex ? [] : [webPage(path, titles[0])])];
  const head = [
    ...titles.map((t) => `<title data-kf-seo="1">${t}</title>`),
    `<meta name="description" content="${desc}" data-kf-seo="1" />`,
    `<meta name="robots" content="${o.robots ?? (noindex ? "noindex,follow" : "index,follow")}" data-kf-seo="1" />`,
    ...(canonical ? [`<link rel="canonical" href="${canonical}" data-kf-seo="1" />`] : []),
    ...(alternates ?? []).map((a) => `<link rel="alternate" href="${a.href}" hreflang="${a.hreflang}" data-kf-seo="1" />`),
    ...(o.twin ? [`<link rel="alternate" type="text/markdown" href="${o.twin}" data-kf-seo="1" />`] : []),
    ...Object.entries(og).map(([k, v]) => `<meta property="${k}" content="${v}" data-kf-seo="1" />`),
    ...ld.map((b) => `<script type="application/ld+json" data-kf-seo="1">${typeof b === "string" ? b : JSON.stringify(b)}</script>`),
  ];
  return `<!doctype html>
<html lang="${o.htmlLang ?? lang}" dir="${lang === "ar" ? "rtl" : "ltr"}">
  <head>
    <!-- a comment that mentions <title> and <meta name="description"> must not count -->
    ${head.join("\n    ")}
  </head>
  <body>
    <div id="root">${body}</div>
    <script id="kf-content" type="application/json">{"html":"<h1>not counted</h1>"}</script>
  </body>
</html>`;
}

const PAGES = ["/", "/about", "/ar", "/ar/about", "/campaign", "/404.html"];

function robots(groupRules?: (ua: string) => string | undefined): string {
  const rules = "Allow: /\nDisallow: /q/\nDisallow: /ar/q/\nDisallow: /article-shell.html\nContent-Signal: search=yes, ai-input=yes, ai-train=yes";
  const groups = ["*", "OAI-SearchBot", "ClaudeBot", "PerplexityBot"].map((ua) => `User-agent: ${ua}\n${groupRules?.(ua) ?? rules}`);
  return `${groups.join("\n\n")}\n\nSitemap: ${ORIGIN}/sitemap.xml\n`;
}

function sitemap(paths = ["/", "/about", "/ar", "/ar/about"], lastmod = "2026-11-01"): string {
  const urls = paths.map((p) => `  <url>\n    <loc>${url(p)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

const LLMS = `# KF Tech Solutions\n\nFounded by Kirollos Fayez in 2020 in Cairo; in Arabic: ${ARABIC_ALIAS}. ${ORIGIN} is its only website; not affiliated with kftechsols.com.\n`;

let dir = "";
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "kf-audit-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

/**
 * Writes the clean fixture with `pages` and `files` overriding it (`null`
 * leaves a file out), then audits it.
 */
async function dist(
  { pages = {}, files = {} }: { pages?: Record<string, PageOpts | null>; files?: Record<string, string | null> } = {},
  options: { origin?: string | null } = {},
): Promise<AuditResult> {
  const out: Record<string, string | null> = {
    "robots.txt": robots(),
    "sitemap.xml": sitemap(),
    "llms.txt": LLMS,
    "llms-full.txt": LLMS,
    "feed.xml": "<rss/>",
    "ar/feed.xml": "<rss/>",
    "seo-defaults.json": "{}",
    "0123456789abcdef0123456789abcdef.txt": "0123456789abcdef0123456789abcdef",
    "og-default.png": "png",
    "article-shell.html": `<html lang="en"><head><title>Shell</title><meta name="robots" content="noindex,follow" /></head><body><div id="root"></div></body></html>`,
  };
  for (const path of [...PAGES, ...Object.keys(pages)]) {
    const rel = path === "/404.html" ? "404.html" : `${path === "/" ? "" : `${path.slice(1)}/`}index.html`;
    const opts = path in pages ? pages[path] : {};
    out[rel] = opts === null ? null : page(path, opts);
  }
  Object.assign(out, files);
  for (const [rel, body] of Object.entries(out)) {
    if (body === null) continue;
    await mkdir(dirname(join(dir, rel)), { recursive: true });
    await writeFile(join(dir, rel), body, "utf8");
  }
  return auditDist(dir, { origin: "origin" in options ? options.origin : ORIGIN, vercelConfig: VERCEL, today: TODAY });
}

const checks = (list: { check: string }[]) => [...new Set(list.map((f) => f.check))].sort();

describe("auditDist", () => {
  it("passes a clean site, with no warnings", async () => {
    const r = await dist();
    expect(r.failures).toEqual([]);
    expect(r.warnings).toEqual([]);
    expect(r.stats.pages).toBe(PAGES.length);
    expect(r.stats.checks).toContain("robots-ai-groups");
  });

  it("skips the host-dependent checks with one warning when there is no origin", async () => {
    // The canonical points at another host — only an origin can tell.
    const r = await dist({ pages: { "/campaign": { canonical: "https://elsewhere.test/campaign", og: { "og:url": "https://elsewhere.test/campaign" } } } }, { origin: null });
    expect(r.failures).toEqual([]);
    expect(r.warnings.map((w) => w.check)).toEqual(["origin"]);
  });

  // One case per FAIL check: the clean fixture with one thing broken.
  it.each<[string, Parameters<typeof dist>[0], string[]]>([
    ["html lang that disagrees with the path", { pages: { "/ar/about": { htmlLang: "en" } } }, ["html-lang"]],
    ["a second <h1>", { pages: { "/about": { body: `<h1>One</h1><h1>Two</h1><div id="founder">2020 kftechsols.com kftechsolutions.dev KF Tech Solutions</div>` } } }, ["h1"]],
    ["two <title> tags", { pages: { "/campaign": { title: ["One | KF Tech", "Two | KF Tech"] } } }, ["title"]],
    ["a brandless about title", { pages: { "/about": { title: "About us — Software Studio in Cairo" } } }, ["title-brand"]],
    ["a description over 160 characters", { pages: { "/campaign": { desc: `KF Tech Solutions ${"x".repeat(160)}` } } }, ["description"]],
    ["a brandless home description", { pages: { "/": { desc: "Custom software, web and mobile development plus AI automation for growing businesses." } } }, ["description-brand"]],
    // …and the sitemap now lists a noindex page.
    ["noindex on an ordinary page", { pages: { "/about": { robots: "noindex,follow" } } }, ["robots-meta", "sitemap"]],
    ["a non-English x-default", { pages: { "/ar": { alternates: [{ hreflang: "en", href: url("/") }, { hreflang: "ar", href: url("/ar") }, { hreflang: "x-default", href: url("/ar") }] } } }, ["hreflang"]],
    ["no x-default", { pages: { "/ar": { alternates: [{ hreflang: "en", href: url("/") }, { hreflang: "ar", href: url("/ar") }] } } }, ["hreflang"]],
    ["a cluster that is not reciprocal", { pages: { "/ar/about": { alternates: [{ hreflang: "ar", href: url("/ar/about") }, { hreflang: "en", href: url("/") }, { hreflang: "x-default", href: url("/") }] } } }, ["hreflang"]],
    ["sibling languages but no hreflang", { pages: { "/about": { alternates: null } } }, ["hreflang"]],
    ["the wrong og:locale", { pages: { "/ar": { og: { "og:locale": "en_US" } } } }, ["og"]],
    ["unparsable JSON-LD", { pages: { "/about": { ld: [organisation(), website(), webPage("/about", "about page | KF Tech Solutions"), "{nope"] } } }, ["jsonld-parse"]],
    ["two #organization nodes", { pages: { "/": { ld: [organisation(), organisation(), website(), webPage("/", "Home page | KF Tech Solutions")] } } }, ["jsonld-organization"]],
    ["an Organization without the Arabic alias", { pages: { "/": { ld: [{ ...organisation(), alternateName: ["KF Tech", "KFTech"] }, website(), webPage("/", "Home page | KF Tech Solutions")] } } }, ["jsonld-organization"]],
    ["no #website node", { pages: { "/campaign": { ld: [organisation()] } } }, ["jsonld-website"]],
    ["no WebPage node", { pages: { "/": { ld: [organisation(), website()] } } }, ["jsonld-webpage"]],
    ["an about page without the founder as mainEntity", { pages: { "/about": { ld: [organisation(), website(), { ...webPage("/about", "about page | KF Tech Solutions"), mainEntity: undefined }] } } }, ["jsonld-about"]],
    ["two FAQPage nodes", { pages: { "/": { ld: [organisation(), website(), webPage("/", "Home page | KF Tech Solutions"), { "@type": "FAQPage" }, { "@type": "FAQPage" }] } } }, ["jsonld-faq"]],
    ["aggregateRating", { pages: { "/": { ld: [{ ...organisation(), aggregateRating: { "@type": "AggregateRating", ratingValue: 5 } }, website(), webPage("/", "Home page | KF Tech Solutions")] } } }, ["jsonld-no-reviews"]],
    ["a #breadcrumb reference that resolves nowhere", { pages: { "/about": { ld: [organisation(), website(), { ...webPage("/about", "about page | KF Tech Solutions"), breadcrumb: { "@id": `${url("/about")}#breadcrumb` } }] } } }, ["jsonld-refs"]],
    ["an Arabic home page without the Arabic alias", { pages: { "/ar": { body: "<h1>Home</h1><p>KF Tech Solutions</p>" } } }, ["visible-brand"]],
    ["an about page without the identity facts", { pages: { "/about": { body: "<h1>About</h1><p>KF Tech Solutions</p>" } } }, ["about-facts"]],
    ["a link to a missing page", { pages: { "/": { body: `<h1>Home</h1><p>KF Tech Solutions</p><a href="/pricing">Pricing</a>` } } }, ["links"]],
    ["a Markdown twin with no file", { pages: { "/about": { twin: url("/about.md") } } }, ["markdown-twin"]],
    ["a missing llms.txt", { files: { "llms.txt": null } }, ["files"]],
    ["an indexable article shell", { files: { "article-shell.html": `<html lang="en"><head><title>Shell</title><meta name="robots" content="index" /></head><body><div id="root"></div></body></html>` } }, ["article-shell"]],
    ["a sitemap <loc> without a file", { files: { "sitemap.xml": sitemap(["/", "/about", "/ar", "/ar/about", "/pricing"]) } }, ["sitemap"]],
    ["a noindex page in the sitemap", { files: { "sitemap.xml": sitemap(["/", "/about", "/ar", "/ar/about", "/campaign"]) } }, ["sitemap"]],
    ["an indexable page missing from the sitemap", { files: { "sitemap.xml": sitemap(["/", "/about", "/ar"]) } }, ["sitemap-coverage"]],
    ["every lastmod set to today", { files: { "sitemap.xml": sitemap(undefined, TODAY) } }, ["sitemap-lastmod"]],
    ["no ClaudeBot group", { files: { "robots.txt": robots().replace("User-agent: ClaudeBot", "User-agent: SomeBot") } }, ["robots-txt"]],
    ["an AI group without the Disallow lines", { files: { "robots.txt": robots((ua) => (ua === "OAI-SearchBot" ? "Allow: /\nContent-Signal: search=yes, ai-input=yes, ai-train=yes" : undefined)) } }, ["robots-ai-groups"]],
    // …so no AI group carries one either.
    ["no Content-Signal anywhere", { files: { "robots.txt": robots().replace(/^Content-Signal:.*\n?/gm, "") } }, ["robots-ai-groups", "robots-content-signal"]],
    ["an llms.txt without the Arabic alias", { files: { "llms.txt": LLMS.replace(ARABIC_ALIAS, "") } }, ["llms-txt"]],
  ])("fails on %s", async (_name, fixture, expected) => {
    const r = await dist(fixture);
    expect(checks(r.failures)).toEqual(expected);
  });

  it("fails a canonical that points elsewhere", async () => {
    const r = await dist({ pages: { "/about": { canonical: url("/") } } });
    expect(checks(r.failures)).toContain("canonical");
  });

  it("does not report links Vercel rewrites, nor the host-only redirect as an excuse", async () => {
    const body = `<h1>Home</h1><p>KF Tech Solutions</p><a href="/q/abc123">Quote</a><a href="/demos/salon">Demo</a><a href="/about#founder">Founder</a><a href="https://elsewhere.test/x">Out</a>`;
    expect((await dist({ pages: { "/": { body } } })).failures).toEqual([]);
  });

  it("accepts a Markdown twin that starts with the page's title and canonical", async () => {
    const twin = `---\ntitle: "about page"\nurl: ${url("/about")}\n---\n\n# about page\n`;
    const r = await dist({ pages: { "/about": { twin: url("/about.md") } }, files: { "about.md": twin } });
    expect(r.failures).toEqual([]);
  });

  it("matches a twin title with a French non-breaking space or a JSON-escaped quote", async () => {
    // Regression: the HTML title was whitespace-collapsed and the twin's was
    // not, so every French "Titre\u00a0: …" page failed.
    const title = 'About KF Tech Solutions\u00a0: the "studio"';
    const twin = `---\ntitle: ${JSON.stringify(title)}\nurl: ${url("/about")}\n---\n`;
    const r = await dist({ pages: { "/about": { title, twin: url("/about.md") } }, files: { "about.md": twin } });
    expect(checks(r.failures)).not.toContain("markdown-twin");
  });

  it("only warns about a broken link inside a CMS page, but fails one on a static page", async () => {
    const bad = `<h1>Post</h1><p>KF Tech Solutions</p><a href="/blog/no-such-post">Missing</a>`;
    const cms = await dist({
      pages: { "/blog/post": { body: bad } },
      files: { "sitemap.xml": sitemap(["/", "/about", "/ar", "/ar/about", "/blog/post"]) },
    });
    expect(checks(cms.failures)).not.toContain("links");
    expect(checks(cms.warnings)).toContain("links");
    const page = await dist({ pages: { "/": { body: `<h1>Home</h1><p>KF Tech Solutions</p><a href="/nowhere">x</a>` } } });
    expect(checks(page.failures)).toContain("links");
  });

  it("only warns about editor-typed CMS text", async () => {
    const r = await dist({
      pages: { "/blog/post": { title: "A very long article title that an editor typed into the dashboard", desc: "Short." } },
      files: { "sitemap.xml": sitemap(["/", "/about", "/ar", "/ar/about", "/blog/post"]) },
    });
    expect(r.failures).toEqual([]);
    expect(checks(r.warnings)).toEqual(["cms-title-brand", "description-short", "keywords-missing", "title-long"]);
  });
});
