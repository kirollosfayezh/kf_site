/**
 * The SEO audit of a finished `dist/`: what a crawler and an assistant read,
 * checked file by file, without a browser.
 *
 * Plain JavaScript and React-free so `build/verify-seo.mjs` runs it straight
 * after `vite build` in plain Node, and pure (no printing, no exit) so the
 * test can run it against a fixture.
 *
 * Tiers: a FAIL is something the code owns — a template, a schema builder, a
 * writer — and turns the build red. Text an editor types in the dashboard
 * (article titles and summaries) only WARNs: a red production deploy because
 * an article title ran long is worse than the long title.
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export const BRAND = "KF Tech Solutions";
export const BRAND_RE = /KF ?Tech/;
export const FOUNDER = "Kirollos Fayez";
export const FOUNDED = "2020";
export const NOT_AFFILIATED_HOST = "kftechsols.com";
export const OFFICIAL_HOST = "kftechsolutions.dev";
export const ARABIC_ALIAS = "كي إف تك";
export const OG_LOCALE = { en: "en_US", ar: "ar_EG", de: "de_DE", fr: "fr_FR" };
/** The pages that introduce the company, where every brand fact must be. */
export const ENTITY_PAGES = ["/", "/about"];

const PREFIXED = ["ar", "de", "fr"];
const LANG_ORDER = ["en", ...PREFIXED];
/** The only pages allowed to say noindex (base paths, any language). */
const NOINDEX_PAGES = new Set(["/campaign"]);
const CMS_RE = /^\/(blog|projects|legal|services)\/[^/]+$/;
// The country pages (/saudi-arabia, /uae, /gulf): one path segment, so they
// keep the static pages' title and brand checks, but their body is typed in
// the dashboard — a link in it is the editor's, and only warns.
const MARKET_RE = /^\/(saudi-arabia|uae|gulf)$/;
const WEBPAGE_TYPES = new Set([
  "WebPage",
  "AboutPage",
  "ProfilePage",
  "ContactPage",
  "CollectionPage",
  "ItemPage",
  "QAPage",
  "SearchResultsPage",
]);
/** `@id` references that must resolve on the page they appear on. */
const CORE_REF = /#(organization|website|founder|breadcrumb)$/;
const AI_GROUPS = ["OAI-SearchBot", "ClaudeBot", "PerplexityBot"];

// ---------------------------------------------------------------------------
// Vercel `source` matching, copied from build/vercel-like.mjs (importing it
// would start its server). Keep the two in step.

/** The index just past the `)` matching the `(` at `open`. */
function closeParen(source, open) {
  let depth = 0;
  for (let k = open; k < source.length; k++) {
    if (source[k] === "(") depth++;
    else if (source[k] === ")" && --depth === 0) return k + 1;
  }
  return source.length;
}

/**
 * Vercel's `source` syntax → RegExp. `/:path*` and `/:path(pattern)` become
 * named groups; a bare `(pattern)` is regex, copied through; everything else
 * is literal (so `.` in `/sitemap.xml` is a dot, not "any character").
 */
function toRegExp(source) {
  let re = "";
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === "(") {
      const end = closeParen(source, i);
      re += source.slice(i, end);
      i = end;
      continue;
    }
    if (c === ":") {
      let j = i + 1;
      while (j < source.length && /[A-Za-z0-9_]/.test(source[j])) j++;
      const name = source.slice(i + 1, j);
      let pattern = "[^/]+";
      if (source[j] === "(") {
        const end = closeParen(source, j);
        pattern = source.slice(j + 1, end - 1);
        j = end;
      }
      if (source[j] === "*") {
        pattern = ".*";
        j++;
      }
      re += `(?<${name}>${pattern})`;
      i = j;
      continue;
    }
    re += c === "/" || c === "." ? `\\${c}` : c;
    i++;
  }
  return new RegExp(`^${re}$`);
}

