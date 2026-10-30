import { LANGS, type Lang } from "../langs.ts";
import { ogImageUrl } from "../images.ts";
import { PAGES } from "./pages.ts";
import { imageObject } from "./schema/page.ts";
import { localized, tr } from "./text.ts";
import type { ArticleLike, PageSeo } from "./types.ts";

/**
 * The languages an item has real content in.
 *
 * English is always included: it is the fallback every other language resolves
 * to, so the English URL always exists. A translation counts only when both the
 * title and the body are present — a translated headline over an English body
 * is exactly the page Google drops the cluster for.
 */
export function availableLangs(post: ArticleLike, siteLangs: readonly Lang[] = LANGS): Lang[] {
  return LANGS.filter(
    (l) =>
      siteLangs.includes(l) &&
      (l === "en" ||
        ((post.title?.[l] ?? "").trim().length > 0 && (post.body?.[l] ?? "").trim().length > 0)),
  );
}

/** The share image for a CMS item: its first photo, cropped to card size. */
export function itemImage(item: ArticleLike, lang: Lang): Pick<PageSeo, "image" | "imageSized" | "imageAlt"> {
  const { url, sized } = ogImageUrl(item.media?.[0]?.replace(/#.*$/, ""));
  const alt = typeof item.meta?.alt === "string" && item.meta.alt.trim() ? item.meta.alt : localized(item.title, lang);
  return { image: url, imageSized: sized, imageAlt: url ? alt : undefined };
}

/**
 * Builds the SEO entry for one article. Shared by the Article page at runtime
 * and by the build-time prerender, so a crawler that never runs JavaScript and
 * a browser that does describe the post identically.
 */
export function articlePageSeo(post: ArticleLike, lang: Lang, siteLangs: readonly Lang[] = LANGS): PageSeo {
  const title = localized(post.title, lang);
  const summary = localized(post.summary, lang);
  const brand = PAGES.home.title.split(" — ")[0];
  // `tag`, not `category`. The seeder writes `meta.tag`; `meta.category` was a
  // leftover from the design export's field name and always read `undefined`,
  // so every article shipped without an `articleSection`.
  const category =
    typeof post.meta?.tag === "string"
      ? post.meta.tag
      : typeof post.meta?.category === "string"
        ? post.meta.category
        : undefined;

  return {
    path: `/blog/${post.slug || post.id}`,
    title: `${title} | ${brand}`,
    desc: summary || localized(post.body, lang).replace(/\s+/g, " ").slice(0, 155),
    type: "article",
    kind: "article",
    item: post,
    ...itemImage(post, lang),
    published: post.createdAt,
    modified: post.updatedAt,
    section: category,
    langs: availableLangs(post, siteLangs),
  };
}

/**
 * The SEO entry for one project's case-study page.
 *
 * Typed `website` rather than `article`: a case study is a portfolio entry, not
 * a dated post, so it carries no `BlogPosting`; its `CreativeWork` node comes
 * from `projectSchema`.
 */
export function projectPageSeo(item: ArticleLike, lang: Lang, siteLangs: readonly Lang[] = LANGS): PageSeo {
  const title = localized(item.title, lang);
  const summary = localized(item.summary, lang);
  const brand = PAGES.home.title.split(" — ")[0];
  const tag = typeof item.meta?.tag === "string" ? item.meta.tag : undefined;

  return {
    path: `/projects/${item.slug || item.id}`,
    // The tag is English in the CMS; untranslated it made every language's
    // title identical, which Google reads as duplicates.
    title: `${title}${tag ? ` — ${tr(tag, lang)}` : ""} | ${brand}`,
    desc:
      summary ||
      localized(item.body, lang).replace(/\s+/g, " ").slice(0, 155) ||
      PAGES.projects.desc,
    type: "website",
    kind: "project",
    item,
    ...itemImage(item, lang),
    published: item.createdAt,
    modified: item.updatedAt,
    section: tag,
    langs: availableLangs(item, siteLangs),
  };
}

/**
 * `CreativeWork` for a delivered project, referencing the organisation that
 * built it. Not `Product` (nothing is for sale on the page) and not
 * `SoftwareApplication` (that expects an install or an offer).
 */
export function projectSchema(origin: string, item: ArticleLike, lang: Lang, url: string) {
  const tech = Array.isArray(item.meta?.points)
    ? (item.meta.points as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const client = typeof item.meta?.client === "string" ? item.meta.client : undefined;
  const year = typeof item.meta?.year === "string" ? item.meta.year : undefined;
  const tag = typeof item.meta?.tag === "string" ? item.meta.tag : undefined;
  const { image, imageSized } = itemImage(item, lang);

  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": `${url}#project`,
    name: localized(item.title, lang),
    description: localized(item.summary, lang) || localized(item.body, lang).slice(0, 300),
    url,
    image: imageObject(origin, { path: url, title: "", desc: "", image, imageSized }),
    inLanguage: lang,
    ...(tag ? { about: { "@type": "Thing", name: tr(tag, lang) } } : {}),
    ...(item.createdAt ? { datePublished: item.createdAt } : {}),
    ...(item.updatedAt ? { dateModified: item.updatedAt } : {}),
    creator: { "@id": `${origin}/#organization` },
    ...(client ? { sourceOrganization: { "@type": "Organization", name: client } } : {}),
    ...(year ? { dateCreated: year } : {}),
    ...(tech.length ? { keywords: tech.join(", ") } : {}),
  };
}

/* ------------------------------------------------------------- services */

/**
 * A legal document's SEO entry.
 *
 * `noindex` is deliberately off — a privacy policy should be findable, and
 * search engines treat a missing one as a trust signal against a business site.
 */
export function legalPageSeo(doc: ArticleLike, lang: Lang, siteLangs: readonly Lang[] = LANGS): PageSeo {
  const title = localized(doc.title, lang);
  const brand = PAGES.home.title.split(" — ")[0];
  return {
    path: `/legal/${doc.slug || doc.id}`,
    title: `${title} | ${brand}`,
    desc: localized(doc.summary, lang) || localized(doc.body, lang).replace(/\s+/g, " ").slice(0, 155),
    type: "website",
    kind: "legal",
    item: doc,
    modified: doc.updatedAt,
    langs: availableLangs(doc, siteLangs),
  };
}
