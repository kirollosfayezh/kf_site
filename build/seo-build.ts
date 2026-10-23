/**
 * Build-time half of the SEO engine.
 *
 * Kept out of `src/` so the Node-only filesystem work never gets pulled into a
 * browser bundle, while still importing the same PAGES table, tag descriptors
 * and article helper the runtime uses — a crawler that never runs JavaScript
 * and a browser that does must not disagree about what a page claims to be.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { writeIndexNowKey } from "./indexnow.ts";
import {
  PAGES,
  LOCALES,
  SERVICES,
  SITE,
  absolute,
  articlePageSeo,
  availableLangs,
  legalPageSeo,
  languageAlternates,
  localePath,
  mergeSeoOverrides,
  projectPageSeo,
  servicePageSeo,
  servicePath,
  serviceLangs,
  resolveDesc,
  resolveTitle,
  seoTags,
  setSiteIdentity,
  siteIdentity,
  tagsToHtml,
  type ArticleLike,
  type Lang,
  type PageSeo,
  type SeoOptions,
  type SeoOverride,
} from "../src/lib/seo.ts";
import { LANGS, dirOf, isLang } from "../src/lib/langs.ts";
import { primeDict, setOverrides, translate } from "../src/lib/dict/index.ts";
import { FALLBACK_FAQS } from "../src/lib/fallback-content.ts";
import { extractFaq } from "../src/lib/faq.ts";
import { identityFromSettings } from "../src/lib/contact.ts";
import type { SiteSettings } from "../src/services/api-types.ts";
import { bootScript } from "./boot-script.ts";
import ar from "../src/lib/dict/ar.json" with { type: "json" };
import de from "../src/lib/dict/de.json" with { type: "json" };
import fr from "../src/lib/dict/fr.json" with { type: "json" };

const DICTS: Record<Exclude<Lang, "en">, Record<string, string>> = { ar, de, fr };

/**
 * The browser loads one language on demand; the prerender needs all of them at
 * once, because it writes every page in every language in a single pass.
 * Priming the shared cache keeps both halves using one translator, so a page's
 * static HTML and its client-side re-render can never disagree.
 */
primeDict("ar", ar);
primeDict("de", de);
primeDict("fr", fr);

/** Strip the placeholder title/description shipped in index.html so a
 *  generated page doesn't end up declaring each of them twice. */
function stripStaticHead(html: string): string {
  return html
    .replace(/\s*<title>[\s\S]*?<\/title>/i, "")
    .replace(/\s*<meta\s[^>]*name="description"[\s\S]*?>/i, "");
}

/**
 * The Arabic webfont, preloaded on Arabic pages only. It is declared in
 * src/index.css; without the preload it was discovered after the text had
 * painted and the swap shifted the page (CLS 0.25 at 375px). Must match the
 * `src:` of the Alexandria @font-face there — checkArabicFont() warns if not.
 */
export const ARABIC_FONT_URL = "https://fonts.gstatic.com/s/alexandria/v6/UMBXrPdDqW66y0Y2usFeaijdA5E64BdCIg.woff2";
const ARABIC_FONT_PRELOAD = `<link rel="preload" href="${ARABIC_FONT_URL}" as="font" type="font/woff2" crossorigin />`;

/**
 * The display face the hero headline is set in (Space Grotesk 700, Latin
 * subset), preloaded on every page.
 *
 * Google's stylesheet is loaded non-blocking, so the font used to arrive a
 * second or two after the prerendered headline had painted in the fallback
 * face; the swap made the headline bigger, which Chrome records as a *new*
 * largest paint — mobile LCP read 4.4 s for text that had been on screen
 * since 1.1 s. Preloaded, the first paint is in the real face and LCP is the
 * first paint. Google serves this exact file to Chrome and Safari; Firefox
 * gets a different one and ignores the preload. `checkDisplayFont()` warns
 * at build time if Google's stylesheet stops naming it.
 */
export const DISPLAY_FONT_URL = "https://fonts.gstatic.com/s/spacegrotesk/v22/V8mDoQDjQSkFtoMM3T6r8E7mPbF4C_k3HqU.woff2";
const DISPLAY_FONT_PRELOAD = `<link rel="preload" href="${DISPLAY_FONT_URL}" as="font" type="font/woff2" crossorigin />`;
const GOOGLE_FONTS_CSS =
  "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Instrument+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";

/** Asks Google for the stylesheet as Chrome would and checks the preloaded
 *  file is still what it serves. Network trouble is not a build failure. */
