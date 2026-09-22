import { apiFetch } from "./http";
import type { ContentCollection, ContentItem, SiteSettings } from "./api-types";
import type { SeoOverride } from "../lib/seo";

export function getSettings(): Promise<SiteSettings> {
  return apiFetch<SiteSettings>("/content/settings");
}

export function getContentList(collection: ContentCollection): Promise<ContentItem[]> {
  return apiFetch<ContentItem[]>(`/content/${collection}`);
}

export function getContentItem(collection: ContentCollection, id: string): Promise<ContentItem> {
  return apiFetch<ContentItem>(`/content/${collection}/${id}`);
}

/**
 * Per-page SEO overrides edited in the dashboard. Public, because the values
 * end up in the page's own `<head>` anyway.
 */
export function getSeoOverrides(): Promise<SeoOverride[]> {
  return apiFetch<SeoOverride[]>("/seo");
}
