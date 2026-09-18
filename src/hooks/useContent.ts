import { useEffect, useState } from "react";
import { getContentItem, getContentList, getSettings } from "../services/content";
import type { ContentCollection, ContentItem, SiteSettings } from "../services/api-types";

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useContentList(collection: ContentCollection): FetchState<ContentItem[]> {
  const [state, setState] = useState<FetchState<ContentItem[]>>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    getContentList(collection)
      .then((items) => {
        if (cancelled) return;
        const sorted = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setState({ data: sorted, loading: false, error: null });
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setState({ data: null, loading: false, error: err.message || "Failed to load content." });
      });
    return () => {
      cancelled = true;
    };
  }, [collection]);

  return state;
}

export function useContentItem(collection: ContentCollection, id: string | undefined): FetchState<ContentItem> {
  const [state, setState] = useState<FetchState<ContentItem>>({ data: null, loading: true, error: null });

  useEffect(() => {
    if (!id) {
      setState({ data: null, loading: false, error: "Not found." });
      return;
    }
    let cancelled = false;
    setState({ data: null, loading: true, error: null });
    getContentItem(collection, id)
      .then((item) => {
        if (!cancelled) setState({ data: item, loading: false, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ data: null, loading: false, error: err.message || "Failed to load content." });
      });
    return () => {
      cancelled = true;
    };
  }, [collection, id]);

  return state;
}

export function useSiteSettings(): FetchState<SiteSettings> {
  const [state, setState] = useState<FetchState<SiteSettings>>({ data: null, loading: true, error: null });

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