export async function checkDisplayFont(): Promise<string | null> {
  try {
    const res = await fetch(GOOGLE_FONTS_CSS, {
      headers: { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const css = await res.text();
    if (css.includes(DISPLAY_FONT_URL)) return null;
    const served = [...new Set(css.match(/https:\/\/fonts\.gstatic\.com\/s\/spacegrotesk\/[^)]+/g) ?? [])];
    // No Space Grotesk files at all means Google answered something other
    // than the stylesheet (a rate-limit page, say) — nothing to compare.
    if (!served.length) return null;
    return (
      `the display font preload (${DISPLAY_FONT_URL}) is no longer in Google's stylesheet — update DISPLAY_FONT_URL ` +
      `in build/seo-build.ts to the Space Grotesk latin file it serves now (served: ${served.join(", ") || "none"})`
    );
  } catch {
    return null;
  }
}

/** Warn when the preload and the stylesheet name different files: the preload
 *  would then fetch a font nothing uses, and Arabic would swap late again. */
export async function checkArabicFont(distDir: string): Promise<string | null> {
  const dir = join(distDir, "assets");
  for (const name of await readdir(dir)) {
    if (name.endsWith(".css") && (await readFile(join(dir, name), "utf8")).includes(ARABIC_FONT_URL)) return null;
  }
  return `the Arabic font preload (${ARABIC_FONT_URL}) matches no @font-face in the built CSS — update ARABIC_FONT_URL in build/seo-build.ts to the src in src/index.css`;
}

/**
 * A function replacer, because in a string replacement `$$` means a literal `$`
 * and `$&` means the match — `priceRange: "$$"` silently shipped as `"$"`, and
 * any `$&`/`$1` in a title or description would be corrupted the same way.
 */
function injectHead(shell: string, head: string): string {
  return shell.replace("</head>", () => `  ${head}\n  </head>`);
}

/* ------------------------------------------------------------- fetching */

/** Thrown when the API could not be read after every retry. */
export class SeoFetchError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Reads one API endpoint, with patience for a sleeping backend.
 *
 * The production build once ran against a Render instance that was still
 * waking up: a single 8-second attempt timed out, the failure was only a
 * warning, and the deploy shipped a sitemap with no blog posts, no case
 * studies and no legal pages. So: four attempts with growing timeouts and
 * backoff, and when they are all spent the caller gets an exception — a red
 * deploy is cheaper than a silently half-indexed site. A 4xx is not retried:
 * that is a wrong URL, and waiting will not fix it.
 */
async function fetchJson<T>(
  apiBase: string | undefined,
  path: string,
  timeouts: number[] = [8000, 12000, 16000, 20000],
): Promise<T | null> {
  if (!apiBase) return null;
  const url = `${apiBase.replace(/\/+$/, "")}${path}`;
  let reason = "";
  for (let attempt = 0; attempt < timeouts.length; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(timeouts[attempt]) });
      if (res.ok) {
        const body = (await res.json()) as { data?: T };
        return (body?.data ?? null) as T | null;
      }
      reason = `HTTP ${res.status}`;
      if (res.status >= 400 && res.status < 500) break;
    } catch (err) {
      reason = err instanceof Error ? err.message : String(err);
    }
    if (attempt < timeouts.length - 1) await sleep(2000 * 2 ** attempt);
  }
  throw new SeoFetchError(`${path}: ${reason}`);
}

async function fetchCollection(apiBase: string | undefined, collection: string): Promise<ArticleLike[]> {
  const items = await fetchJson<ArticleLike[]>(apiBase, `/api/content/${collection}`);
  if (!Array.isArray(items)) return [];
  return items.filter((p) => p.published !== false && (p.slug || p.id));
}

async function fetchArticles(apiBase: string | undefined): Promise<ArticleLike[]> {
  return fetchCollection(apiBase, "blogPosts");
}

/** Projects, for the `/projects/:slug` case-study pages. */
async function fetchProjects(apiBase: string | undefined): Promise<ArticleLike[]> {
  return fetchCollection(apiBase, "projects");
}

/** Privacy policy, terms — rendered at `/legal/:slug`. */
async function fetchLegal(apiBase: string | undefined): Promise<ArticleLike[]> {
  return fetchCollection(apiBase, "legalPages");
}

/**
 * Per-page SEO edited in the dashboard. Fetched at build time so the static
 * HTML a crawler reads carries the edited title and description, not just the
 * client-side re-apply — otherwise an editor's change would be invisible to
 * anything that does not run JavaScript, which is the whole point of the
 * prerender.
 */
export async function fetchSeoOverrides(apiBase: string | undefined): Promise<SeoOverride[]> {
  const rows = await fetchJson<SeoOverride[]>(apiBase, "/api/seo");
  return Array.isArray(rows) ? rows : [];
}

/**
 * Site settings: which languages are switched on, the contact details for the
 * Organization schema, the X handle for the card. Fetched first, alone, with
 * a long first timeout — it is the request that wakes a sleeping backend, so
 * the collections fetched after it in parallel find it already warm.
 */
export async function fetchSettings(apiBase: string | undefined): Promise<SiteSettings | null> {
  return fetchJson<SiteSettings>(apiBase, "/api/content/settings", [60000, 20000, 20000]);
}

/** The languages the site serves: those enabled in settings, English always. */
export function enabledLangs(settings: SiteSettings | null): Lang[] {
  const on = new Set<Lang>(["en"]);
  for (const l of settings?.languages ?? []) {
    if (l.enabled && isLang(l.code)) on.add(l.code);
  }
  return LANGS.filter((l) => on.has(l));
}

/** Interface-copy overrides edited on the dashboard's Translations screen. */
async function fetchTranslations(apiBase: string | undefined, lang: Lang): Promise<Record<string, string>> {
  const map = await fetchJson<Record<string, string>>(apiBase, `/api/translations/${lang}`);
  return map && typeof map === "object" ? map : {};
}

/* --------------------------------------------------------------- context */

/** Everything one build run needs, fetched once and shared by every writer —
 *  so the sitemap and the prerendered pages can never list different sets. */
export interface BuildContext {
  pages: Record<string, PageSeo>;
  settings: SiteSettings | null;
  articles: ArticleLike[];
  projects: ArticleLike[];
  legal: ArticleLike[];
  services: ArticleLike[];
  solutions: ArticleLike[];
  faqs: ArticleLike[];
  testimonials: ArticleLike[];
  aboutSections: ArticleLike[];
  promos: ArticleLike[];
  translations: Partial<Record<Lang, Record<string, string>>>;
  langs: Lang[];
  twitterSite?: string;
  overrides: number;
}

/* ------------------------------------------------------- body prerender */

/** What `src/entry-server.tsx` exports, once built into `dist-ssr/`. */
export interface SsrModule {
  render(path: string, lang: Lang): Promise<{ html: string; hits: Record<string, unknown>; misses: string[]; errors: unknown[] }>;
  primeDict(lang: Lang, data: Record<string, string>): void;
  setOverrides(lang: Lang, data: Record<string, string>): void;
  primeContent(entries: Record<string, unknown>): void;
}

/** Vite's client build manifest: source module → emitted file, its CSS, its imports. */
type Manifest = Record<string, { file: string; css?: string[]; imports?: string[] }>;

