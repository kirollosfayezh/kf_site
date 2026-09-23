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

export function getContentList(collection: ContentCollection): Promise<ContentItem[]> {
  return fetchCached<ContentItem[]>(`list:${collection}`, `/content/${collection}`);
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
