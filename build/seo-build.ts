/**
 * Build-time half of the SEO engine.
 *
 * Kept out of `src/` so the Node-only filesystem work never gets pulled into a
 * browser bundle, while still importing the same PAGES table, tag descriptors
 * and article helper the runtime uses — a crawler that never runs JavaScript
 * and a browser that does must not disagree about what a page claims to be.
 *
 * This file is the entry point (`runSeoBuild`, called from `vite.config.ts`);
 * the work itself lives in `build/seo/`, one module per artifact: `fetch`
 * (CMS reads with retries), `prerender` + `assets` + `head` (per-page HTML),
 * `sitemap`, `feeds`, `robots` and `llms`.
 */

// First: primes the shared translator with every dictionary.
import { DICTS } from "./seo/dicts.ts";
import { readFile } from "node:fs/promises";
import { writeIndexNowKey } from "./indexnow.ts";
import { mergeSeoOverrides, setSiteIdentity, type Lang } from "../src/lib/seo/index.ts";
import { LANGS } from "../src/lib/langs.ts";
import { setOverrides } from "../src/lib/dict/index.ts";
import { identityFromSettings } from "../src/lib/contact.ts";
import { checkArabicFont, checkDisplayFont } from "./seo/head.ts";
import {
  enabledLangs,
  fetchArticles,
  fetchCollection,
  fetchLegal,
  fetchProjects,
  fetchSeoOverrides,
  fetchSettings,
  fetchTranslations,
} from "./seo/fetch.ts";
import type { BuildContext } from "./seo/context.ts";
import type { Manifest, SsrModule } from "./seo/assets.ts";
import { itemEntries, prerenderPages } from "./seo/prerender.ts";
import { writeSitemap } from "./seo/sitemap.ts";
import { writeFeeds } from "./seo/feeds.ts";
import { writeRobots } from "./seo/robots.ts";
import { writeLlmsTxt, writeSeoDefaults } from "./seo/llms.ts";

export { ARABIC_FONT_URL, DISPLAY_FONT_URL, checkArabicFont, checkDisplayFont } from "./seo/head.ts";
export { SeoFetchError, enabledLangs, fetchSeoOverrides, fetchSettings } from "./seo/fetch.ts";
export type { BuildContext } from "./seo/context.ts";
export type { SsrModule } from "./seo/assets.ts";
export { prerenderPages, type PrerenderResult } from "./seo/prerender.ts";
export { writeSitemap } from "./seo/sitemap.ts";
export { writeFeeds } from "./seo/feeds.ts";
export { writeRobots } from "./seo/robots.ts";
export { writeLlmsTxt, writeSeoDefaults } from "./seo/llms.ts";

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