/**
 * Which page module renders each route, so its CSS and JavaScript can be
 * linked from the page's head. Every route is `React.lazy`, so its CSS
 * travels with its chunk — a server-rendered body would otherwise paint
 * unstyled until the chunk arrived.
 */
const ROUTE_MODULES: Record<string, string> = {
  "/": "src/pages/Home.tsx",
  "/about": "src/pages/About.tsx",
  "/services": "src/pages/Services.tsx",
  "/solutions": "src/pages/Solutions.tsx",
  "/projects": "src/pages/Projects.tsx",
  "/blog": "src/pages/Blog.tsx",
  "/contact": "src/pages/Contact.tsx",
  "/campaign": "src/pages/Campaign.tsx",
  "/book": "src/pages/Book.tsx",
};

const ITEM_MODULES = {
  article: "src/pages/Article.tsx",
  project: "src/pages/ProjectCaseStudy.tsx",
  legal: "src/pages/Legal.tsx",
  service: "src/pages/ServiceDetail.tsx",
} as const;

/** The homepage intro's engine: a lazy chunk the boot script preloads when the show will play. */
const INTRO_ENGINE_MODULE = "src/intro/engine/engine.ts";

/** The emitted files a module pulls in through static imports, itself included. */
function closure(manifest: Manifest, key: string, js = new Set<string>(), css = new Set<string>()) {
  const entry = manifest[key];
  if (!entry || js.has(entry.file)) return { js, css };
  js.add(entry.file);
  entry.css?.forEach((c) => css.add(c));
  entry.imports?.forEach((k) => closure(manifest, k, js, css));
  return { js, css };
}

/**
 * The `<link>`s a prerendered page needs beyond the shell's.
 *
 * With `cssCodeSplit` off the shell's stylesheet already covers the route,
 * so this is only the route's own CSS should that ever change, plus the
 * dictionary chunk on non-English pages — `main.tsx` awaits it before
 * hydrating, and preloaded it travels with the entry instead of after it.
 *
 * Deliberately no `modulepreload` for the route chunk and its dependencies:
 * on a slow connection those ~150 kB competed with the stylesheet for the
 * bandwidth the first paint was waiting on. The page is readable before
 * hydration, so hydration can start a round trip later.
 */
function assetsFor(manifest: Manifest, moduleKey: string, lang: Lang): string {
  if (!manifest[moduleKey]) throw new Error(`the build manifest has no entry for ${moduleKey}`);
  const base = closure(manifest, "index.html");
  const route = closure(manifest, moduleKey);
  const dict = lang !== "en" ? manifest[`src/lib/dict/${lang}.json`]?.file : undefined;
  return [
    ...[...route.css].filter((c) => !base.css.has(c)).map((c) => `<link rel="stylesheet" crossorigin href="/${c}" />`),
    ...(dict ? [`<link rel="modulepreload" crossorigin href="/${dict}" />`] : []),
  ].join("\n  ");
}

/**
 * A list item, with the bodies the page cannot read left out.
 *
 * `pick()` reads the page's language, then English, then Arabic when English
 * is empty — so those are kept and the rest dropped. Bodies are the bulk of a
 * blog post, and the snapshot is inline in every page.
 */
function pruneForLang<T extends ArticleLike>(item: T, lang: Lang): T {
  if (!item.body) return item;
  // Only the body `pick()` will actually return: this language's when it is
  // written, else English, else Arabic. Keeping English beside a written
  // translation doubled every translated post on every non-English page.
  const keep = new Set<Lang>(
    item.body[lang]?.trim() ? [lang] : item.body.en?.trim() ? [lang, "en"] : [lang, "en", "ar"],
  );
  const body: Partial<Record<Lang, string>> = {};
  for (const l of keep) if (item.body[l] !== undefined) body[l] = item.body[l];
  return { ...item, body };
}

interface PageBody {
  html: string;
  snapshot: string;
  assets: string;
}

/** The cache keys every page can read (the menu and the offer popup are on all of them). */
function listsFor(ctx: BuildContext, lang: Lang): Record<string, unknown> {
  const lists: Record<string, ArticleLike[]> = {
    services: ctx.services,
    solutions: ctx.solutions,
    projects: ctx.projects,
    faqs: ctx.faqs,
    blogPosts: ctx.articles,
    legalPages: ctx.legal,
    testimonials: ctx.testimonials,
    aboutSections: ctx.aboutSections,
    promos: ctx.promos,
  };
  const out: Record<string, unknown> = {};
  for (const [name, items] of Object.entries(lists)) out[`list:${name}`] = items.map((i) => pruneForLang(i, lang));
  // Service cards show the title, summary and points; the long landing-page
  // body is only read on the service's own page, via its item entry.
  out["list:services"] = ctx.services.map((i) => {
    const { body: _body, ...rest } = i;
    const meta = { ...(i.meta ?? {}) };
    for (const k of ["headline", "lede", "seoTitle", "seoDescription"]) delete meta[k];
    return { ...rest, meta };
  });
  return out;
}

/** Items, keyed the way the pages ask for them (by slug, falling back to id). */
function itemEntries(ctx: BuildContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, items] of [["blogPosts", ctx.articles], ["projects", ctx.projects], ["legalPages", ctx.legal], ["services", ctx.services]] as const) {
    for (const item of items) out[`item:${name}:${item.slug || item.id}`] = item;
  }
  return out;
}

function warnOnce(warnings: string[], message: string): void {
  if (!warnings.includes(message)) warnings.push(message);
}

/**
 * Renders one page's body and packs it with the exact content it read.
 *
 * A missing `item:*` is a build error — the URL came from the same list, so
 * the item exists and something failed to prime it; shipping "Loading…" in
 * its place is worse than a red deploy. A missing list or settings means the
 * page rendered with fallback copy, which the client would do too, so that is
 * a warning.
 */
