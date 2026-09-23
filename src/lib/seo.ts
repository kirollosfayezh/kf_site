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
 * 2. Language alternates cover all four languages the export shipped — en, ar,
 *    de and fr — because the site now actually serves each of them at
 *    `?lang=<code>`. hreflang must only ever name URLs that really do render in
 *    that language, so this list and `LANGS` in `lib/i18n` have to stay in step.
 */

import { LANGS, type Lang } from "./langs.ts";
import { translate } from "./dict/index.ts";

export type { Lang };

/**
 * Absolute origin used for canonical, hreflang, OG and JSON-LD URLs.
 *
 * `VITE_SITE_URL` is the source of truth and is what the build-time prerender
 * and sitemap use. At runtime we fall back to the origin actually serving the
 * page, which is self-correcting: a preview deployment canonicalises to itself
 * rather than claiming to be production.
 */
export const SITE_ORIGIN: string = (
  import.meta.env?.VITE_SITE_URL?.trim() ||
  (typeof window !== "undefined" ? window.location.origin : "")
).replace(/\/+$/, "");

export const SITE = {
  name: "KF Tech Solutions",
  // The square 512 icon, not logo-icon.png (160x144). Google wants a square
  // logo for the Organization rich result and crops or drops anything else.
  logo: "/icon-512.png",
  phone: "+20-150-009-9671",
  email: "kirollos.fayez.h@gmail.com",
  city: "Cairo",
  country: "EG",
  founder: "Kirollos Fayez",
  sameAs: [
    "https://www.facebook.com/profile.php?id=61584985085435",
    "https://github.com/koko619911",
    "https://linkedin.com/in/kirollos-fayez-65a33931a",
  ],
} as const;

/** Fallback share image. 1200x630 is the size both Facebook and X expect. */
export const OG_IMAGE =
  "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&h=630&q=80&auto=format&fit=crop";

export interface PageSeo {
  path: string;
  title: string;
  desc: string;
  keywords?: string;
  type?: "website" | "article";
  image?: string;
  noindex?: boolean;
  published?: string;
  modified?: string;
  section?: string;
  /**
   * The languages this page genuinely exists in. Omitted means all of them,
   * which is true of every static page — their copy is in the dictionary.
   *
   * CMS content is different: an article translated into Arabic but not German
   * should be indexable at `/ar/blog/x` and absent from `/de/blog/x`. Claiming
   * a language whose page serves English is the misconfiguration hreflang
   * exists to prevent — Google checks the target really is in the language
   * claimed and drops the whole cluster when it is not — but refusing to
   * advertise a translation that *does* exist throws away the page.
   *
   * So the set is per item, and canonical, hreflang, the prerender and the
   * sitemap all read from this one list.
   */
  langs?: Lang[];
}

export const PAGES: Record<string, PageSeo> = {
  home: {
    path: "/",
    title: "KF Tech Solutions — Custom Software, Web & AI Automation",
    desc: "Custom software, web and mobile development plus AI automation for growing businesses. POS systems, dashboards and integrations built around how you actually work.",
    keywords:
      "custom software development, web development egypt, ai automation, pos system, business dashboards",
    type: "website",
  },
  services: {
    path: "/services",
    title: "Software Development & AI Automation Services | KF Tech Solutions",
    desc: "Custom software, web and mobile apps, business systems, automation, IoT, AI integration and backend APIs — delivered end to end from Cairo.",
    keywords:
      "software development services, mobile app development, ai integration, api development",
    type: "website",
  },
  solutions: {
    path: "/solutions",
    title: "Industry Solutions — POS, Retail, Real Estate, Clinics | KF Tech",
    desc: "Software built for how your industry actually operates: restaurants, retail, real estate, startups and enterprises.",
    keywords:
      "pos system restaurants, retail software, real estate portal, industry software solutions",
    type: "website",
  },
  projects: {
    path: "/projects",
    title: "Our Work — Software Projects & Case Studies | KF Tech Solutions",
    desc: "Delivered platforms, dashboards and mobile apps, with the problem, the approach and the technology behind each build.",
    keywords: "software case studies, software portfolio, pos platform project",
    type: "website",
  },
  about: {
    path: "/about",
    title: "About KF Tech Solutions — Software Studio in Cairo",
    desc: "A software studio founded on one idea: businesses do not need more tools, they need the right system built around how they work.",
    keywords: "software studio cairo, software company egypt, kirollos fayez",
    type: "website",
  },
  contact: {
    path: "/contact",
    title: "Contact KF Tech Solutions — Get a Free Project Quote",
    desc: "Tell us what you need built. Free scoping call, fixed written quote and a reply within one business day.",
    keywords:
      "software development quote, hire software developer egypt, contact software company",
    type: "website",
  },
  blog: {
    path: "/blog",
    title: "Insights on Software, Automation & Business Systems | KF Tech",
    desc: "Practical notes on software, AI automation and running a better business — written for owners, not engineers.",
    keywords: "software blog, business automation guide, pos system roi",
    type: "website",
  },
  campaign: {
    path: "/campaign",
    title: "Custom Software Built for Your Business | Free Quote — KF Tech",
    desc: "POS systems, dashboards, web platforms and automation. Fixed scope, clear pricing and a working demo before you commit.",
    keywords: "custom software quote, pos system quote, business automation egypt",
    type: "website",
    // A paid-traffic landing page. Kept out of the index so it can't compete
    // with /contact for the same queries, but followed so its links still pass.
    noindex: true,
  },
  notFound: {
    path: "/404",
    title: "Page not found — KF Tech Solutions",
    desc: "That page doesn't exist. Browse our services, work and insights instead.",
    type: "website",
    noindex: true,
  },
};

