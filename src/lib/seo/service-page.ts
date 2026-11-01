import { LANGS, type Lang } from "../langs.ts";
import { itemImage } from "./cms.ts";
import { PAGES } from "./pages.ts";
import { AREA_SERVED } from "./schema/organisation.ts";
import { imageObject } from "./schema/page.ts";
import { SERVICES, serviceId, servicePath } from "./schema/services.ts";
import { localized, tr } from "./text.ts";
import type { ArticleLike, PageSeo } from "./types.ts";
import { absolute, localePath } from "./urls.ts";

/** One language of a LocalizedText stored in `meta` (the service landing-page
 *  fields), with no cross-language fallback — an empty string means absent. */
export function metaText(item: ArticleLike, key: string, lang: Lang): string {
  const v = item.meta?.[key];
  if (!v || typeof v !== "object") return "";
  const s = (v as Partial<Record<Lang, unknown>>)[lang];
  return typeof s === "string" ? s.trim() : "";
}

/**
 * The languages a service landing page exists in: English always, others
 * once the long-form body is written in them. Unlike articles the title need
 * not be — the headline falls back to the card title, which translates through
 * the dictionary — but a page whose body is still English is the duplicate
 * Google drops the cluster for.
 */
export function serviceLangs(item: ArticleLike, siteLangs: readonly Lang[] = LANGS): Lang[] {
  return LANGS.filter(
    (l) =>
      siteLangs.includes(l) &&
      (l === "en" || (item.body?.[l] ?? "").trim().length > 0),
  );
}

/** The page heading: the long headline, else the card title (dictionary-translated). */
export function serviceHeadline(item: ArticleLike, lang: Lang): string {
  return metaText(item, "headline", lang) || (item.title?.[lang] || "").trim() || tr(localized(item.title, "en"), lang);
}

/** The intro under the heading: the landing-page lede, else the card summary. */
export function serviceLede(item: ArticleLike, lang: Lang): string {
  return (
    metaText(item, "lede", lang) || (item.summary?.[lang] || "").trim() || tr(localized(item.summary, "en"), lang)
  );
}

/**
 * The SEO entry for a service landing page. `faq` is the page's own
 * "Frequently asked questions" section, parsed by the caller (the page at
 * runtime, the build at prerender) so both emit the same FAQPage.
 */
export function servicePageSeo(
  item: ArticleLike,
  lang: Lang,
  siteLangs: readonly Lang[] = LANGS,
  faq?: { q: string; a: string }[],
): PageSeo {
  const brand = PAGES.home.title.split(" — ")[0];
  const headline = serviceHeadline(item, lang);
  const lede = serviceLede(item, lang);
  const seoTitle = metaText(item, "seoTitle", lang);
  return {
    path: servicePath(item.slug || item.id || ""),
    title: seoTitle || `${headline} | ${brand}`,
    desc: metaText(item, "seoDescription", lang) || lede || PAGES.services.desc,
    crumb: headline,
    type: "website",
    kind: "service",
    item,
    ...itemImage(item, lang),
    modified: item.updatedAt,
    langs: serviceLangs(item, siteLangs),
    ...(faq?.length ? { faq } : {}),
  };
}

/**
 * The `Service` entity for a landing page. Same `@id` as the node on
 * /services, so the listing, the catalogue and this page all describe one
 * entity.
 */
export function servicePageSchema(origin: string, page: PageSeo, lang: Lang, url: string) {
  const item = page.item as ArticleLike;
  const slug = item.slug || item.id || "";
  const known = SERVICES.find((s) => s.slug === slug);
  const { image, imageSized } = itemImage(item, lang);
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": serviceId(origin, slug),
    name: serviceHeadline(item, lang),
    description: serviceLede(item, lang),
    ...(known ? { serviceType: known.name } : {}),
    url,
    image: imageObject(origin, { path: url, title: "", desc: "", image, imageSized }),
    inLanguage: lang,
    provider: { "@id": `${origin}/#organization` },
    areaServed: AREA_SERVED,
    availableChannel: {
      "@type": "ServiceChannel",
      serviceUrl: absolute(origin, localePath(lang, PAGES.contact.path)),
    },
  };
}