async function renderBody(
  ssr: SsrModule,
  manifest: Manifest,
  ctx: BuildContext,
  page: PageSeo,
  lang: Lang,
  moduleKey: string,
  warnings: string[],
): Promise<PageBody> {
  const where = localePath(lang, page.path);
  const rendered = await ssr.render(page.path, lang);
  const { hits, misses, errors } = rendered;
  if (errors.length) throw new Error(`prerender of ${where} failed: ${errors.map((e) => (e instanceof Error ? e.message : String(e))).join("; ")}`);
  const itemMisses = misses.filter((k) => k.startsWith("item:"));
  if (itemMisses.length) throw new Error(`prerender of ${where} read content nothing primed: ${itemMisses.join(", ")}`);
  for (const key of misses) warnOnce(warnings, `${key} was not available at build time; pages using it were prerendered with fallback copy`);

  // React hoists resource hints (the header logo's image preload) to the
  // front of the markup; they belong in the head, and an element before the
  // app's root div would confuse hydration.
  let hoisted = "";
  const html = rendered.html.replace(/^(?:<link [^>]*\/?>)+/, (m) => {
    hoisted = m;
    return "";
  });
  if (!html.includes("<h1")) throw new Error(`prerender of ${where} produced no <h1> — the page rendered a fallback instead of itself`);
  if (html.includes("kf-page-fallback")) throw new Error(`prerender of ${where} still contains the route's loading fallback`);

  const overrides = ctx.translations[lang];
  const snapshot = {
    v: 1,
    lang,
    content: hits,
    i18n: overrides && Object.keys(overrides).length ? { [lang]: overrides } : {},
  };
  // `<` would end the script element early; the line separators are invalid
  // in JavaScript source but legal in JSON.
  const json = JSON.stringify(snapshot).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  if (json.length > 200_000) {
    const sizes = Object.entries(hits).map(([k, v]) => `${k} ${Math.round(JSON.stringify(v).length / 1024)} kB`).join(", ");
    warnings.push(`${where}: the content snapshot is ${Math.round(json.length / 1024)} kB (${sizes})`);
  }
  const assets = [hoisted, assetsFor(manifest, moduleKey, lang)].filter(Boolean).join("\n  ");
  return { html, snapshot: json, assets };
}

function tagOptions(ctx: BuildContext): SeoOptions {
  return { siteLangs: ctx.langs, twitterSite: ctx.twitterSite };
}

function localized(text: ArticleLike["title"], lang: Lang): string {
  if (!text) return "";
  return text[lang] || text.en || text.ar || "";
}

/**
 * The FAQ list a page renders, in one language: the CMS rows, or the same
 * built-in set the page falls back to. It goes into the static HTML as
 * `FAQPage` so the schema exists before any JavaScript runs.
 */
function faqItems(ctx: BuildContext, lang: Lang): { q: string; a: string }[] {
  if (ctx.faqs.length) {
    return ctx.faqs.map((f) => ({ q: localized(f.title, lang), a: localized(f.body ?? f.summary, lang) }));
  }
  return FALLBACK_FAQS.map((f) => ({ q: translate(f.q, lang), a: translate(f.a, lang) }));
}

/** A page with the per-language extras only the build can fill in. */
function pageFor(ctx: BuildContext, page: PageSeo, lang: Lang): PageSeo {
  if (page.path === PAGES.home.path || page.path === PAGES.contact.path) {
    return { ...page, faq: faqItems(ctx, lang) };
  }
  return page;
}

/* --------------------------------------------------------------- writing */

async function writePage(
  distDir: string,
  shell: string,
  page: PageSeo,
  origin: string,
  file: string,
  lang: Lang = "en",
  opts: SeoOptions = {},
  body?: PageBody,
) {
  // Order: the route's assets (so the stylesheet is discovered early), the
  // Arabic font preload, then the SEO tags.
  const head =
    (body?.assets ? `${body.assets}\n  ` : "") +
    `${DISPLAY_FONT_PRELOAD}\n  ` +
    (lang === "ar" ? `${ARABIC_FONT_PRELOAD}\n  ` : "") +
    tagsToHtml(seoTags(page, lang, origin, opts));
  let html = injectHead(shell, head)
    // The shell is built with lang="en"; each localised file has to declare its
    // own language and direction, or a crawler reads Arabic markup as English
    // and a reader gets LTR text before hydration corrects it.
    .replace(/<html lang="[^"]*"( dir="[^"]*")?/i, `<html lang="${lang}" dir="${dirOf(lang)}"`);
  if (body) {
    // The rendered page, plus the content it was rendered from as JSON (not a
    // script that runs — nothing executes to hand the data over).
    html = html.replace(
      '<div id="root"></div>',
      () => `<div id="root">${body.html}</div>\n    <script id="kf-content" type="application/json">${body.snapshot}</script>`,
    );
  }
  const target = join(distDir, file);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html, "utf8");
}

