import { LANGS, type Lang } from "../langs.ts";
import { itemImage } from "./cms.ts";
import { metaText } from "./service-page.ts";
import { SITE } from "./site.ts";
import { localized, tr } from "./text.ts";
import { localePath } from "./urls.ts";
import type { ArticleLike, PageSeo } from "./types.ts";

/**
 * The country landing pages: `/saudi-arabia`, `/uae`, and `/gulf` for Kuwait,
 * Qatar, Bahrain and Oman.
 *
 * Each is an item in the "markets" CMS collection, written from Markdown
 * (kf_backend `scripts/markets/`) the way the service pages are: the title is
 * the <h1>, the summary the intro, the body the page itself ending in its
 * "Common questions", and `meta.seoTitle` / `meta.seoDescription` the search
 * snippet. The routes and the footer links are code; a page exists once its
 * item is published, and becomes a real URL when the build prerenders it.
 *
 * English and Arabic only, always. German and French readers are not who
 * these pages are for, and machine-translated country pages are the "scaled
 * content" Google demotes — so a German or French text typed into the
 * dashboard is never published, and no hreflang ever names one.
 */
export const MARKETS = [
  { slug: "saudi-arabia", name: "Saudi Arabia" },
  { slug: "uae", name: "UAE" },
  { slug: "gulf", name: "Other Gulf countries" },
] as const;

/** The only languages a market page is ever published in. */
export const MARKET_LANGS: readonly Lang[] = ["en", "ar"];

/** `/saudi-arabia`: a market lives at the root, not under a section. */
export function marketPath(slug: string): string {
  return `/${slug}`;
}

/** Whether the site has a route for this slug; an item for any other is never shown. */
export function isMarketSlug(slug: string | undefined): boolean {
  return MARKETS.some((m) => m.slug === slug);
}

/**
 * Where the language switcher sends a reader of `path` who picks `lang`. The
 * same page in that language, except a country page in German or French,
 * which does not exist: that goes to the language's home page instead of a
 * 404.
 */
export function switchLanguagePath(lang: Lang, path: string): string {
  const slug = /^\/([a-z-]+)\/?$/.exec(path)?.[1];
  if (isMarketSlug(slug) && !MARKET_LANGS.includes(lang)) return localePath(lang, "/");
  return localePath(lang, path);
}

const hasText = (v: string | undefined) => (v ?? "").trim().length > 0;

/**
 * The languages a market page exists in: English and Arabic, each once its
 * heading and body are written. A translated heading over an English body is
 * the page Google drops the hreflang cluster for, so both are required.
 */
export function marketLangs(item: ArticleLike, siteLangs: readonly Lang[] = LANGS): Lang[] {
  return MARKET_LANGS.filter((l) => siteLangs.includes(l) && hasText(item.body?.[l]) && hasText(item.title?.[l]));
}

/** The breadcrumb's last crumb: the country's short name, through the dictionary. */
function marketCrumb(item: ArticleLike, lang: Lang): string {
  const known = MARKETS.find((m) => m.slug === item.slug);
  return known ? tr(known.name, lang) : localized(item.title, lang);
}

/**
 * The SEO entry for a market page. `faq` is the body's "Common questions"
 * section, parsed by the caller (the page at runtime, the build at prerender)
 * so both emit the same FAQPage.
 *
 * A language the page is not written in — `/de/uae`, reached through the
 * language switcher — serves the English page, so it gets the English title
 * and description too, and `langs` points its canonical at the English URL.
 */
export function marketPageSeo(
  item: ArticleLike,
  lang: Lang,
  siteLangs: readonly Lang[] = LANGS,
  faq?: { q: string; a: string }[],
): PageSeo {
  const langs = marketLangs(item, siteLangs);
  const l: Lang = langs.includes(lang) ? lang : "en";
  const headline = localized(item.title, l);
  return {
    path: marketPath(item.slug || item.id || ""),
    title: metaText(item, "seoTitle", l) || `${headline} | ${SITE.name}`,
    desc:
      metaText(item, "seoDescription", l) ||
      localized(item.summary, l) ||
      localized(item.body, l).replace(/\s+/g, " ").slice(0, 155),
    crumb: marketCrumb(item, lang),
    type: "website",
    // No `Service` or `Place` node: the page is about the company's work for
    // a market, so its WebPage is `about` the Organization (webpage.ts).
    kind: "market",
    item,
    ...itemImage(item, l),
    modified: item.updatedAt,
    langs,
    ...(faq?.length ? { faq } : {}),
  };
}

/** A footer link to a market page. */
export interface MarketLink {
  slug: string;
  /** The English name, which is also its dictionary key. */
  name: string;
  /** The page's path, without a language prefix. */
  path: string;
  /** Whether the page exists in the language asked for. When it does not,
   *  the link goes to the English page rather than to a URL with no file. */
  translated: boolean;
}

/**
 * The market pages to link from the footer, in the order of `MARKETS`: those
 * in the published list, each in the languages its card names.
 *
 * The list is the card view, which has no bodies; `meta.langs` names the
 * languages written (absent means all four). On a prerendered page the cards
 * are the build's own (`marketCard` below), whose `meta.langs` is exactly what
 * it prerendered — so no footer link points at a page without a file, which
 * the SEO audit fails a build for.
 */
export function marketLinks(items: readonly ArticleLike[] | null | undefined, lang: Lang): MarketLink[] {
  return MARKETS.flatMap((m) => {
    const item = items?.find((i) => i.slug === m.slug);
    if (!item || item.published === false) return [];
    const langs = item.meta?.langs;
    const written: readonly unknown[] = Array.isArray(langs) ? langs : LANGS;
    if (!written.includes("en")) return [];
    return [{ slug: m.slug, name: m.name, path: marketPath(m.slug), translated: MARKET_LANGS.includes(lang) && written.includes(lang) }];
  });
}

/**
 * A market as `list:markets` carries it in a prerendered page's snapshot:
 * no body, and `meta.langs` set to exactly the languages this build
 * prerenders — the same field the API's card view fills from the title and
 * body. `sameItems` compares ids and dates, so the client keeps this until
 * the item changes.
 */
export function marketCard(item: ArticleLike, siteLangs: readonly Lang[] = LANGS): ArticleLike {
  const { body: _body, ...rest } = item;
  return { ...rest, meta: { langs: marketLangs(item, siteLangs) } };
}