/** Route paths that get their own prerendered HTML and a sitemap entry. */
export const INDEXABLE_PAGES = Object.values(PAGES).filter((p) => !p.noindex);

/** The pages that are prerendered at build time (noindex ones included — the
 *  campaign page still needs correct OG tags when it's shared in an ad). */
export const PRERENDER_PAGES = Object.values(PAGES).filter((p) => p.path !== "/404");

export function absolute(origin: string, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${origin}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

/** BCP-47 tags and OG locales for each language the site serves. */
export const LOCALES: Record<Lang, { hreflang: string; og: string }> = {
  en: { hreflang: "en", og: "en_US" },
  ar: { hreflang: "ar", og: "ar_EG" },
  de: { hreflang: "de", og: "de_DE" },
  fr: { hreflang: "fr", og: "fr_FR" },
};

/**
 * The path a page lives at in a given language. English is the root; every other
 * language gets a prefix — `/ar/services`, `/de/services`.
 *
 * This replaces `?lang=de`. Google's multi-regional guidance rates URL
 * parameters "Not recommended", and the previous setup failed in a specific,
 * silent way: the canonical always pointed at the unsuffixed path, so each
 * translated variant canonicalised away to English. A self-contradictory cluster
 * like that is discarded wholesale, which meant the hreflang did nothing at all.
 *
 * Worse, a query string does not change which static file is served, so
 * `/?lang=de` returned the *English* prerendered HTML. There was no German page
 * for a crawler to index — the translation only appeared after hydration.
 */
/**
 * Translates a title, description or keyword list through the same dictionary
 * the UI uses, keyed by the exact English string.
 *
 * Per-language URLs on their own are not enough: a German page serving the
 * English `<title>` and description still reads to Google as a near-duplicate
 * of the English one, which is the outcome the hreflang cluster exists to
 * prevent. Falls back to the English text so a missing entry degrades to
 * "untranslated" rather than "empty".
 */
function tr(text: string, lang: Lang): string;
function tr(text: string | undefined, lang: Lang): string | undefined;
function tr(text: string | undefined, lang: Lang): string | undefined {
  if (!text || lang === "en") return text;
  return translate(text, lang);
}

export function localePath(lang: Lang, path: string): string {
  if (lang === "en") return path;
  const clean = path === "/" ? "" : path;
  return `/${lang}${clean}`;
}

/** Every language variant of a page, as real URLs a crawler can fetch. */
export function languageAlternates(origin: string, path: string, langs: readonly Lang[] = LANGS) {
  return [
    ...langs.map((l) => ({
      hreflang: LOCALES[l].hreflang,
      href: absolute(origin, localePath(l, path)),
    })),
    // x-default points at the language-neutral entry point, which for this site
    // is the English root.
    { hreflang: "x-default", href: absolute(origin, path) },
  ];
}

/* ---------------------------------------------------------------- JSON-LD */

/**
 * Based in Egypt, delivering worldwide. Schema.org has no "worldwide" enum, so
 * the markets actually served are named as `Country` entities with a catch-all
 * `Place`. Shared by the organisation and every service so the two can never
 * claim different coverage.
 */
const AREA_SERVED = [
  { "@type": "Country", name: "Egypt" },
  { "@type": "Country", name: "Saudi Arabia" },
  { "@type": "Country", name: "United Arab Emirates" },
  { "@type": "Country", name: "Germany" },
  { "@type": "Country", name: "France" },
  { "@type": "Country", name: "United Kingdom" },
  { "@type": "Country", name: "United States" },
  { "@type": "Place", name: "Worldwide" },
];

/**
 * One organisation node, anchored by `@id`, that every other node references.
 *
 * It used to declare `["Organization", "LocalBusiness", "ProfessionalService"]`.
 * Three problems with that:
 *
 * - **`ProfessionalService` is deprecated by schema.org itself**, for being
 *   confused with `Service`.
 * - `LocalBusiness` is a *subtype* of `Organization`, so listing both as
 *   siblings said nothing extra — and `LocalBusiness` **requires** a real
 *   `PostalAddress`. The studio has no public premises, so claiming it was
 *   simply untrue.
 * - A storefront type invites a local-pack reading of a business that works
 *   remotely for clients worldwide.
 *
 * Plain `Organization` is the honest, valid type. `areaServed` carries the
 * geography instead — note it is *not* in Google's supported-properties list, so
 * it is an entity/AI-retrieval signal rather than anything that shows in search.
 *
 * `aggregateRating` is deliberately absent and must stay absent: review markup
 * about yourself, on your own site, is ineligible for star treatment and risks a
 * manual action. Ratings belong on Clutch and G2, whose pages carry them
 * legitimately.
 */
export function organisationSchema(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${origin}/#organization`,
    name: SITE.name,
    url: `${origin}/`,
    logo: absolute(origin, SITE.logo),
    image: OG_IMAGE,
    description: PAGES.home.desc,
    email: SITE.email,
    telephone: SITE.phone,
    founder: { "@type": "Person", name: SITE.founder, jobTitle: "Founder & Lead Developer" },
    // Locality only — no street address is claimed, because none is public.
    address: {
      "@type": "PostalAddress",
      addressLocality: SITE.city,
      addressCountry: SITE.country,
    },
    // Based in Egypt, delivering worldwide. Schema.org has no "worldwide" enum,
    // so the markets actually served are named, with a catch-all Place.
    areaServed: AREA_SERVED,
    availableLanguage: ["English", "Arabic", "German", "French"],
    sameAs: SITE.sameAs,
    knowsAbout: [
      "Custom software development",
      "AI automation",
      "POS systems",
      "Web development",
      "Mobile applications",
      "Business intelligence dashboards",
    ],
  };
}

