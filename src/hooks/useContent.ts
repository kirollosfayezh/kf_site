import { useEffect, useState } from "react";
import {
  cachedContentItem,
  cachedContentList,
  cachedSettings,
  getContentItem,
  getContentList,
  getSettings,
} from "../services/content";
import { sameItems } from "../services/content-cache";
import type { ContentCollection, ContentItem, SiteSettings } from "../services/api-types";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

const byOrder = (items: ContentItem[]) => [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

/** What a cached collection looks like as state, or the loading state. */
function seed(collection: ContentCollection): FetchState<ContentItem[]> {
  const hit = cachedContentList(collection);
  return hit ? { data: byOrder(hit), loading: false, error: null } : { data: null, loading: true, error: null };
}

export function useContentList(collection: ContentCollection): FetchState<ContentItem[]> {
  // Seeded from the cache, so a revisit has its content in the first render
  // rather than painting the fallback copy and replacing it a round trip later.
  const [state, setState] = useState<FetchState<ContentItem[]>>(() => seed(collection));

  useEffect(() => {
    let cancelled = false;
    setState(seed(collection));
    getContentList(collection)
      .then((items) => {
        if (cancelled) return;
        const sorted = byOrder(items);
        // Keeping the previous state when nothing changed is the point of the
        // comparison: a fresh array of equivalent items would remount every
        // card and re-request every image for no visible gain.
        setState((prev) => (sameItems(prev.data, sorted) ? prev : { data: sorted, loading: false, error: null }));
      })
      .catch((err: Error) => {
        if (cancelled) return;
        // A failed *revalidation* must not throw away content already on screen.
        setState((prev) =>
          prev.data ? prev : { data: null, loading: false, error: err.message || "Failed to load content." },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [collection]);

  return state;
}

function seedItem(collection: ContentCollection, id: string | undefined): FetchState<ContentItem> {
  if (!id) return { data: null, loading: false, error: "Not found." };
  const hit = cachedContentItem(collection, id);
  return hit ? { data: hit, loading: false, error: null } : { data: null, loading: true, error: null };
}

export function useContentItem(collection: ContentCollection, id: string | undefined): FetchState<ContentItem> {
  const [state, setState] = useState<FetchState<ContentItem>>(() => seedItem(collection, id));

  useEffect(() => {
    if (!id) {
      setState({ data: null, loading: false, error: "Not found." });
      return;
    }
    let cancelled = false;
    setState(seedItem(collection, id));
    getContentItem(collection, id)
      .then((item) => {
        if (cancelled) return;
        setState((prev) =>
          prev.data && prev.data.id === item.id && prev.data.updatedAt === item.updatedAt
            ? prev
            : { data: item, loading: false, error: null },
        );
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState((prev) =>
          prev.data ? prev : { data: null, loading: false, error: err.message || "Failed to load content." },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [collection, id]);

  return state;
}

export function useSiteSettings(): FetchState<SiteSettings> {
  const [state, setState] = useState<FetchState<SiteSettings>>(() => {
    const hit = cachedSettings();
    return hit ? { data: hit, loading: false, error: null } : { data: null, loading: true, error: null };
  });

  useEffect(() => {
    let cancelled = false;
    getSettings()
      .then((settings) => {
        if (!cancelled) setState({ data: settings, loading: false, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ data: null, loading: false, error: err.message || "Failed to load settings." });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