/**
 * Whether Vercel would answer `url` from a rewrite or redirect instead of a
 * file. A redirect with a `has` condition only counts when the link meets it:
 * the vercel.app host redirect matches every path, and treating it as
 * unconditional would excuse every broken link on the site.
 */
function routedByVercel(url, config) {
  for (const rw of config?.rewrites ?? []) if (toRegExp(rw.source).test(url.pathname)) return true;
  for (const r of config?.redirects ?? []) {
    if (!toRegExp(r.source).test(url.pathname)) continue;
    const met = (r.has ?? []).every((has) => {
      if (has.type !== "query") return false;
      const v = url.searchParams.get(has.key);
      return v !== null && (!has.value || new RegExp(`^(?:${has.value})$`).test(v));
    });
    if (met) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// HTML reading. The pages are our own prerender output, so regexes over a
// known shape are enough — and keep this at a fraction of a second.

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*"([^"]*)"/g)) out[m[1].toLowerCase()] = decode(m[2]);
  return out;
}

const collapse = (s) => s.replace(/\s+/g, " ").trim();
/** A twin's `title:` is written with JSON.stringify, so `"` and `\\` arrive escaped. */
const unquote = (s) => {
  const v = s.trim();
  if (v.startsWith('"')) {
    try {
      return JSON.parse(v);
    } catch {
      /* not JSON after all: fall through */
    }
  }
  return v.replace(/^["']|["']$/g, "");
};

/** The inner HTML of `<div id="root">`, found by counting nested divs. */
function rootOf(html) {
  const start = html.search(/<div id="root"[^>]*>/);
  if (start < 0) return null;
  const open = html.indexOf(">", start) + 1;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = open;
  let depth = 1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0] === "</div>" ? -1 : 1;
    if (depth === 0) return html.slice(open, m.index);
  }
  return html.slice(open);
}

/** Visible text in two spellings: tags as spaces, and tags as nothing. */
function textOf(html) {
  const clean = html.replace(/<(style|template)\b[\s\S]*?<\/\1>/gi, " ");
  return [collapse(decode(clean.replace(/<[^>]+>/g, " "))), collapse(decode(clean.replace(/<[^>]+>/g, "")))];
}

function readPage(path, file, raw) {
  const ld = [...raw.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  // Scripts first (the content snapshot can hold anything), then comments:
  // index.html's head comments mention the very tags this counts.
  const html = raw.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
  const headEnd = html.indexOf("</head>");
  const head = headEnd < 0 ? html : html.slice(0, headEnd);
  const meta = [...head.matchAll(/<meta\b[^>]*>/g)].map((m) => attrs(m[0]));
  const links = [...head.matchAll(/<link\b[^>]*>/g)].map((m) => attrs(m[0]));
  const titles = [...head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title>/g)].map((m) => collapse(decode(m[1])));
  const named = (n) => meta.filter((m) => (m.name ?? "").toLowerCase() === n).map((m) => m.content ?? "");
  const prop = (p) => meta.filter((m) => m.property === p).map((m) => m.content ?? "");
  const segs = path.split("/").filter(Boolean);
  const lang = PREFIXED.includes(segs[0]) ? segs[0] : "en";
  const base = lang === "en" ? path : `/${segs.slice(1).join("/")}`;
  const robots = named("robots");
  const root = rootOf(html);
  return {
    path,
    file,
    lang,
    base,
    static: base.split("/").filter(Boolean).length <= 1,
    cms: CMS_RE.test(base),
    editorText: CMS_RE.test(base) || MARKET_RE.test(base),
    htmlLang: /<html\b[^>]*\blang="([^"]*)"/.exec(html)?.[1] ?? null,
    titles,
    descriptions: named("description"),
    keywords: named("keywords"),
    robots,
    noindex: robots.some((r) => /noindex/i.test(r)),
    canonicals: links.filter((l) => l.rel === "canonical").map((l) => l.href ?? ""),
    alternates: links.filter((l) => l.rel === "alternate" && l.hreflang).map((l) => ({ hreflang: l.hreflang, href: l.href ?? "" })),
    twins: links.filter((l) => l.rel === "alternate" && l.type === "text/markdown").map((l) => l.href ?? ""),
    og: {
      siteName: prop("og:site_name"),
      url: prop("og:url"),
      locale: prop("og:locale"),
      image: prop("og:image"),
      imageWidth: prop("og:image:width"),
      imageHeight: prop("og:image:height"),
    },
    ld,
    root,
    text: root === null ? ["", ""] : textOf(root),
    hrefs: [...html.matchAll(/<a\b[^>]*?\bhref="([^"]*)"/g)].map((m) => decode(m[1])),
  };
}

