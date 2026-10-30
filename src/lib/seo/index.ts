/**
 * KF Tech Solutions — SEO engine.
 *
 * This is the React port of `kf-seo.js` from the original design export. It
 * keeps that file's shape on purpose: one PAGES table drives titles, meta
 * descriptions, canonicals, hreflang, Open Graph, Twitter cards and JSON-LD, so
 * a future dashboard "SEO" screen can map onto it 1:1.
 *
 * Two things changed in the port:
 *
 * 1. `path` values are the app's real routes (`/campaign`, not the export's
 *    `/get-a-quote`), so canonicals point at URLs that actually resolve.
 * 2. Language alternates cover the languages the export shipped — en, ar, de
 *    and fr — each served under its own path prefix (`/ar/services`), limited
 *    at build and run time to the ones switched on in the dashboard. hreflang
 *    must only ever name URLs that really do render in that language.
 *
 * The engine is split by concern; this file is its public surface, and every
 * consumer (the runtime `Seo.tsx`, the pages, and `build/seo-build.ts` in
 * plain Node) imports from here:
 *
 * - `site.ts`      brand constants and the dashboard-editable identity
 * - `pages.ts`     the static PAGES table and path → entry resolution
 * - `urls.ts`      absolute URLs, per-language paths, hreflang alternates
 * - `text.ts`      dictionary translation and SERP-length fitting
 * - `schema/`      JSON-LD nodes (organisation, services, page-level)
 * - `cms.ts`       entries for articles, case studies and legal pages
 * - `service-page.ts` entries and schema for `/services/:slug`
 * - `tags.ts`      the head-tag descriptors and their static HTML
 * - `overrides.ts` dashboard SEO overrides merged onto PAGES
 */

export type { Lang } from "../langs.ts";
export type { ArticleLike, PageSeo } from "./types.ts";
export { OG_IMAGE, OG_IMAGE_ALT, SITE, SITE_ORIGIN, setSiteIdentity, siteIdentity, type SiteIdentity } from "./site.ts";
export { INDEXABLE_PAGES, PAGES, PRERENDER_PAGES, pageForPath, pageForPathIn } from "./pages.ts";
export { LOCALES, absolute, languageAlternates, localePath } from "./urls.ts";
export { fitDesc, fitTitle, resolveDesc, resolveTitle } from "./text.ts";
export { KNOWS_ABOUT, organisationSchema, websiteSchema } from "./schema/organisation.ts";
export { SERVICES, serviceCatalogSchema, servicePath, serviceSchemas } from "./schema/services.ts";
export { articleSchema, breadcrumbSchema, faqSchema } from "./schema/page.ts";
export { articlePageSeo, availableLangs, legalPageSeo, projectPageSeo, projectSchema } from "./cms.ts";
export { serviceHeadline, serviceLangs, serviceLede, servicePageSeo } from "./service-page.ts";
export { seoTags, tagsToHtml, type SeoOptions, type SeoTag } from "./tags.ts";
export { mergeSeoOverrides, type SeoOverride } from "./overrides.ts";
