import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { getSeoOverrides } from "../services/content";
import type { SiteSettings } from "../services/api-types";
import { identityFromSettings } from "../lib/contact";
import {
  PAGES,
  SITE_ORIGIN,
  faqSchema,
  mergeSeoOverrides,
  pageForPathIn,
  seoTags,
  setSiteIdentity,
  type Lang,
  type PageSeo,
  type SeoOptions,
  type SeoOverride,
  type SeoTag,
} from "../lib/seo";

interface SeoContextValue {
  /**
   * The page table, with any dashboard overrides merged in. Defaults to the
   * compiled-in `PAGES` so the first paint is never tagless — the fetch only
   * ever refines what is already correct, which also means a dead API degrades
   * to the built-in metadata rather than to nothing.
   */
  pages: Record<string, PageSeo>;
  /** The X handle from site settings, for `twitter:site`. */
  twitterSite?: string;
}

const SeoContext = createContext<SeoContextValue>({ pages: PAGES });

export function SeoProvider({ settings, children }: { settings: SiteSettings | null; children: ReactNode }) {
  const [overrides, setOverrides] = useState<SeoOverride[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSeoOverrides()
      .then((rows) => {
        if (!cancelled) setOverrides(rows);
      })
      .catch(() => {
        /* keep the built-in defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const pages = useMemo(() => mergeSeoOverrides(overrides), [overrides]);
  const twitterSite = settings?.social?.x?.trim() || undefined;
  const value = useMemo<SeoContextValue>(() => ({ pages, twitterSite }), [pages, twitterSite]);

  // The Organization node carries the phone, email and profiles an editor set
  // in the dashboard, so the schema and the footer can never disagree.
  useEffect(() => {
    setSiteIdentity(identityFromSettings(settings));
  }, [settings]);

  return <SeoContext.Provider value={value}>{children}</SeoContext.Provider>;
}

export function useSeoContext(): SeoContextValue {
  return useContext(SeoContext);
}

/**
 * Every tag this module owns is stamped with `data-kf-seo`, and each apply
 * clears the previous set before writing the new one. Without that, JSON-LD
 * from an article would survive a client-side navigation to /about and the
 * page would describe itself as two different things at once.
 *
 * The build-time prerender stamps its static tags with the same attribute, so
 * the first client-side apply replaces them rather than duplicating them.
 */
const OWNED = "[data-kf-seo]";

/** The FAQ schema has its own stamp: it is written by the page that renders
 *  the accordion, on its own effect, and must survive `applySeo`'s sweep. */
const FAQ_OWNED = "[data-kf-faq-schema]";

function render(tag: SeoTag) {
  switch (tag.kind) {
    case "title":
      document.title = tag.text;
      return;
    case "meta": {
      const el = document.createElement("meta");
      el.setAttribute(tag.attr, tag.key);
      el.setAttribute("content", tag.content);
      el.setAttribute("data-kf-seo", "1");
      document.head.appendChild(el);
      return;
    }
    case "link": {
      const el = document.createElement("link");
      el.setAttribute("rel", tag.rel);
      el.setAttribute("href", tag.href);
      if (tag.hreflang) el.setAttribute("hreflang", tag.hreflang);
      if (tag.type) el.setAttribute("type", tag.type);
      if (tag.title) el.setAttribute("title", tag.title);
      el.setAttribute("data-kf-seo", "1");
      document.head.appendChild(el);
      return;
    }
    case "jsonld": {
      const el = document.createElement("script");
      el.type = "application/ld+json";
      el.setAttribute("data-kf-seo", "1");
      el.textContent = JSON.stringify(tag.data);
      document.head.appendChild(el);
      return;
    }
  }
}

export function applySeo(page: PageSeo, lang: Lang, origin = SITE_ORIGIN, opts: SeoOptions = {}) {
  // The prerendered <title> carries data-kf-seo too, so remove elements first
  // and set document.title after — otherwise the title tag would be dropped.
  document.head.querySelectorAll(OWNED).forEach((el) => el.remove());
  seoTags(page, lang, origin, opts).forEach(render);
}

/**
 * Applies metadata for an explicitly supplied page. Used directly by routes
 * whose metadata depends on fetched data — the article, case-study and legal
 * templates — and by `RouteSeo` for everything else.
 */
export function useSeo(page: PageSeo | null) {
  const { lang, dictReady, available } = useI18n();
  const { twitterSite } = useSeoContext();

  useEffect(() => {
    // Waiting on the dictionary matters: the prerendered HTML already carries
    // the translated title, and applying tags before the translations land
    // would overwrite it with the English key.
    if (!page || !dictReady) return;
    applySeo(page, lang, SITE_ORIGIN, { siteLangs: available, twitterSite });
  }, [page, lang, dictReady, available, twitterSite]);
}

/**
 * Writes the `FAQPage` schema for the accordion a page renders, from the same
 * data the accordion renders — so the two can never drift apart.
 *
 * It used to be scraped back out of the DOM by polling `data-kf-faq-*`
 * attributes, which meant the answers lived only in attributes (invisible to a
 * crawler) and the schema raced the accordion's mount.
 */
export function useFaqSchema(items: { q: string; a: string }[] | null | undefined) {
  const key = JSON.stringify(items ?? []);
  useEffect(() => {
    document.head.querySelectorAll(FAQ_OWNED).forEach((el) => el.remove());
    const parsed = JSON.parse(key) as { q: string; a: string }[];
    const schema = faqSchema(parsed.filter((x) => x.q && x.a));
    if (!schema) return;
    const el = document.createElement("script");
    el.type = "application/ld+json";
    el.setAttribute("data-kf-faq-schema", "1");
    el.textContent = JSON.stringify(schema);
    document.head.appendChild(el);
    return () => {
      el.remove();
    };
  }, [key]);
}

/**
 * Mounted once in the Layout. Resolves the current pathname to its PAGES entry
 * and applies it. `pageForPathIn` returns null for `/blog/:id`, `/projects/:slug`
 * and `/legal/:slug`, where the page owns its metadata — effects run
 * child-first, so if both ran the Layout would overwrite the page's tags with
 * the generic ones.
 */
export function RouteSeo() {
  const { pathname } = useLocation();
  const { pages } = useSeoContext();
  // `pageForPathIn` returns a fresh object only when the merged table changes,
  // so the effect in `useSeo` re-runs exactly when an override arrives.
  const page = useMemo(() => pageForPathIn(pages, pathname), [pages, pathname]);
  useSeo(page);
  return null;
}