/** `/services` → `services/index.html`; `/` → `index.html`. */
function fileFor(path: string): string {
  return path === "/" ? "index.html" : join(path.replace(/^\//, ""), "index.html");
}

export interface PrerenderResult {
  routes: number;
  articles: number;
  projects: number;
  legal: number;
  services: number;
}

export async function prerenderPages(
  distDir: string,
  origin: string,
  ctx: BuildContext,
  ssr: SsrModule | null,
  manifest: Manifest | null,
  warnings: string[],
): Promise<PrerenderResult> {
  // The boot script (theme + language redirect before paint) goes into the
  // shell itself, so the shell-served pages carry it too.
  const introChunks = manifest ? [...closure(manifest, INTRO_ENGINE_MODULE).js].map((f) => `/${f}`) : [];
  if (manifest && !introChunks.length) warnings.push(`the build manifest has no entry for ${INTRO_ENGINE_MODULE}; the intro's chunk will not be preloaded`);
  const shell = injectHead(stripStaticHead(await readFile(join(distDir, "index.html"), "utf8")), bootScript(ctx.langs, introChunks));
  const opts = tagOptions(ctx);
  // `/q` is the client quote page: private links, served by the SPA shell.
  const prerenderable = Object.values(ctx.pages).filter((p) => p.path !== "/404" && p.path !== "/q");

  // With the server bundle present every page gets a real body; without it
  // (a build that only wants the head, e.g. a quick local check) the files
  // are head-only shells, as they were before.
  const withBody = ssr && manifest;
  const bodyFor = (page: PageSeo, lang: Lang, moduleKey: string) =>
    withBody ? renderBody(ssr, manifest, ctx, page, lang, moduleKey, warnings) : Promise.resolve(undefined);

  let pageCount = 0;
  let articleCount = 0;
  let projectCount = 0;
  let legalCount = 0;
  let serviceCount = 0;

  // Every route, in every enabled language, as its own file: `/services` and
  // `/de/services` are separate documents with their own canonical, hreflang
  // set and `<html lang>`. A language switched off in the dashboard gets no
  // files at all — Vercel then answers it with 404.html — rather than pages
  // that render in English under a German URL.
  for (const lang of ctx.langs) {
    // The lists this language's pages read, trimmed to what they can show.
    ssr?.primeContent(listsFor(ctx, lang));

    for (const page of prerenderable) {
      const moduleKey = ROUTE_MODULES[page.path];
      if (!moduleKey) throw new Error(`no page module is registered for ${page.path} (build/seo-build.ts ROUTE_MODULES)`);
      const full = pageFor(ctx, page, lang);
      const body = await bodyFor(full, lang, moduleKey);
      await writePage(distDir, shell, full, origin, fileFor(localePath(lang, page.path)), lang, opts, body);
      pageCount++;
    }

    // Real per-article HTML, so a shared link or a crawler gets the post's
    // own title, description, share image and BlogPosting schema without
    // JavaScript. One document per language the article is actually written
    // in, which for most is English alone. `availableLangs` reports that set,
    // so an Arabic post gets a real `/ar/blog/x` to index while an
    // untranslated one does not claim a page it cannot serve.
    for (const post of ctx.articles) {
      if (!availableLangs(post, ctx.langs).includes(lang)) continue;
      const page = articlePageSeo(post, lang, ctx.langs);
      const body = await bodyFor(page, lang, ITEM_MODULES.article);
      await writePage(distDir, shell, page, origin, fileFor(localePath(lang, page.path)), lang, opts, body);
      articleCount++;
    }

    // Case-study pages, on the same terms as articles.
    for (const item of ctx.projects) {
      if (!availableLangs(item, ctx.langs).includes(lang)) continue;
      const page = projectPageSeo(item, lang, ctx.langs);
      const body = await bodyFor(page, lang, ITEM_MODULES.project);
      await writePage(distDir, shell, page, origin, fileFor(localePath(lang, page.path)), lang, opts, body);
      projectCount++;
    }

    // Service landing pages: English always, other languages once their
    // long-form body is written. The FAQ section goes into the static head.
    for (const item of ctx.services) {
      if (!serviceLangs(item, ctx.langs).includes(lang)) continue;
      const faq = extractFaq(localized(item.body, lang));
      const page = servicePageSeo(item, lang, ctx.langs, faq);
      const body = await bodyFor(page, lang, ITEM_MODULES.service);
      await writePage(distDir, shell, page, origin, fileFor(localePath(lang, page.path)), lang, opts, body);
      serviceCount++;
    }

    // Legal documents, on the same terms.
    for (const doc of ctx.legal) {
      if (!availableLangs(doc, ctx.langs).includes(lang)) continue;
      const page = legalPageSeo(doc, lang, ctx.langs);
      const body = await bodyFor(page, lang, ITEM_MODULES.legal);
      await writePage(distDir, shell, page, origin, fileFor(localePath(lang, page.path)), lang, opts, body);
      legalCount++;
    }
  }

  /**
   * Vercel serves `404.html` — with a real 404 status — for any path matching
   * neither a static file nor a rewrite. Without it the old catch-all rewrite
   * answered junk URLs with the homepage's HTML: a 200, the homepage title and
   * `index,follow` on a URL that doesn't exist.
   */
  await writePage(distDir, shell, ctx.pages.notFound ?? PAGES.notFound, origin, "404.html", "en", opts);

  /**
   * The fallback for articles published after this build. It deliberately
   * carries no canonical and no title of its own: the client fills both in from
   * the API, and a wrong canonical (pointing every new post at /blog, or worse
   * at /) is far more damaging than a page whose tags arrive a moment late.
   *
   * It says noindex itself: the `X-Robots-Tag` header in `vercel.json` only
   * matches a request for `/article-shell.html` by name, never the rewritten
   * `/blog/<anything>` URLs, so every unknown slug (and every untranslated
   * `/de/blog/<english-only-post>`) was answering 200 with the blog's title and
   * an index directive — a soft-404 farm. Every real page is prerendered with
   * its own tags; the client still flips this to index for a post that is
   * published after the build and loads.
   */
  await writeFile(
    join(distDir, "article-shell.html"),
    injectHead(
      shell,
      `<title data-kf-seo="1">${(ctx.pages.blog ?? PAGES.blog).title}</title>\n    ` +
        `<meta name="robots" content="noindex,follow" data-kf-seo="1" />`,
    ),
    "utf8",
  );

  return { routes: pageCount + 1, articles: articleCount, projects: projectCount, legal: legalCount, services: serviceCount };
}

/* --------------------------------------------------------------- sitemap */

/**
 * When each static page's copy last changed, bumped by hand when it does.
 *
 * `lastmod` used to be the build date, so every deploy told Google that all
 * 32 static pages had just changed — which teaches it to ignore the field.
 * The real date is the newer of this table and the newest CMS item the page
 * lists, so a new blog post updates /blog's date and nothing else's.
 */
const PAGE_LASTMOD: Record<string, string> = {
  home: "2026-09-25",
  services: "2026-09-25",
  solutions: "2026-09-24",
  projects: "2026-09-25",
  about: "2026-09-24",
  contact: "2026-09-25",
  blog: "2026-09-24",
  campaign: "2026-09-24",
  book: "2026-09-24",
};

/** Which CMS collections feed each static page. */
function itemsFor(ctx: BuildContext, key: string): ArticleLike[] {
  switch (key) {
    case "home":
      return [...ctx.services, ...ctx.solutions, ...ctx.projects, ...ctx.articles, ...ctx.faqs];
    case "services":
      return ctx.services;
    case "solutions":
      return ctx.solutions;
    case "projects":
      return ctx.projects;
    case "blog":
      return ctx.articles;
    case "contact":
      return ctx.faqs;
    default:
      return [];
  }
}

const day = (iso: string | undefined) => (iso || "").slice(0, 10);

function lastmodFor(ctx: BuildContext, key: string): string {
  const dates = [PAGE_LASTMOD[key] ?? "2026-09-01", ...itemsFor(ctx, key).map((i) => day(i.updatedAt || i.createdAt))];
  return dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().at(-1)!;
}

const ESCAPE: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ESCAPE[c]);

export async function writeSitemap(distDir: string, origin: string, ctx: BuildContext): Promise<number> {
  // Read `noindex` off the merged table, so a page an editor hides in the
  // dashboard leaves the sitemap in the same build.
  const indexable = Object.entries(ctx.pages).filter(([, p]) => !p.noindex && p.path !== "/404" && p.path !== "/q");

  // One <url> per language variant, each carrying the full alternate set — a
  // sitemap that lists only the English URLs leaves the translations
  // undiscoverable except by crawling.
  const entries = [
    ...indexable.flatMap(([key, p]) =>
      ctx.langs.map((lang) => ({
        loc: absolute(origin, localePath(lang, p.path)),
        lastmod: lastmodFor(ctx, key),
        priority: p.path === "/" ? "1.0" : "0.8",
        path: p.path,
        alternates: ctx.langs.length > 1,
        langs: ctx.langs,
        image: undefined as string | undefined,
      })),
    ),
    // One <url> per language the item genuinely exists in — never four URLs
    // that all resolve to the same English document.
    ...[
      ...ctx.services.map((item) => ({ item, seo: servicePageSeo(item, "en", ctx.langs), priority: "0.8" })),
      ...ctx.projects.map((item) => ({ item, seo: projectPageSeo(item, "en", ctx.langs), priority: "0.7" })),
      ...ctx.articles.map((item) => ({ item, seo: articlePageSeo(item, "en", ctx.langs), priority: "0.6" })),
      ...ctx.legal.map((item) => ({ item, seo: legalPageSeo(item, "en", ctx.langs), priority: "0.3" })),
    ].flatMap(({ item, seo, priority }) => {
      const langs = seo.langs ?? (["en"] as Lang[]);
      return langs.map((lang) => ({
        loc: absolute(origin, localePath(lang, seo.path)),
        // Never "now": a date that changes every deploy is a date Google
        // learns to ignore.
        lastmod: day(item.updatedAt || item.createdAt) || PAGE_LASTMOD.home,
        priority,
        path: seo.path,
        alternates: langs.length > 1,
        langs,
        image: seo.image ? absolute(origin, seo.image) : undefined,
      }));
    }),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries
  .map(
    (e) => `  <url>
    <loc>${esc(e.loc)}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <priority>${e.priority}</priority>${
      e.alternates
        ? `\n${languageAlternates(origin, e.path, e.langs)
            .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${esc(a.href)}" />`)
            .join("\n")}`
        : ""
    }${e.image ? `\n    <image:image>\n      <image:loc>${esc(e.image)}</image:loc>\n    </image:image>` : ""}
  </url>`,
  )
  .join("\n")}
</urlset>
`;

  await writeFile(join(distDir, "sitemap.xml"), xml, "utf8");
  return entries.length;
}

/* ----------------------------------------------------------------- feeds */

/**
 * One RSS 2.0 feed per enabled language: `/feed.xml` for English and
 * `/<lang>/feed.xml` for the rest, each listing the posts written in that
 * language. A feed with no items is still a valid feed — better than a
 * language whose feed link 404s.
 */
export async function writeFeeds(distDir: string, origin: string, ctx: BuildContext): Promise<number> {
  const rfc822 = (iso: string | undefined) => {
    const d = new Date(iso || 0);
    return Number.isNaN(d.getTime()) ? new Date(0).toUTCString() : d.toUTCString();
  };
  let count = 0;
  for (const lang of ctx.langs) {
    const posts = ctx.articles
      .filter((p) => availableLangs(p, ctx.langs).includes(lang))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const self = absolute(origin, localePath(lang, "/feed.xml"));
    const blog = ctx.pages.blog ?? PAGES.blog;
    const newest = posts.map((p) => p.updatedAt || p.createdAt).sort().at(-1);
    const items = posts
      .map((post) => {
        const page = articlePageSeo(post, lang, ctx.langs);
        const link = absolute(origin, localePath(lang, page.path));
        const category = typeof post.meta?.tag === "string" ? post.meta.tag : "";
        return `    <item>
      <title>${esc(resolveTitle(page, lang).split(" | ")[0])}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="true">${esc(link)}</guid>
      <pubDate>${rfc822(post.createdAt)}</pubDate>
      <description>${esc(resolveDesc(page, lang))}</description>${
        category ? `\n      <category>${esc(category)}</category>` : ""
      }
    </item>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(resolveTitle(blog, lang).split(" | ")[0])}</title>
    <link>${esc(absolute(origin, localePath(lang, blog.path)))}</link>
    <description>${esc(resolveDesc(blog, lang))}</description>
    <language>${LOCALES[lang].hreflang}</language>
    <lastBuildDate>${rfc822(newest)}</lastBuildDate>
    <atom:link href="${esc(self)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
    const target = join(distDir, localePath(lang, "/feed.xml").replace(/^\//, ""));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, xml, "utf8");
    count++;
  }
  return count;
}

/* ---------------------------------------------------------------- robots */

/**
 * Assistant crawlers, as distinct from the search crawlers above.
 *
 * What this list actually does is narrow: it removes any ambiguity for a
 * crawler that reads its own token before falling back to `User-agent: *`. It
 * does not make the site "eligible to be cited" — citation follows from the
 * content, and the two agents that fetch pages for ChatGPT answers are
 * `OAI-SearchBot` and `ChatGPT-User`; `GPTBot` is training-only.
 *
 * `Google-Extended` is listed for completeness but controls Gemini training
 * and grounding only — AI Overviews follow ordinary Googlebot rules and cannot
 * be opted out of separately.
 *
 * Remove a line here to opt that assistant out; the file is generated, so edit
 * this list rather than the built artifact.
 */
const AI_CRAWLERS = [
  "GPTBot", // ChatGPT browsing / training
  "OAI-SearchBot", // ChatGPT search
  "ChatGPT-User", // user-initiated ChatGPT fetches
  "ClaudeBot", // Claude training
  "Claude-User", // user-initiated Claude fetches
  "Claude-SearchBot", // Claude search indexing
  "PerplexityBot",
  "Perplexity-User",
  // Gemini and grounding in other Google products. It does NOT control AI
  // Overviews — those follow ordinary Googlebot rules and nosnippet.
  "Google-Extended",
  "Applebot-Extended",
  "CCBot", // Common Crawl, which many models train from
  "cohere-ai",
  "meta-externalagent",
  "DuckAssistBot", // DuckDuckGo's AI answers
  "MistralAI-User", // Le Chat fetches
  "Amazonbot", // Alexa answers
];

export async function writeRobots(distDir: string, origin: string): Promise<void> {
  // /campaign is noindex, which a crawler can only discover by fetching it —
  // disallowing it here would hide that directive and risk it being indexed
  // on the strength of inbound links alone. Private quote links and the
  // client-side shell, on the other hand, have nothing to index and every
  // reason not to be crawled.
  const disallow = ["/q/", ...LANGS.filter((l) => l !== "en").map((l) => `/${l}/q/`), "/article-shell.html"];
  const txt = `User-agent: *
Allow: /
${disallow.map((p) => `Disallow: ${p}`).join("\n")}

${AI_CRAWLERS.map((ua) => `User-agent: ${ua}\nAllow: /`).join("\n\n")}

Sitemap: ${origin}/sitemap.xml
`;
  await writeFile(join(distDir, "robots.txt"), txt, "utf8");
}

/* -------------------------------------------------------------- llms.txt */

const LANGUAGE_NAMES: Record<Lang, string> = { en: "English", ar: "Arabic", de: "German", fr: "French" };

/**
 * `llms.txt` — a plain-Markdown map of the site for assistants, at the
 * convention's fixed path. An assistant answering "who builds POS systems in
 * Cairo?" reads this instead of guessing from a JavaScript bundle it cannot
 * execute, so the facts it repeats are the ones written here.
 *
 * Kept generated rather than hand-written so it cannot drift from PAGES and the
 * live article list the sitemap uses.
 */
/**
 * `seo-defaults.json` — the built-in title and description of every page the
 * dashboard's SEO screen can override, per language. The dashboard reads it to
 * show what a blank field actually falls back to, instead of "Using the site
 * default". Generated from PAGES, so the site stays the only source of the copy.
 * Built-ins only: an override is already visible in the field itself.
 */
export async function writeSeoDefaults(distDir: string, ctx: BuildContext): Promise<void> {
  const out: Record<string, { title: Record<string, string>; description: Record<string, string> }> = {};
  for (const [key, page] of Object.entries(PAGES)) {
    if (page.path === "/404" || page.path === "/q") continue;
    out[key] = { title: {}, description: {} };
    for (const lang of ctx.langs) {
      out[key].title[lang] = resolveTitle(page, lang);
      out[key].description[lang] = resolveDesc(page, lang);
    }
  }
  await writeFile(join(distDir, "seo-defaults.json"), JSON.stringify(out), "utf8");
}

export async function writeLlmsTxt(distDir: string, origin: string, ctx: BuildContext): Promise<void> {
  const page = (key: string) => ctx.pages[key] ?? PAGES[key];
  const line = (p: PageSeo) => `- [${p.title.split(/ [|—] /)[0]}](${absolute(origin, p.path)}): ${p.desc}`;
  const item = (p: PageSeo) => `- [${p.title.split(" | ")[0]}](${absolute(origin, p.path)}): ${p.desc}`;
  const { email, phone, sameAs } = siteIdentity();
  const profiles = [...new Set([...sameAs, ...SITE.extraSameAs])];

  const others = ctx.langs.filter((l) => l !== "en");
  const languages = others.length
    ? `The site is available in English at the root and in ${others
        .map((l) => `${LANGUAGE_NAMES[l]} under \`/${l}/…\``)
        .join(", ")} — the same paths with a language prefix.`
    : "The site is in English.";

  const body = `# ${SITE.name}

