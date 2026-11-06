import { apiFetch } from "./http";
import { cached, fetchCached } from "./content-cache";
import type { ContentCollection, ContentItem, SiteSettings } from "./api-types";
import type { SeoOverride } from "../lib/seo";

/**
 * Every public read goes through the cache, so a page revisited in the same tab
 * renders its real content on the first frame instead of flashing the static
 * fallback and then swapping. See `content-cache.ts`.
 */

export function getSettings(): Promise<SiteSettings> {
  return fetchCached<SiteSettings>("settings", "/content/settings");
}

export function cachedSettings(): SiteSettings | null {
  return cached<SiteSettings>("settings");
}

/**
 * Lists fetched as cards: no bodies, reading time in `meta.readingMinutes`.
 * A blog list with bodies is every post's full text (~900 kB) for a page of
 * titles. The prerender builds the same shape (`cardView` in build/seo).
 *
 * The markets list is read by the footer on every page for three links; its
 * card's `meta.langs` says which languages each country page is written in
 * (`marketCard` builds the prerendered equivalent).
 */
export const CARD_LISTS: ReadonlySet<ContentCollection> = new Set(["blogPosts", "markets"]);

export function getContentList(collection: ContentCollection): Promise<ContentItem[]> {
  const view = CARD_LISTS.has(collection) ? "?view=card" : "";
  return fetchCached<ContentItem[]>(`list:${collection}`, `/content/${collection}${view}`);
}

export function cachedContentList(collection: ContentCollection): ContentItem[] | null {
  return cached<ContentItem[]>(`list:${collection}`);
}

export function getContentItem(collection: ContentCollection, id: string): Promise<ContentItem> {
  return fetchCached<ContentItem>(`item:${collection}:${id}`, `/content/${collection}/${id}`);
}

export function cachedContentItem(collection: ContentCollection, id: string): ContentItem | null {
  return cached<ContentItem>(`item:${collection}:${id}`);
}

/**
 * Per-page SEO overrides edited in the dashboard. Public, because the values
 * end up in the page's own `<head>` anyway.
 */
export function getSeoOverrides(): Promise<SeoOverride[]> {
  return apiFetch<SeoOverride[]>("/seo");
}

/**
 * Interface-copy overrides edited on the dashboard's Translations screen, for
 * one language, as a flat `English key -> text` map.
 */
export function getTranslationOverrides(lang: string): Promise<Record<string, string>> {
  return apiFetch<Record<string, string>>(`/translations/${lang}`);
}