export function websiteSchema(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    url: `${origin}/`,
    name: SITE.name,
    publisher: { "@id": `${origin}/#organization` },
    inLanguage: [...LANGS],
  };
}

/** Also used to generate llms.txt, so assistants and the OfferCatalog schema
 *  describe the same service list. */
export const SERVICE_SUMMARY: [string, string][] = [
  ["Custom Software Development", "Business systems built around your exact requirements."],
  ["Web Development", "Fast, responsive, conversion-focused websites and web applications."],
  ["Mobile Application Development", "Cross-platform apps for iOS and Android."],
  ["Business Systems & POS", "POS, inventory, HR and internal management systems."],
  ["AI Automation", "AI agents and automated workflows integrated into real operations."],
  ["IoT Solutions", "Connected devices, sensors and telemetry dashboards."],
  ["API & Backend Engineering", "Secure, scalable APIs and backend infrastructure."],
];

/**
 * A slug per service, so each one is an `@id`-anchored entity rather than an
 * anonymous blob nested inside an Offer. Stable ids are what let the catalogue,
 * a future `/services/:slug` page and an assistant's knowledge graph all point
 * at the same thing.
 */
const serviceId = (origin: string, name: string) =>
  `${origin}/services#${name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;

/**
 * One `Service` node per offering.
 *
 * There is no rich result for `Service` — this is an entity signal, read by
 * Google's knowledge layer and by the assistants that answer "who builds POS
 * systems in Egypt". `areaServed` carries real `Country` entities plus a
 * `Place` for the rest of the world, matching the organisation node, because a
 * bare `"Worldwide"` string resolves to nothing.
 */
export function serviceSchemas(origin: string, lang: Lang) {
  return SERVICE_SUMMARY.map(([name, description]) => ({
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": serviceId(origin, name),
    name: tr(name, lang),
    description: tr(description, lang),
    serviceType: name,
    provider: { "@id": `${origin}/#organization` },
    areaServed: AREA_SERVED,
    availableChannel: {
      "@type": "ServiceChannel",
      serviceUrl: absolute(origin, localePath(lang, PAGES.contact.path)),
    },
  }));
}

