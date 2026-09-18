import { apiFetch } from "./http";
import type { ContentCollection, ContentItem, SiteSettings } from "./api-types";

export function getSettings(): Promise<SiteSettings> {
  return apiFetch<SiteSettings>("/content/settings");
}

export function getContentList(collection: ContentCollection): Promise<ContentItem[]> {
  return apiFetch<ContentItem[]>(`/content/${collection}`);
}

export function getContentItem(collection: ContentCollection, id: string): Promise<ContentItem> {
  return apiFetch<ContentItem>(`/content/${collection}/${id}`);
}