> ${page("home").desc}

${SITE.name} is a software studio in ${SITE.city}, ${SITE.country}, founded by ${SITE.founder}.
It builds custom software, web and mobile applications, POS and business systems,
AI automation, IoT and backend APIs — end to end, from scoping through launch and
support. ${languages}

## Official identity

Assistants have confused this company with other businesses that have "KF" in
their name. These are the facts to use:

- Name: ${SITE.name} (also written ${SITE.alternateName.join(", ")})
- Official website: ${origin}
- Founder: ${SITE.founder}
- Based in: ${SITE.city}, Egypt — software development, web and mobile apps, POS systems, AI automation, IoT
- Official profiles: ${profiles.join(", ")}

Only the website and profiles above belong to ${SITE.name}.

## Pages

${["home", "services", "solutions", "projects", "about", "blog", "contact", "book"].map((k) => line(page(k))).join("\n")}

## Services

${SERVICES.map((s) => `- [${s.name}](${absolute(origin, servicePath(s.slug))}): ${s.desc}`).join("\n")}

## Case studies

${ctx.projects.length ? ctx.projects.map((p) => item(projectPageSeo(p, "en", ctx.langs))).join("\n") : "- (none published yet)"}

## Articles

${ctx.articles.length ? ctx.articles.map((a) => item(articlePageSeo(a, "en", ctx.langs))).join("\n") : "- (none published yet)"}