// ---------------------------------------------------------------------------
// JSON-LD.

const typesOf = (node) => (Array.isArray(node["@type"]) ? node["@type"] : node["@type"] ? [node["@type"]] : []);

function walk(value, visit) {
  if (Array.isArray(value)) for (const v of value) walk(v, visit);
  else if (value && typeof value === "object") {
    visit(value);
    for (const v of Object.values(value)) walk(v, visit);
  }
}

// ---------------------------------------------------------------------------

/** `/about/index.html` → `/about`, `404.html` → `/404.html`. */
function pathOf(rel) {
  const p = `/${rel.split(/[\\/]/).join("/")}`;
  if (p === "/index.html") return "/";
  return p.endsWith("/index.html") ? p.slice(0, -"/index.html".length) : p;
}

function localePath(lang, base) {
  if (lang === "en") return base;
  return `/${lang}${base === "/" ? "" : base}`;
}

/** A URL's path the way the pages are keyed: decoded, no trailing slash. */
function keyOf(url) {
  let p = url.pathname;
  try {
    p = decodeURIComponent(p);
  } catch {
    /* keep the encoded form */
  }
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

/**
 * Audits a built site.
 *
 * @param {string} distDir
 * @param {{ origin?: string | null, vercelConfig?: object | null, today?: string }} [options]
 */
export async function auditDist(distDir, { origin = null, vercelConfig = null, today } = {}) {
  const started = performance.now();
  origin = origin ? origin.replace(/\/+$/, "") : null;
  const failures = [];
  const warnings = [];
  const checks = new Set();
  const fail = (check, path, detail) => failures.push({ check, path, detail });
  const warn = (check, path, detail) => warnings.push({ check, path, detail });
  const ran = (...names) => names.forEach((n) => checks.add(n));
  const parse = (href, from = "/") => {
    try {
      return new URL(href, `${origin ?? "https://origin.invalid"}${from}`);
    } catch {
      return null;
    }
  };
  const sameSite = (url) => url && url.origin === (origin ?? "https://origin.invalid");
  /** The page key an absolute or relative href points at, or null. */
  const target = (href, from) => {
    const url = parse(href, from);
    return url ? keyOf(url) : null;
  };

  const files = new Set(
    (await readdir(distDir, { recursive: true, withFileTypes: true }))
      .filter((d) => d.isFile())
      .map((d) => join(d.parentPath ?? d.path, d.name).slice(distDir.replace(/[\\/]+$/, "").length + 1).split(/[\\/]/).join("/")),
  );
  const has = (rel) => files.has(rel.replace(/^\/+/, ""));
  /** A path Vercel would serve a file for: `p`, `p/index.html` or `p.html`. */
  const serves = (p) => {
    const rel = p.replace(/^\/+/, "");
    return rel === "" ? has("index.html") : has(rel) || has(`${rel}/index.html`) || has(`${rel}.html`);
  };
  const read = (rel) => readFile(join(distDir, rel), "utf8");

  const pageFiles = [...files].filter((f) => f === "index.html" || f.endsWith("/index.html") || f === "404.html");
  const pages = new Map();
  for (const rel of pageFiles) {
    const path = pathOf(rel);
    pages.set(path, readPage(path, rel, await read(rel)));
  }
  const langs = LANG_ORDER.filter((l) => l === "en" || pages.has(`/${l}`));
  const ownUrl = (p) => `${origin}${p.path}`;

  if (!origin) {
    warn(
      "origin",
      "-",
      "no origin (pass --origin or set VITE_SITE_URL): skipped the host checks (canonical, hreflang, sitemap and robots.txt hosts, og:image files, the origin in llms.txt)",
    );
  }

  // --- per page -------------------------------------------------------------
  ran(
    "html-lang", "h1", "title", "title-brand", "description", "description-brand", "robots-meta", "canonical",
    "hreflang", "og", "jsonld-parse", "jsonld-organization", "jsonld-website", "jsonld-webpage", "jsonld-about",
    "jsonld-faq", "jsonld-no-reviews", "jsonld-refs", "visible-brand", "about-facts", "links", "markdown-twin",
    // Warnings only.
    "title-long", "cms-title-brand", "description-short", "duplicate-title", "duplicate-description",
    "arabic-latin-start", "keywords-missing", "jsonld-refs-other", "og-image-size",
  );
  const linkCache = new Map();
  const titlesByLang = new Map();
  const descsByLang = new Map();
  const isNotFound = (p) => p.path === "/404.html";

  for (const p of pages.values()) {
    const indexable = !p.noindex && !isNotFound(p);
    const canonical = p.canonicals[0] ?? null;

    if (p.htmlLang !== p.lang) fail("html-lang", p.path, `<html lang="${p.htmlLang}">, expected "${p.lang}"`);

    const h1s = p.root === null ? -1 : (p.root.match(/<h1\b/g) ?? []).length;
    // 404.html is written without a body (prerender.ts) and rendered in the
    // browser, so an empty root there is the design, not a lost heading.
    const shellOnly = isNotFound(p) && p.root !== null && !p.root.trim();
    if (h1s !== 1 && !shellOnly) fail("h1", p.path, h1s < 0 ? "no #root" : `${h1s} <h1> in #root`);

    // Titles
    const title = p.titles[0] ?? "";
    if (p.titles.length !== 1) fail("title", p.path, `${p.titles.length} <title> tags`);
    else if (p.static && title.length > 80) fail("title", p.path, `${title.length} chars: "${title}"`);
    if (p.static && indexable && !BRAND_RE.test(title)) fail("title-brand", p.path, `no "KF Tech": "${title}"`);
    if (p.cms && indexable && title && !BRAND_RE.test(title)) warn("cms-title-brand", p.path, `"${title}"`);
    if (indexable && title.length > 60) warn("title-long", p.path, `${title.length} chars: "${title}"`);

    // Descriptions
    const desc = collapse(p.descriptions[0] ?? "");
    if (p.descriptions.length !== 1) fail("description", p.path, `${p.descriptions.length} description tags`);
    else if (desc.length > 160) fail("description", p.path, `${desc.length} chars`);
    else if (p.static && !isNotFound(p) && desc.length < 50) fail("description", p.path, `${desc.length} chars`);
    else if (desc.length < 70 && !isNotFound(p)) warn("description-short", p.path, `${desc.length} chars: "${desc}"`);
    if (ENTITY_PAGES.includes(p.base) && !desc.includes(BRAND)) fail("description-brand", p.path, `no "${BRAND}": "${desc}"`);

    if (indexable) {
      if (title) titlesByLang.set(p.lang, [...(titlesByLang.get(p.lang) ?? []), [title, p.path]]);
      if (desc) descsByLang.set(p.lang, [...(descsByLang.get(p.lang) ?? []), [desc, p.path]]);
      if (p.lang === "ar") {
        if (/^[A-Za-z]/.test(title)) warn("arabic-latin-start", p.path, `title "${title}"`);
        if (/^[A-Za-z]/.test(desc)) warn("arabic-latin-start", p.path, `description "${desc.slice(0, 60)}…"`);
      }
      if (!p.static && !p.keywords.some((k) => k.trim())) warn("keywords-missing", p.path, "no keywords meta");
    }

    // Robots meta: noindex exactly where it belongs.
    const mustNoindex = isNotFound(p) || NOINDEX_PAGES.has(p.base);
    if (p.robots.length !== 1) fail("robots-meta", p.path, `${p.robots.length} robots meta tags`);
    else if (p.noindex !== mustNoindex) fail("robots-meta", p.path, `robots "${p.robots[0]}"`);

    // Canonical
    if (isNotFound(p)) {
      if (p.canonicals.length) fail("canonical", p.path, "404 page has a canonical");
    } else if (p.canonicals.length !== 1) fail("canonical", p.path, `${p.canonicals.length} canonical links`);
    else if (origin ? canonical !== ownUrl(p) : target(canonical) !== p.path) {
      fail("canonical", p.path, `canonical ${canonical}`);
    }

    // hreflang
    if (p.alternates.length) {
      const problems = [];
      const xd = p.alternates.find((a) => a.hreflang === "x-default");
      const en = p.alternates.find((a) => a.hreflang === "en");
      if (!xd) problems.push("no x-default");
      else if (!en || xd.href !== en.href || target(xd.href) !== p.base) {
        problems.push(`x-default ${xd.href} is not the English page`);
      }
      let self = false;
      for (const a of p.alternates) {
        const url = parse(a.href);
        if (!url || (origin && url.origin !== origin)) {
          problems.push(`${a.hreflang} → ${a.href} is off-site`);
          continue;
        }
        const other = pages.get(keyOf(url));
        if (!other) {
          problems.push(`${a.hreflang} → ${a.href} has no file`);
          continue;
        }
        if (a.hreflang === "x-default") continue;
        if (other.path === p.path) self = true;
        if (other.lang !== a.hreflang) problems.push(`${a.hreflang} → ${other.path} is a ${other.lang} page`);
        if (!other.alternates.some((b) => target(b.href) === p.path)) problems.push(`${other.path} does not link back`);
      }
      if (!self) problems.push("the page is not in its own cluster");
      if (problems.length) fail("hreflang", p.path, problems.join("; "));
    } else if (indexable) {
      const siblings = langs.filter((l) => l !== p.lang && pages.has(localePath(l, p.base)));
      if (siblings.length) fail("hreflang", p.path, `no hreflang although ${siblings.join("/")} versions exist`);
    }

    // Open Graph
    const og = [];
    if (p.og.siteName.length !== 1 || p.og.siteName[0] !== BRAND) og.push(`og:site_name "${p.og.siteName.join("|")}"`);
    if (canonical && p.og.url[0] !== canonical) og.push(`og:url ${p.og.url[0] ?? "missing"} ≠ canonical`);
    if (p.og.locale[0] !== OG_LOCALE[p.lang]) og.push(`og:locale "${p.og.locale[0] ?? ""}", expected ${OG_LOCALE[p.lang]}`);
    if (p.og.image[0]) {
      const img = parse(p.og.image[0]);
      if (origin && sameSite(img) && !serves(keyOf(img))) og.push(`og:image ${p.og.image[0]} has no file`);
      if (!p.og.imageWidth.length || !p.og.imageHeight.length) warn("og-image-size", p.path, "og:image without width/height");
    }
    if (og.length) fail("og", p.path, og.join("; "));

    // JSON-LD
    const blocks = [];
    p.ld.forEach((src, i) => {
      try {
        blocks.push(JSON.parse(src));
      } catch (e) {
        fail("jsonld-parse", p.path, `block ${i + 1}: ${e.message}`);
      }
    });
    const typed = [];
    const refs = [];
    const ids = new Set();
    const reviewKeys = new Set();
    walk(blocks, (node) => {
      if (typeof node["@id"] === "string") {
        if (node["@type"]) ids.add(node["@id"]);
        else refs.push(node["@id"]);
      }
      if (node["@type"]) typed.push(node);
      for (const k of ["aggregateRating", "review", "reviews"]) if (k in node) reviewKeys.add(k);
    });
    const orgs = typed.filter((n) => typeof n["@id"] === "string" && n["@id"].endsWith("/#organization"));
    if (orgs.length !== 1) fail("jsonld-organization", p.path, `${orgs.length} #organization nodes`);
    else {
      const o = orgs[0];
      const missing = [];
      if (!typesOf(o).includes("Organization")) missing.push("@type Organization");
      if (o.name !== BRAND) missing.push(`name "${BRAND}"`);
      if (!String(o.founder?.["@id"] ?? "").endsWith("/about#founder")) missing.push("founder @id /about#founder");
      if (!o.foundingDate) missing.push("foundingDate");
      if (!o.disambiguatingDescription) missing.push("disambiguatingDescription");
      const alt = [].concat(o.alternateName ?? []);
      for (const a of ["KFTech", ARABIC_ALIAS]) if (!alt.includes(a)) missing.push(`alternateName "${a}"`);
      if (!o.numberOfEmployees) missing.push("numberOfEmployees");
      if (missing.length) fail("jsonld-organization", p.path, `missing ${missing.join(", ")}`);
    }
    const sites = typed.filter((n) => typeof n["@id"] === "string" && n["@id"].endsWith("/#website"));
    if (sites.length !== 1) fail("jsonld-website", p.path, `${sites.length} #website nodes`);
    // `name` as well: an article's `mainEntityOfPage: {"@type": "WebPage", "@id"}`
    // is a typed pointer, not the node it points at.
    const isWebPage = (n) => n["@id"] === canonical && n.name && typesOf(n).some((t) => WEBPAGE_TYPES.has(t));
    if (indexable && !typed.some(isWebPage)) {
      fail("jsonld-webpage", p.path, `no WebPage node with @id ${canonical ?? "(no canonical)"}`);
    }
    if (p.base === "/about") {
      const about = typed.find((n) => typesOf(n).includes("AboutPage") && typesOf(n).includes("ProfilePage"));
      const main = about?.mainEntity;
      if (!about) fail("jsonld-about", p.path, "no AboutPage+ProfilePage node");
      else if (!String(main?.["@id"] ?? "").endsWith("/about#founder") || !main?.name) {
        fail("jsonld-about", p.path, "mainEntity is not the inlined founder");
      }
    }
    const faqs = typed.filter((n) => typesOf(n).includes("FAQPage")).length;
    if (faqs > 1) fail("jsonld-faq", p.path, `${faqs} FAQPage nodes`);
    if (reviewKeys.size) fail("jsonld-no-reviews", p.path, [...reviewKeys].join(", "));
    const unresolved = [...new Set(refs.filter((r) => !ids.has(r)))];
    const core = unresolved.filter((r) => CORE_REF.test(r));
    if (core.length) fail("jsonld-refs", p.path, `unresolved ${core.join(", ")}`);
    const other = unresolved.filter((r) => !CORE_REF.test(r));
    if (other.length) warn("jsonld-refs-other", p.path, `unresolved ${other.join(", ")}`);

    // Visible text
    const says = (s) => p.text.some((t) => t.includes(s));
    if (ENTITY_PAGES.includes(p.base)) {
      const missing = [];
      if (!says(BRAND)) missing.push(`"${BRAND}"`);
      if (p.lang === "ar" && !says(ARABIC_ALIAS)) missing.push(`"${ARABIC_ALIAS}"`);
      if (missing.length) fail("visible-brand", p.path, `#root text lacks ${missing.join(", ")}`);
    }
    if (p.base === "/about") {
      const missing = [];
      if (!/\bid="founder"/.test(p.root ?? "")) missing.push('id="founder"');
      for (const s of [FOUNDED, NOT_AFFILIATED_HOST, OFFICIAL_HOST]) if (!says(s)) missing.push(s);
      if (missing.length) fail("about-facts", p.path, `missing ${missing.join(", ")}`);
    }

    // Same-site links
    const broken = [];
    for (const href of new Set(p.hrefs)) {
      if (!href || /^(#|mailto:|tel:|sms:|javascript:|data:)/i.test(href)) continue;
      const url = parse(href, p.path);
      if (!sameSite(url)) continue;
      const key = keyOf(url) + url.search;
      if (!linkCache.has(key)) linkCache.set(key, serves(keyOf(url)) || routedByVercel(url, vercelConfig));
      if (!linkCache.get(key)) broken.push(href);
    }
    // Nav and footer links are identical on every page, so a static page is
    // where a broken link from code shows up. On an article, case study or
    // service page the broken one is almost always in text an editor typed in
    // the dashboard: a warning, or one typo would block every deploy.
    if (broken.length) (p.editorText ? warn : fail)("links", p.path, `${broken.length} broken: ${broken.slice(0, 3).join(", ")}`);

    // Markdown twins
    for (const href of p.twins) {
      const url = parse(href, p.path);
      if (!sameSite(url) || !has(keyOf(url))) {
        fail("markdown-twin", p.path, `${href} has no file`);
        continue;
      }
      const lines = (await read(keyOf(url).slice(1))).split("\n").slice(0, 40);
      const head = lines.join("\n");
      const rawNamed = lines
        .map((l) => /^(?:title:\s*|#\s+)(.+)$/.exec(l)?.[1])
        .find(Boolean);
      // Same normalisation as the HTML <title> (collapse turns French
      // non-breaking spaces into plain ones), or every "Titre : …" mismatches.
      const named = rawNamed === undefined ? undefined : collapse(unquote(rawNamed));
      const problems = [];
      if (!named || !(title.startsWith(named) || named.startsWith(title))) problems.push(`title "${named ?? ""}" ≠ "${title}"`);
      if (canonical && !head.includes(canonical)) problems.push(`no ${canonical} in its front block`);
      if (problems.length) fail("markdown-twin", p.path, `${href}: ${problems.join("; ")}`);
    }
  }

  for (const [check, byLang] of [
    ["duplicate-title", titlesByLang],
    ["duplicate-description", descsByLang],
  ]) {
    for (const list of byLang.values()) {
      const seen = new Map();
      for (const [text, path] of list) seen.set(text, [...(seen.get(text) ?? []), path]);
      for (const paths of seen.values()) if (paths.length > 1) for (const path of paths) warn(check, path, `same as ${paths.filter((x) => x !== path).join(", ")}`);
    }
  }

  // --- cross-file -------------------------------------------------------------
  ran("files", "article-shell", "sitemap", "sitemap-coverage", "sitemap-lastmod", "robots-txt", "robots-ai-groups", "robots-content-signal", "llms-txt");

  const required = [
    "robots.txt",
    "sitemap.xml",
    "llms.txt",
    "llms-full.txt",
    "feed.xml",
    ...langs.filter((l) => l !== "en").map((l) => `${l}/feed.xml`),
    "404.html",
    "article-shell.html",
    "seo-defaults.json",
  ];
  for (const f of required) if (!has(f)) fail("files", `/${f}`, "missing");
  if (![...files].some((f) => /^[a-f0-9]{32}\.txt$/.test(f))) fail("files", "/<key>.txt", "no IndexNow key file");

  if (has("article-shell.html")) {
    const shell = readPage("/article-shell.html", "article-shell.html", await read("article-shell.html"));
    if (!shell.noindex) fail("article-shell", shell.path, "not noindex");
  }

  if (has("sitemap.xml")) {
    const xml = await read("sitemap.xml");
    const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({
      loc: decode(/<loc>([^<]*)<\/loc>/.exec(m[1])?.[1]?.trim() ?? ""),
      lastmod: /<lastmod>([^<]*)<\/lastmod>/.exec(m[1])?.[1]?.trim() ?? "",
    }));
    const listed = new Set();
    for (const { loc } of entries) {
      const url = parse(loc);
      if (!url) {
        fail("sitemap", "/sitemap.xml", `bad <loc> ${loc}`);
        continue;
      }
      const key = keyOf(url);
      listed.add(key);
      if (origin && !loc.startsWith(origin)) fail("sitemap", key, `<loc> ${loc} is not on ${origin}`);
      if (key.endsWith(".md")) fail("sitemap", key, "a Markdown twin is listed");
      const page = pages.get(key);
      if (!page) fail("sitemap", key, "listed but has no file");
      else if (page.noindex || isNotFound(page)) fail("sitemap", key, "listed but noindex");
      else if (page.canonicals[0] !== loc) fail("sitemap", key, `canonical ${page.canonicals[0] ?? "missing"} ≠ <loc>`);
    }
    for (const p of pages.values()) {
      if (!p.noindex && !isNotFound(p) && !listed.has(p.path)) fail("sitemap-coverage", p.path, "indexable but not in sitemap.xml");
    }
    const day = today ?? new Date().toISOString().slice(0, 10);
    const bad = entries.filter((e) => !/^\d{4}-\d{2}-\d{2}$/.test(e.lastmod));
    for (const e of bad.slice(0, 20)) fail("sitemap-lastmod", target(e.loc) ?? e.loc, `lastmod "${e.lastmod}"`);
    if (entries.length && !bad.length && entries.every((e) => e.lastmod === day)) {
      fail("sitemap-lastmod", "/sitemap.xml", `every lastmod is today (${day}): lastmod carries no information`);
    }
  }

  if (has("robots.txt")) {
    const groups = [];
    const sitemaps = [];
    let current = null;
    let afterAgent = false;
    for (const raw of (await read("robots.txt")).split(/\r?\n/)) {
      const line = raw.replace(/#.*/, "").trim();
      const colon = line.indexOf(":");
      if (colon < 0) continue;
      const key = line.slice(0, colon).trim().toLowerCase();
      const value = line.slice(colon + 1).trim();
      if (key === "user-agent") {
        if (!current || !afterAgent) groups.push((current = { agents: [], disallow: [], signal: null }));
        current.agents.push(value);
        afterAgent = true;
        continue;
      }
      afterAgent = false;
      if (key === "sitemap") sitemaps.push(value);
      else if (current && key === "disallow" && value) current.disallow.push(value);
      else if (current && key === "content-signal") current.signal = value;
    }
    if (!sitemaps.length) fail("robots-txt", "/robots.txt", "no Sitemap: line");
    else if (origin && !sitemaps.includes(`${origin}/sitemap.xml`)) fail("robots-txt", "/robots.txt", `Sitemap: ${sitemaps[0]}`);
    for (const ua of AI_GROUPS) if (!groups.some((g) => g.agents.includes(ua))) fail("robots-txt", "/robots.txt", `no User-agent: ${ua} group`);
    const star = groups.find((g) => g.agents.includes("*"));
    if (!star) fail("robots-txt", "/robots.txt", "no User-agent: * group");
    else {
      if (!star.signal) fail("robots-content-signal", "/robots.txt", "no Content-Signal under User-agent: *");
      // A crawler obeys only the most specific group naming it (RFC 9309), so
      // a group without the `*` rules lets that crawler into the private paths.
      const short = groups.filter((g) => g !== star && (star.disallow.some((d) => !g.disallow.includes(d)) || !g.signal || g.signal !== star.signal));
      if (short.length) {
        const agents = short.flatMap((g) => g.agents);
        fail(
          "robots-ai-groups",
          "/robots.txt",
          `${agents.length} group(s) lack the * Disallow lines or Content-Signal: ${agents.slice(0, 5).join(", ")}${agents.length > 5 ? ", …" : ""}`,
        );
      }
    }
  }

  if (has("llms.txt")) {
    const txt = await read("llms.txt");
    const missing = [BRAND, FOUNDER, FOUNDED, NOT_AFFILIATED_HOST, ARABIC_ALIAS, ...(origin ? [origin] : [])].filter((s) => !txt.includes(s));
    if (missing.length) fail("llms-txt", "/llms.txt", `missing ${missing.join(", ")}`);
  }

  return {
    failures,
    warnings,
    stats: { pages: pages.size, files: files.size, checks: [...checks], ms: Math.round(performance.now() - started) },
  };
}