/** The catalogue references the nodes above by `@id` rather than restating
 *  them, so one service is one entity however many pages mention it. */
export function serviceCatalogSchema(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    "@id": `${origin}/services#catalog`,
    name: "Software & automation services",
    itemListElement: SERVICE_SUMMARY.map(([name], i) => ({
      "@type": "Offer",
      position: i + 1,
      itemOffered: { "@id": serviceId(origin, name) },
    })),
  };
}

export function breadcrumbSchema(origin: string, path: string, leafName?: string) {
  const crumbs = [{ name: "Home", item: `${origin}/` }];
  if (path !== "/") {
    const parts = path.replace(/^\//, "").split("/").filter(Boolean);
    let acc = "";
    parts.forEach((p, i) => {
      acc += `/${p}`;
      const isLeaf = i === parts.length - 1;
      crumbs.push({
        name:
          isLeaf && leafName
            ? leafName
            : p.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        item: `${origin}${acc}`,
      });
    });
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

export function articleSchema(
  origin: string,
  page: PageSeo & { path: string },
  lang: Lang,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: tr(page.title, lang).split(" | ")[0],
    description: tr(page.desc, lang),
    image: page.image || OG_IMAGE,
    datePublished: page.published,
    dateModified: page.modified || page.published,
    articleSection: page.section,
    inLanguage: lang,
    author: { "@type": "Person", name: SITE.founder, url: `${origin}/about` },
    publisher: { "@id": `${origin}/#organization` },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": absolute(
        origin,
        (page.langs ?? LANGS).includes(lang) ? localePath(lang, page.path) : page.path,
      ),
    },
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

/** Resolve a pathname to its PAGES entry. Returns null for routes that own
 *  their own metadata (currently `/blog/:id`, handled by the Article page). */
export function pageForPath(pathname: string): PageSeo | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean.startsWith("/blog/")) return null;
  const match = Object.values(PAGES).find((p) => p.path === clean);
  return match ?? PAGES.notFound;
}

/* ------------------------------------------------------- tag descriptors */

/**
 * The single source of truth for what a page's <head> contains.
 *
 * Both consumers derive from this list: `Seo.tsx` turns descriptors into DOM
 * nodes at runtime, and the `seo-prerender` Vite plugin turns the same
 * descriptors into static HTML at build time. Keeping one list means a crawler
 * that never runs JavaScript and a browser that does can't disagree about what
 * the page claims to be.
 */
export type SeoTag =
  | { kind: "title"; text: string }
  | { kind: "meta"; attr: "name" | "property"; key: string; content: string }
  | { kind: "link"; rel: string; href: string; hreflang?: string }
  | { kind: "jsonld"; data: unknown };

/**
 * `origin` may be empty when `VITE_SITE_URL` was not set at build time. The
 * tags that need an absolute URL — canonical, hreflang, og:url and the JSON-LD
 * graph, which is keyed by absolute @id — are then omitted rather than emitted
 * with a guessed or relative origin: a canonical pointing at the wrong host is
 * far more damaging than a missing one. Everything origin-independent (title,
 * description, robots, the OG/Twitter card) still ships, and at runtime the
 * client re-applies the full set using the origin actually serving the page.
 */
