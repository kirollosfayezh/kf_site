/** Rendering every route, article, case study, service and legal page to static HTML with its content snapshot. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  PAGES,
  articlePageSeo,
  availableLangs,
  legalPageSeo,
  localePath,
  projectPageSeo,
  servicePageSeo,
  serviceLangs,
  seoTags,
  tagsToHtml,
  type ArticleLike,
  type Lang,
  type PageSeo,
  type SeoOptions,
} from "../../src/lib/seo/index.ts";
import { dirOf } from "../../src/lib/langs.ts";
import { translate } from "../../src/lib/dict/index.ts";
import { FALLBACK_FAQS } from "../../src/lib/fallback-content.ts";
import { extractFaq } from "../../src/lib/faq.ts";
import { bootScript } from "../boot-script.ts";
import {
  INTRO_ENGINE_MODULE,
  ITEM_MODULES,
  type Manifest,
  ROUTE_MODULES,
  type SsrModule,
  assetsFor,
  closure,
} from "./assets.ts";
import type { BuildContext } from "./context.ts";
import { ARABIC_FONT_PRELOAD, DISPLAY_FONT_PRELOAD, injectHead, stripStaticHead } from "./head.ts";

/**
 * A list item, with the bodies the page cannot read left out.
 *
 * `pick()` reads the page's language, then English, then Arabic when English
 * is empty — so those are kept and the rest dropped. Bodies are the bulk of a
 * blog post, and the snapshot is inline in every page.
 */
export function pruneForLang<T extends ArticleLike>(item: T, lang: Lang): T {
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

export interface PageBody {
  html: string;
  snapshot: string;
  assets: string;
}

/** The cache keys every page can read (the menu and the offer popup are on all of them). */
export function listsFor(ctx: BuildContext, lang: Lang): Record<string, unknown> {
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
export function itemEntries(ctx: BuildContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, items] of [["blogPosts", ctx.articles], ["projects", ctx.projects], ["legalPages", ctx.legal], ["services", ctx.services]] as const) {
    for (const item of items) out[`item:${name}:${item.slug || item.id}`] = item;
  }
  return out;
}

export function warnOnce(warnings: string[], message: string): void {
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
export async function renderBody(
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

export function tagOptions(ctx: BuildContext): SeoOptions {
  return { siteLangs: ctx.langs, twitterSite: ctx.twitterSite };
}

export function localized(text: ArticleLike["title"], lang: Lang): string {
  if (!text) return "";
  return text[lang] || text.en || text.ar || "";
}

/**
 * The FAQ list a page renders, in one language: the CMS rows, or the same
 * built-in set the page falls back to. It goes into the static HTML as
 * `FAQPage` so the schema exists before any JavaScript runs.
 */
export function faqItems(ctx: BuildContext, lang: Lang): { q: string; a: string }[] {
  if (ctx.faqs.length) {
    return ctx.faqs.map((f) => ({ q: localized(f.title, lang), a: localized(f.body ?? f.summary, lang) }));
  }
  return FALLBACK_FAQS.map((f) => ({ q: translate(f.q, lang), a: translate(f.a, lang) }));
}

/** A page with the per-language extras only the build can fill in. */
export function pageFor(ctx: BuildContext, page: PageSeo, lang: Lang): PageSeo {
  if (page.path === PAGES.home.path || page.path === PAGES.contact.path) {
    return { ...page, faq: faqItems(ctx, lang) };
  }
  return page;
}

/* --------------------------------------------------------------- writing */

export async function writePage(
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
export function fileFor(path: string): string {
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
