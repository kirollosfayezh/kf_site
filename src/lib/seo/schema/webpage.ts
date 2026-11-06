import type { Lang } from "../../langs.ts";
import { PAGES } from "../pages.ts";
import type { PageSeo } from "../types.ts";
import { founderSchema } from "./organisation.ts";
import { imageObject } from "./page.ts";

/** The static pages whose subject is the company itself. */
const ABOUT_ORGANISATION = new Set([PAGES.home.path, PAGES.about.path, PAGES.contact.path, PAGES.book.path]);
const COLLECTIONS = new Set([PAGES.services.path, PAGES.solutions.path, PAGES.projects.path, PAGES.blog.path]);

/**
 * The page's own node, keyed by its canonical URL.
 *
 * Before it existed, `BlogPosting.mainEntityOfPage` and the breadcrumb pointed
 * at a WebPage `@id` that no node on the page declared, and nothing tied the
 * page to the WebSite and Organization nodes beside it. Now every page says
 * what it is, which site it belongs to, when it changed and — on the pages
 * about the company — what it is about. `/about` is also a `ProfilePage`
 * with the founder inlined: Google's ProfilePage check wants `mainEntity.name`
 * on the page itself, not behind an `@id`.
 */
export function webPageSchema(
  origin: string,
  page: PageSeo,
  lang: Lang,
  url: string,
  title: string,
  desc: string,
  available: readonly Lang[],
) {
  const about = page.path === PAGES.about.path;
  const type = about
    ? ["AboutPage", "ProfilePage"]
    : page.path === PAGES.contact.path || page.path === PAGES.book.path
      ? "ContactPage"
      : COLLECTIONS.has(page.path)
        ? "CollectionPage"
        : page.kind && page.kind !== "page"
          ? "ItemPage"
          : "WebPage";
  const published = page.published;
  const modified = page.modified || page.lastmod || page.published;
  return {
    "@context": "https://schema.org",
    "@type": type,
    "@id": url,
    url,
    name: title,
    description: desc,
    // A language the page does not exist in serves the English document.
    inLanguage: available.includes(lang) ? lang : "en",
    isPartOf: { "@id": `${origin}/#website` },
    publisher: { "@id": `${origin}/#organization` },
    primaryImageOfPage: imageObject(origin, page),
    // Same condition as the BreadcrumbList itself in tags.ts: none on the
    // homepage, none on a noindex page.
    ...(page.path !== PAGES.home.path && !page.noindex ? { breadcrumb: { "@id": `${url}#breadcrumb` } } : {}),
    ...(published ? { datePublished: published } : {}),
    ...(modified ? { dateModified: modified } : {}),
    ...(ABOUT_ORGANISATION.has(page.path) ? { about: { "@id": `${origin}/#organization` } } : {}),
    ...(about ? { mainEntity: founderSchema(origin, lang) } : {}),
  };
}