export function seoTags(page: PageSeo, lang: Lang, origin: string): SeoTag[] {
  // The canonical is the URL *for this language*. Pointing every translation at
  // the English path is what invalidated the hreflang cluster before.
  // Only prefix the path for a language the page actually exists in; anything
  // else canonicalises to the English URL rather than to a page that is not
  // there.
  const available = page.langs ?? LANGS;
  const url = absolute(origin, available.includes(lang) ? localePath(lang, page.path) : page.path);
  const image = page.image || OG_IMAGE;
  const title = tr(page.title, lang);
  const desc = tr(page.desc, lang);
  const tags: SeoTag[] = [{ kind: "title", text: title }];

  const m = (attr: "name" | "property", key: string, content?: string) => {
    if (content) tags.push({ kind: "meta", attr, key, content });
  };

  m("name", "description", desc);
  m("name", "keywords", tr(page.keywords, lang));
  m("name", "author", SITE.founder);
  m(
    "name",
    "robots",
    page.noindex ? "noindex,follow" : "index,follow,max-image-preview:large,max-snippet:-1",
  );
  m("name", "theme-color", "#0A0A0D");
  m("name", "geo.region", "EG-C");
  m("name", "geo.placename", SITE.city);

  if (origin) tags.push({ kind: "link", rel: "canonical", href: url });
  // A single-language page advertises nothing: a cluster of one is noise, and
  // `x-default` on its own says less than the canonical already does.
  if (origin && !page.noindex && available.length > 1) {
    languageAlternates(origin, page.path, available).forEach((a) =>
      tags.push({ kind: "link", rel: "alternate", href: a.href, hreflang: a.hreflang }),
    );
  }

  m("property", "og:type", page.type || "website");
  m("property", "og:site_name", SITE.name);
  m("property", "og:title", title);
  m("property", "og:description", desc);
  if (origin) m("property", "og:url", url);
  m("property", "og:image", absolute(origin, image));
  m("property", "og:image:width", "1200");
  m("property", "og:image:height", "630");
  m("property", "og:locale", LOCALES[lang].og);
  LANGS.filter((l) => l !== lang).forEach((l) =>
    tags.push({ kind: "meta", attr: "property", key: "og:locale:alternate", content: LOCALES[l].og }),
  );

  m("name", "twitter:card", "summary_large_image");
  m("name", "twitter:title", title);
  m("name", "twitter:description", desc);
  m("name", "twitter:image", absolute(origin, image));

  if (!origin) return tags;

  tags.push({ kind: "jsonld", data: organisationSchema(origin) });
  tags.push({ kind: "jsonld", data: websiteSchema(origin) });
  tags.push({
    kind: "jsonld",
    data: breadcrumbSchema(
      origin,
      page.path,
      page.type === "article" ? title.split(" | ")[0] : undefined,
    ),
  });
  if (page.path === PAGES.home.path || page.path === PAGES.services.path) {
    tags.push({ kind: "jsonld", data: serviceCatalogSchema(origin) });
  }
  // The `Service` entities themselves live on /services only. Repeating them on
  // the homepage would define the same `@id` twice with nothing gained.
  if (page.path === PAGES.services.path) {
    serviceSchemas(origin, lang).forEach((data) => tags.push({ kind: "jsonld", data }));
  }
  if (page.type === "article") {
    tags.push({ kind: "jsonld", data: articleSchema(origin, page, lang) });
  }

  return tags;
}

const ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function esc(v: string): string {
  return v.replace(/[&<>"]/g, (c) => ESCAPE[c]);
}

/** Renders descriptors as static HTML for the build-time prerender. */
export function tagsToHtml(tags: SeoTag[]): string {
  return tags
    .map((t) => {
      switch (t.kind) {
        case "title":
          return `<title data-kf-seo="1">${esc(t.text)}</title>`;
        case "meta":
          return `<meta ${t.attr}="${esc(t.key)}" content="${esc(t.content)}" data-kf-seo="1" />`;
        case "link":
          return `<link rel="${esc(t.rel)}" href="${esc(t.href)}"${
            t.hreflang ? ` hreflang="${esc(t.hreflang)}"` : ""
          } data-kf-seo="1" />`;
        case "jsonld":
          // `</script>` inside JSON would close the tag early; escaping the
          // slash keeps the JSON valid while making that impossible.
          return `<script type="application/ld+json" data-kf-seo="1">${JSON.stringify(
            t.data,
          ).replace(/</g, "\\u003c")}</script>`;
      }
    })
    .join("\n    ");
}

/* ------------------------------------------------------------- articles */

/** The subset of a blogPosts ContentItem the SEO layer needs. Declared
 *  structurally so the build script can use it without importing the app's
 *  API types (and the DOM typings they drag along). */
export interface ArticleLike {
  id?: string;
  slug?: string;
  title?: Partial<Record<Lang, string>>;
  summary?: Partial<Record<Lang, string>>;
  body?: Partial<Record<Lang, string>>;
  media?: string[];
  meta?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  published?: boolean;
}

function localized(text: ArticleLike["title"], lang: Lang): string {
  if (!text) return "";
  return text[lang] || text.en || text.ar || "";
}

/**
 * The languages an item has real content in.
 *
 * English is always included: it is the fallback every other language resolves
 * to, so the English URL always exists. A translation counts only when both the
 * title and the body are present — a translated headline over an English body
 * is exactly the page Google drops the cluster for.
 */
export function availableLangs(post: ArticleLike): Lang[] {
  return LANGS.filter(
    (l) =>
      l === "en" ||
      ((post.title?.[l] ?? "").trim().length > 0 && (post.body?.[l] ?? "").trim().length > 0),
  );
}

/**
 * Builds the SEO entry for one article. Shared by the Article page at runtime
 * and by the build-time prerender, so a crawler that never runs JavaScript and
 * a browser that does describe the post identically.
 */
export function articlePageSeo(post: ArticleLike, lang: Lang): PageSeo {
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
    image: post.media?.[0],
    published: post.createdAt,
    modified: post.updatedAt,
    section: category,
    langs: availableLangs(post),
  };
}

/**
 * The SEO entry for one project's case-study page.
 *
 * Typed `website` rather than `article`: a case study is a portfolio entry, not
 * a dated post, so it carries no `BlogPosting` and no publish date it would
 * have to keep honest.
 */
export function projectPageSeo(item: ArticleLike, lang: Lang): PageSeo {
  const title = localized(item.title, lang);
  const summary = localized(item.summary, lang);
  const brand = PAGES.home.title.split(" — ")[0];
  const tag = typeof item.meta?.tag === "string" ? item.meta.tag : undefined;

  return {
    path: `/projects/${item.slug || item.id}`,
    title: `${title}${tag ? ` — ${tag}` : ""} | ${brand}`,
    desc:
      summary ||
      localized(item.body, lang).replace(/\s+/g, " ").slice(0, 155) ||
      PAGES.projects.desc,
    type: "website",
    image: item.media?.[0],
    modified: item.updatedAt,
    section: tag,
    langs: availableLangs(item),
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

  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    "@id": `${url}#project`,
    name: localized(item.title, lang),
    description: localized(item.summary, lang) || localized(item.body, lang).slice(0, 300),
    url,
    image: item.media?.[0] || OG_IMAGE,
    inLanguage: lang,
    creator: { "@id": `${origin}/#organization` },
    ...(client ? { sourceOrganization: { "@type": "Organization", name: client } } : {}),
    ...(year ? { dateCreated: year } : {}),
    ...(tech.length ? { keywords: tech.join(", ") } : {}),
  };
}

/**
 * A legal document's SEO entry.
 *
 * `noindex` is deliberately off — a privacy policy should be findable, and
 * search engines treat a missing one as a trust signal against a business site.
 */
export function legalPageSeo(doc: ArticleLike, lang: Lang): PageSeo {
  const title = localized(doc.title, lang);
  const brand = PAGES.home.title.split(" — ")[0];
  return {
    path: `/legal/${doc.slug || doc.id}`,
    title: `${title} | ${brand}`,
    desc: localized(doc.summary, lang) || localized(doc.body, lang).replace(/\s+/g, " ").slice(0, 155),
    type: "website",
    modified: doc.updatedAt,
    langs: availableLangs(doc),
  };
}

/* ------------------------------------------------------ dashboard overrides */

/** One row of `GET /api/seo` — a per-page override edited in the dashboard. */
export interface SeoOverride {
  key: string;
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  noindex?: boolean | null;
}

/**
 * Merges dashboard overrides onto the compiled-in `PAGES` table.
 *
 * A blank string means "inherit", never "clear": an editor who empties the
 * description field gets the built-in one back rather than a page with no
 * description at all. `noindex` is three-state for the same reason — only an
 * explicit `true`/`false` overrides, `null`/absent inherits.
 *
 * Unknown keys are ignored rather than added, so a stale row left behind by a
 * renamed route can never introduce a page the router does not serve.
 */
export function mergeSeoOverrides(overrides: SeoOverride[] | undefined | null): Record<string, PageSeo> {
  if (!overrides?.length) return PAGES;

  const merged: Record<string, PageSeo> = { ...PAGES };
  for (const o of overrides) {
    const base = PAGES[o.key];
    if (!base) continue;
    merged[o.key] = {
      ...base,
      title: o.title?.trim() || base.title,
      desc: o.description?.trim() || base.desc,
      keywords: o.keywords?.trim() || base.keywords,
      image: o.image?.trim() || base.image,
      noindex: typeof o.noindex === "boolean" ? o.noindex : base.noindex,
    };
  }
  return merged;
}

/** `pageForPath`, but against an already-merged table. */
export function pageForPathIn(
  pages: Record<string, PageSeo>,
  pathname: string,
): PageSeo | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean.startsWith("/blog/")) return null;
  return Object.values(pages).find((p) => p.path === clean) ?? pages.notFound ?? PAGES.notFound;
}
