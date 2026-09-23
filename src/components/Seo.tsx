import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { getSeoOverrides } from "../services/content";
import {
  PAGES,
  SITE_ORIGIN,
  faqSchema,
  mergeSeoOverrides,
  pageForPathIn,
  seoTags,
  type Lang,
  type PageSeo,
  type SeoOverride,
  type SeoTag,
} from "../lib/seo";

/**
 * The page table, with any dashboard overrides merged in. Defaults to the
 * compiled-in `PAGES` so the first paint is never tagless — the fetch only ever
 * refines what is already correct, which also means a dead API degrades to the
 * built-in metadata rather than to nothing.
 */
const SeoPagesContext = createContext<Record<string, PageSeo>>(PAGES);

export function SeoProvider({ children }: { children: ReactNode }) {
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
  return <SeoPagesContext.Provider value={pages}>{children}</SeoPagesContext.Provider>;
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

export function applySeo(page: PageSeo, lang: Lang, origin = SITE_ORIGIN) {
  // The prerendered <title> carries data-kf-seo too, so remove elements first
  // and set document.title after — otherwise the title tag would be dropped.
  document.head.querySelectorAll(OWNED).forEach((el) => el.remove());
  seoTags(page, lang, origin).forEach(render);
}

/** Pulled from the DOM so the visible FAQ accordion and the structured data
 *  describing it can never drift apart. */
function faqFromDom() {
  const items: { q: string; a: string }[] = [];
  document.querySelectorAll("[data-kf-faq-q]").forEach((n) => {
    const q = (n.getAttribute("data-kf-faq-q") || n.textContent || "").trim();
    const a = (n.getAttribute("data-kf-faq-a") || "").trim();
    if (q && a) items.push({ q, a });
  });
  return items;
}

/**
 * Applies metadata for an explicitly supplied page. Used directly by routes
 * whose metadata depends on fetched data — currently the article template.
 */
export function useSeo(page: PageSeo | null) {
  const { lang, dictReady } = useI18n();

  useEffect(() => {
    // Waiting on the dictionary matters: the prerendered HTML already carries
    // the translated title, and applying tags before the translations land
    // would overwrite it with the English key.
    if (!page || !dictReady) return;
    applySeo(page, lang);

    // The FAQ accordion mounts after this effect on a cold load, so poll
    // briefly rather than emitting an empty FAQPage or none at all.
    let tries = 0;
    let timer: number | undefined;
    const pollFaq = () => {
      const items = faqFromDom();
      if (items.length) {
        const schema = faqSchema(items);
        if (schema) render({ kind: "jsonld", data: schema });
        return;
      }
      if (++tries < 12) timer = window.setTimeout(pollFaq, 300);
    };
    pollFaq();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [page, lang, dictReady]);
}

/**
 * Mounted once in the Layout. Resolves the current pathname to its PAGES entry
 * and applies it. `pageForPath` returns null for `/blog/:id`, where the Article
 * page owns its metadata — effects run child-first, so if both ran the Layout
 * would overwrite the article's tags with the generic ones.
 */
export function RouteSeo() {
  const { pathname } = useLocation();
  const pages = useContext(SeoPagesContext);
  // `pageForPathIn` returns a fresh object only when the merged table changes,
  // so the effect in `useSeo` re-runs exactly when an override arrives.
  const page = useMemo(() => pageForPathIn(pages, pathname), [pages, pathname]);
  useSeo(page);
  return null;
}
