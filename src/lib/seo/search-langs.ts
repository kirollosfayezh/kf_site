import type { Lang } from "../langs.ts";
import type { PageSeo } from "./types.ts";

/**
 * Languages a kind of page is kept out of search engines in.
 *
 * The page still exists and reads exactly as before for a visitor; it only
 * carries `noindex`, leaves the hreflang set of its English and Arabic twins,
 * and is not listed in the sitemap.
 *
 * Why (Search Console, 25 Nov 2026): Google fetched about eight HTML pages a
 * day from a 658-URL site, and 429 URLs sat in "Discovered – currently not
 * indexed". The German and French articles and case studies were roughly 280
 * of those URLs, for topics (software prices in Egypt, ZATCA, Gulf payment
 * gateways) almost nobody searches in German or French — while the English and
 * Arabic versions, and the country pages, waited in the same queue. Service,
 * market and static pages stay indexed in every language.
 *
 * To offer a language to search again, remove it here and redeploy.
 */
const HIDDEN_FROM_SEARCH: Partial<Record<NonNullable<PageSeo["kind"]>, readonly Lang[]>> = {
  article: ["de", "fr"],
  project: ["de", "fr"],
};

/** True when this language's version of the page should say `noindex`. */
export function hiddenFromSearch(kind: PageSeo["kind"], lang: Lang): boolean {
  return Boolean(kind && HIDDEN_FROM_SEARCH[kind]?.includes(lang));
}

/** The languages, out of those a page exists in, that search engines are offered. */
export function searchLangs(kind: PageSeo["kind"], langs: readonly Lang[]): Lang[] {
  return langs.filter((l) => !hiddenFromSearch(kind, l));
}