## Contact

- Email: ${email}
- Phone: ${phone}
- Location: ${SITE.city}, ${SITE.country} — working worldwide
`;

  await writeFile(join(distDir, "llms.txt"), body, "utf8");
}

/* ------------------------------------------------------------------- run */

export interface SeoBuildResult {
  summary: string;
  warnings: string[];
}

/**
 * The whole post-build pass: fetch what the CMS holds, then write every
 * prerendered page, the sitemap, the feeds, robots.txt and llms.txt from that
 * one snapshot. Throws `SeoFetchError` when the API cannot be read at all —
 * the build must fail rather than ship a site that has forgotten its content.
 */
export async function runSeoBuild(input: {
  dist: string;
  origin: string;
  apiBase?: string;
  /** The built server bundle; without it pages are head-only shells. */
  ssr?: SsrModule | null;
  manifestPath?: string;
}): Promise<SeoBuildResult> {
  const { dist, origin, apiBase, ssr = null } = input;
  const warnings: string[] = [];

  const settings = await fetchSettings(apiBase);
  const langs = enabledLangs(settings);
  const [articles, projects, legal, services, solutions, faqs, testimonials, aboutSections, promos, overrides, ...translationMaps] =
    await Promise.all([
      fetchArticles(apiBase),
      fetchProjects(apiBase),
      fetchLegal(apiBase),
      fetchCollection(apiBase, "services"),
      fetchCollection(apiBase, "solutions"),
      fetchCollection(apiBase, "faqs"),
      fetchCollection(apiBase, "testimonials"),
      fetchCollection(apiBase, "aboutSections"),
      fetchCollection(apiBase, "promos"),
      fetchSeoOverrides(apiBase),
      ...langs.map((l) => fetchTranslations(apiBase, l)),
    ]);
  const translations: Partial<Record<Lang, Record<string, string>>> = {};
  langs.forEach((l, i) => {
    translations[l] = translationMaps[i] as Record<string, string>;
  });

  // The Organization schema carries whatever an editor put in Site settings,
  // exactly as the running site will once it has fetched them.
  setSiteIdentity(identityFromSettings(settings));
  // Dashboard wording overrides reach the <title> and description through the
  // same translator the page body uses.
  for (const l of langs) setOverrides(l, translations[l] ?? {});

  const ctx: BuildContext = {
    // Dashboard edits win over the compiled-in PAGES table, so the static
    // HTML matches what the editor sees on the site.
    pages: mergeSeoOverrides(overrides),
    settings,
    articles,
    projects,
    legal,
    services,
    solutions,
    faqs,
    testimonials,
    aboutSections,
    promos,
    translations,
    langs,
    twitterSite: settings?.social?.x?.trim() || undefined,
    overrides: overrides.length,
  };

  if (apiBase && !articles.length) {
    warnings.push(`No blog posts came back from ${apiBase}. The collection is empty: nothing to prerender or list for /blog.`);
  }

  // The server bundle has its own dictionary and content cache; it is primed
  // with the same data the head is built from, so the two cannot disagree.
  let manifest: Manifest | null = null;
  if (ssr) {
    if (!input.manifestPath) throw new Error("a server bundle needs the client build manifest (manifestPath)");
    manifest = JSON.parse(await readFile(input.manifestPath, "utf8")) as Manifest;
    for (const [l, dict] of Object.entries(DICTS)) ssr.primeDict(l as Lang, dict);
    for (const l of langs) ssr.setOverrides(l, translations[l] ?? {});
    ssr.primeContent({ ...(settings ? { settings } : {}), ...itemEntries(ctx) });
    for (const l of LANGS) {
      const chunk = manifest[`src/lib/dict/${l}.json`];
      if (l !== "en" && !chunk) throw new Error(`the build manifest has no chunk for the ${l} dictionary`);
    }
  }

  // Always prerender: the per-route HTML files are what let vercel.json
  // narrow its rewrite to /blog/*, so that unknown paths reach 404.html
  // instead of the homepage. Skipping this would 404 every real route.
  const counts = await prerenderPages(dist, origin, ctx, ssr, manifest, warnings);

  const fontDrift = await checkArabicFont(dist);
  if (fontDrift) warnings.push(fontDrift);
  const displayDrift = await checkDisplayFont();
  if (displayDrift) warnings.push(displayDrift);

  const prerendered =
    `prerendered ${counts.routes} routes + ${counts.articles} articles + ${counts.projects} case studies + ${counts.services} services + ` +
    `${counts.legal} legal (${ctx.langs.join(", ")}${ssr ? ", full pages" : ", head only"})`;

  if (!origin) return { summary: `SEO: ${prerendered} (no origin set)`, warnings };

  const urls = await writeSitemap(dist, origin, ctx);
  const feeds = await writeFeeds(dist, origin, ctx);
  await writeRobots(dist, origin);
  await writeLlmsTxt(dist, origin, ctx);
  await writeSeoDefaults(dist, ctx);
  await writeIndexNowKey(dist);

  return {
    summary:
      `SEO: ${prerendered}, sitemap.xml with ${urls} URLs, ${feeds} feed(s), robots.txt + llms.txt` +
      `${ctx.overrides ? `, ${ctx.overrides} dashboard override(s)` : ""} (origin ${origin})`,
    warnings,
  };
}

export { fetchArticles, fetchProjects, fetchLegal, fetchCollection };
