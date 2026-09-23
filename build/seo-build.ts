/**
 * Build-time half of the SEO engine.
 *
 * Kept out of `src/` so the Node-only filesystem work never gets pulled into a
 * browser bundle, while still importing the same PAGES table, tag descriptors
 * and article helper the runtime uses — a crawler that never runs JavaScript
 * and a browser that does must not disagree about what a page claims to be.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  PAGES,
  absolute,
  articlePageSeo,
  projectPageSeo,
  localePath,
  languageAlternates,
  seoTags,
  tagsToHtml,
  SERVICE_SUMMARY,
  SITE,
  type ArticleLike,
  type Lang,
  type PageSeo,
  type SeoOverride,
} from "../src/lib/seo.ts";
import { LANGS, dirOf } from "../src/lib/langs.ts";

/** Strip the placeholder title/description shipped in index.html so a
 *  generated page doesn't end up declaring each of them twice. */
function stripStaticHead(html: string): string {
  return html
    .replace(/\s*<title>[\s\S]*?<\/title>/i, "")
    .replace(/\s*<meta\s[^>]*name="description"[\s\S]*?>/i, "");
}

/**
 * A function replacer, because in a string replacement `$$` means a literal `$`
 * and `$&` means the match — `priceRange: "$$"` silently shipped as `"$"`, and
 * any `$&`/`$1` in a title or description would be corrupted the same way.
 */
function injectHead(shell: string, head: string): string {
  return shell.replace("</head>", () => `  ${head}\n  </head>`);
}

/**
 * Blog URLs and their metadata are CMS-driven, so the only way to learn them is
 * to ask the API. A failure here is not a build failure: the static routes
 * still ship and unknown article URLs fall back to the neutral article shell,
 * which costs far less than a red deploy.
 */
async function fetchJson<T>(apiBase: string | undefined, path: string): Promise<T | null> {
  if (!apiBase) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${apiBase.replace(/\/+$/, "")}${path}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: T };
    return (body?.data ?? null) as T | null;
  } catch {
    return null;
  }
}

async function fetchCollection(
  apiBase: string | undefined,
  collection: string,
): Promise<ArticleLike[]> {
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

async function writePage(
  distDir: string,
  shell: string,
  page: PageSeo,
  origin: string,
  file: string,
  lang: Lang = "en",
) {
  const html = injectHead(shell, tagsToHtml(seoTags(page, lang, origin)))
    // The shell is built with lang="en"; each localised file has to declare its
    // own language and direction, or a crawler reads Arabic markup as English
    // and a reader gets LTR text before hydration corrects it.
    .replace(/<html lang="[^"]*"( dir="[^"]*")?/i, `<html lang="${lang}" dir="${dirOf(lang)}"`);
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
}

export async function prerenderPages(
  distDir: string,
  origin: string,
  articles: ArticleLike[],
  pages: Record<string, PageSeo> = PAGES,
  projects: ArticleLike[] = [],
): Promise<PrerenderResult> {
  const shell = stripStaticHead(await readFile(join(distDir, "index.html"), "utf8"));
  const prerenderable = Object.values(pages).filter((p) => p.path !== "/404");

  // Every route, in every language, as its own file: `/services` and
  // `/de/services` are separate documents with their own canonical, hreflang set
  // and `<html lang>`. Previously only the English file existed and `?lang=de`
  // served it unchanged, so there was nothing for a crawler to index in Arabic,
  // German or French.
  let pageCount = 0;
  for (const page of prerenderable) {
    for (const lang of LANGS) {
      await writePage(distDir, shell, page, origin, fileFor(localePath(lang, page.path)), lang);
      pageCount++;
    }
  }

  // Real per-article HTML, so a shared link or a crawler gets the post's own
  // title, description, share image and BlogPosting schema without JavaScript.
  // One document per language the article is actually written in, which for
  // most is English alone. `articlePageSeo` reports that set, so an Arabic post
  // gets a real `/ar/blog/x` to index while an untranslated one does not claim
  // a page it cannot serve.
  let articleCount = 0;
  for (const post of articles) {
    for (const lang of articlePageSeo(post, "en").langs ?? ["en"]) {
      const page = articlePageSeo(post, lang);
      await writePage(distDir, shell, page, origin, fileFor(localePath(lang, page.path)), lang);
      articleCount++;
    }
  }

  // Case-study pages, on the same terms as articles.
  let projectCount = 0;
  for (const item of projects) {
    for (const lang of projectPageSeo(item, "en").langs ?? ["en"]) {
      const page = projectPageSeo(item, lang);
      await writePage(distDir, shell, page, origin, fileFor(localePath(lang, page.path)), lang);
      projectCount++;
    }
  }

  /**
   * Vercel serves `404.html` — with a real 404 status — for any path matching
   * neither a static file nor a rewrite. Without it the old catch-all rewrite
   * answered junk URLs with the homepage's HTML: a 200, the homepage title and
   * `index,follow` on a URL that doesn't exist.
   */
  await writePage(distDir, shell, pages.notFound ?? PAGES.notFound, origin, "404.html");

  /**
   * The fallback for articles published after this build. It deliberately
   * carries no canonical and no title of its own: the client fills both in from
   * the API, and a wrong canonical (pointing every new post at /blog, or worse
   * at /) is far more damaging than a page whose tags arrive a moment late.
   */
  await writeFile(
    join(distDir, "article-shell.html"),
    injectHead(
      shell,
      `<title data-kf-seo="1">${(pages.blog ?? PAGES.blog).title}</title>\n    ` +
        `<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1" data-kf-seo="1" />`,
    ),
    "utf8",
  );

  return { routes: pageCount + 1, articles: articleCount, projects: projectCount };
}

