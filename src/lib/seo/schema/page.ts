import { LANGS, type Lang } from "../../langs.ts";
import { OG_IMAGE, SITE, siteIdentity } from "../site.ts";
import { resolveDesc, resolveTitle, tr } from "../text.ts";
import type { PageSeo } from "../types.ts";
import { absolute, localePath } from "../urls.ts";

/** The section each top-level path belongs to, as its dictionary key. */
const SECTION_LABELS: Record<string, string> = {
  services: "Services",
  solutions: "Solutions",
  projects: "Projects",
  about: "About",
  blog: "Insights",
  contact: "Contact",
  book: "Book a call",
  campaign: "Get a free quote",
};

/**
 * The breadcrumb trail, in the page's own language and pointing at the
 * page's own language URLs.
 *
 * It used to title-case the path segments in English and link to the English
 * URLs from every translation — so `/ar/services` announced "Home › Services"
 * and pointed at `/services`, a trail that contradicted the page it was on.
 * `/legal/<doc>` had a "Legal" crumb linking to `/legal`, which does not exist.
 */
export function breadcrumbSchema(origin: string, page: PageSeo, lang: Lang, available: readonly Lang[]) {
  const here = (path: string) => absolute(origin, available.includes(lang) ? localePath(lang, path) : path);
  const parts = page.path.replace(/^\//, "").split("/").filter(Boolean);
  const crumbs = [{ name: tr("Home", lang), item: absolute(origin, localePath(lang, "/")) }];

  const section = parts[0];
  const leaf = parts.length > 1;
  // The section crumb, when its index page exists: /legal has none.
  if (section && SECTION_LABELS[section]) {
    crumbs.push({ name: tr(SECTION_LABELS[section], lang), item: here(`/${section}`) });
  }
  if (leaf) {
    crumbs.push({ name: page.crumb || resolveTitle(page, lang).split(" | ")[0], item: here(page.path) });
  }

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.item,
    })),
  };
}

/** `image` as an ImageObject, with dimensions only when they are true. */
export function imageObject(origin: string, page: PageSeo) {
  const url = absolute(origin, page.image || OG_IMAGE);
  const sized = !page.image || page.imageSized;
  return { "@type": "ImageObject", url, ...(sized ? { width: 1200, height: 630 } : {}) };
}

export function articleSchema(
  origin: string,
  page: PageSeo & { path: string },
  lang: Lang,
) {
  const url = absolute(origin, (page.langs ?? LANGS).includes(lang) ? localePath(lang, page.path) : page.path);
  const tags = Array.isArray(page.item?.meta?.tags)
    ? (page.item!.meta!.tags as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: resolveTitle(page, lang).split(" | ")[0],
    description: resolveDesc(page, lang),
    url,
    image: imageObject(origin, page),
    datePublished: page.published,
    dateModified: page.modified || page.published,
    articleSection: page.section,
    ...(tags.length ? { keywords: tags.join(", ") } : {}),
    inLanguage: lang,
    author: { "@type": "Person", name: SITE.founder, url: `${origin}/about`, sameAs: siteIdentity().sameAs },
    publisher: { "@id": `${origin}/#organization` },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };
}

export function faqSchema(items: { q: string; a: string }[]) {
  if (!items.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}
