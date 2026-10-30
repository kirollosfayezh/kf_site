/** Reading the CMS at build time, with retries — a build must fail loudly rather than ship without its content. */
import { type ArticleLike, type Lang, type SeoOverride } from "../../src/lib/seo/index.ts";
import { LANGS, isLang } from "../../src/lib/langs.ts";
import type { SiteSettings } from "../../src/services/api-types.ts";

/** Thrown when the API could not be read after every retry. */
export class SeoFetchError extends Error {}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
export async function fetchJson<T>(
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

export async function fetchCollection(apiBase: string | undefined, collection: string): Promise<ArticleLike[]> {
  const items = await fetchJson<ArticleLike[]>(apiBase, `/api/content/${collection}`);
  if (!Array.isArray(items)) return [];
  return items.filter((p) => p.published !== false && (p.slug || p.id));
}

export async function fetchArticles(apiBase: string | undefined): Promise<ArticleLike[]> {
  return fetchCollection(apiBase, "blogPosts");
}

/** Projects, for the `/projects/:slug` case-study pages. */
export async function fetchProjects(apiBase: string | undefined): Promise<ArticleLike[]> {
  return fetchCollection(apiBase, "projects");
}

/** Privacy policy, terms — rendered at `/legal/:slug`. */
export async function fetchLegal(apiBase: string | undefined): Promise<ArticleLike[]> {
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
export async function fetchTranslations(apiBase: string | undefined, lang: Lang): Promise<Record<string, string>> {
  const map = await fetchJson<Record<string, string>>(apiBase, `/api/translations/${lang}`);
  return map && typeof map === "object" ? map : {};
}