export async function writeSitemap(
  distDir: string,
  origin: string,
  articles: ArticleLike[],
  pages: Record<string, PageSeo> = PAGES,
  projects: ArticleLike[] = [],
): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);

  // Read `noindex` off the merged table, so a page an editor hides in the
  // dashboard leaves the sitemap in the same build.
  const indexable = Object.values(pages).filter((p) => !p.noindex && p.path !== "/404");

  // One <url> per language variant, each carrying the full alternate set — a
  // sitemap that lists only the English URLs leaves the translations
  // undiscoverable except by crawling.
  const entries = [
    ...indexable.flatMap((p) =>
      LANGS.map((lang) => ({
        loc: absolute(origin, localePath(lang, p.path)),
        lastmod: today,
        priority: p.path === "/" ? "1.0" : "0.8",
        path: p.path,
        alternates: true,
        langs: LANGS as readonly Lang[] as Lang[],
      })),
    ),
    // One <url> per language the item genuinely exists in — never four URLs
    // that all resolve to the same English document.
    ...[
      ...projects.map((item) => ({ item, seo: projectPageSeo(item, "en"), priority: "0.7" })),
      ...articles.map((item) => ({ item, seo: articlePageSeo(item, "en"), priority: "0.6" })),
    ].flatMap(({ item, seo, priority }) => {
      const langs = seo.langs ?? (["en"] as Lang[]);
      return langs.map((lang) => ({
        loc: absolute(origin, localePath(lang, seo.path)),
        lastmod: (item.updatedAt || today).slice(0, 10),
        priority,
        path: seo.path,
        alternates: langs.length > 1,
        langs,
      }));
    }),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries
  .map(
    (e) => `  <url>
    <loc>${e.loc}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <priority>${e.priority}</priority>${
      e.alternates
        ? `\n${languageAlternates(origin, e.path, e.langs)
            .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${a.href}" />`)
            .join("\n")}`
        : ""
    }
  </url>`,
  )
  .join("\n")}
</urlset>
`;

  await writeFile(join(distDir, "sitemap.xml"), xml, "utf8");
  return entries.length;
}

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
  "ClaudeBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  // Gemini and grounding in other Google products. It does NOT control AI
  // Overviews — those follow ordinary Googlebot rules and nosnippet.
  "Google-Extended",
  "Applebot-Extended",
  "CCBot", // Common Crawl, which many models train from
  "cohere-ai",
  "meta-externalagent",
];

export async function writeRobots(distDir: string, origin: string): Promise<void> {
  // /campaign is noindex, which a crawler can only discover by fetching it —
  // disallowing it here would hide that directive and risk it being indexed
  // on the strength of inbound links alone.
  const txt = `User-agent: *
Allow: /

${AI_CRAWLERS.map((ua) => `User-agent: ${ua}\nAllow: /`).join("\n\n")}

Sitemap: ${origin}/sitemap.xml
`;
  await writeFile(join(distDir, "robots.txt"), txt, "utf8");
}

/**
 * `llms.txt` — a plain-Markdown map of the site for assistants, at the
 * convention's fixed path. An assistant answering "who builds POS systems in
 * Cairo?" reads this instead of guessing from a JavaScript bundle it cannot
 * execute, so the facts it repeats are the ones written here.
 *
 * Kept generated rather than hand-written so it cannot drift from PAGES and the
 * live article list the sitemap uses.
 */
export async function writeLlmsTxt(
  distDir: string,
  origin: string,
  articles: ArticleLike[],
): Promise<void> {
  const page = (key: keyof typeof PAGES) => PAGES[key];
  const line = (p: PageSeo) => `- [${p.title.split(/ [|—] /)[0]}](${absolute(origin, p.path)}): ${p.desc}`;

  const body = `# ${SITE.name}

> ${PAGES.home.desc}

${SITE.name} is a software studio in ${SITE.city}, ${SITE.country}, founded by ${SITE.founder}.
It builds custom software, web and mobile applications, POS and business systems,
AI automation, IoT and backend APIs — end to end, from scoping through launch and
support. The site is available in English, Arabic, German and French; append
\`?lang=ar\`, \`?lang=de\` or \`?lang=fr\` to any URL.

## Pages

${[page("home"), page("services"), page("solutions"), page("projects"), page("about"), page("blog"), page("contact")].map(line).join("\n")}

## Services

${SERVICE_SUMMARY.map(([name, desc]) => `- ${name}: ${desc}`).join("\n")}

## Articles

${
  articles.length
    ? articles
        .map((a) => {
          const p = articlePageSeo(a, "en");
          return `- [${p.title.split(" | ")[0]}](${absolute(origin, p.path)}): ${p.desc}`;
        })
        .join("\n")
    : "- (none published yet)"
}

## Contact

- Email: ${SITE.email}
- Phone: ${SITE.phone}
- Location: ${SITE.city}, ${SITE.country} — working worldwide
`;

  await writeFile(join(distDir, "llms.txt"), body, "utf8");
}

export { fetchArticles, fetchProjects };
