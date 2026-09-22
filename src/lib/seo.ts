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
  logo: "/logo-icon.png",
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

/** Every language variant of a page, as real URLs a crawler can fetch. */
export function languageAlternates(origin: string, path: string) {
  const base = absolute(origin, path);
  const sep = base.includes("?") ? "&" : "?";
  return [
    ...LANGS.map((l) => ({
      hreflang: LOCALES[l].hreflang,
      href: l === "en" ? base : `${base}${sep}lang=${l}`,
    })),
    { hreflang: "x-default", href: base },
  ];
}

/* ---------------------------------------------------------------- JSON-LD */

export function organisationSchema(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "LocalBusiness", "ProfessionalService"],
    "@id": `${origin}/#organization`,
    name: SITE.name,
    url: `${origin}/`,
    logo: absolute(origin, SITE.logo),
    image: OG_IMAGE,
    description: PAGES.home.desc,
    email: SITE.email,
    telephone: SITE.phone,
    founder: { "@type": "Person", name: SITE.founder, jobTitle: "Founder & Lead Developer" },
    address: { "@type": "PostalAddress", addressLocality: SITE.city, addressCountry: SITE.country },
    areaServed: ["EG", "DE", "FR", "AE", "SA", "GB", "US"],
    availableLanguage: ["English", "Arabic", "German", "French"],
    priceRange: "$$",
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

export function serviceCatalogSchema(origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    name: "Software & automation services",
    itemListElement: SERVICE_SUMMARY.map(([name, description], i) => ({
      "@type": "Offer",
      position: i + 1,
      itemOffered: {
        "@type": "Service",
        name,
        description,
        provider: { "@id": `${origin}/#organization` },
        areaServed: "Worldwide",
      },
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
    headline: page.title.split(" | ")[0],
    description: page.desc,
    image: page.image || OG_IMAGE,
    datePublished: page.published,
    dateModified: page.modified || page.published,
    articleSection: page.section,
    inLanguage: lang,
    author: { "@type": "Person", name: SITE.founder, url: `${origin}/about` },
    publisher: { "@id": `${origin}/#organization` },
    mainEntityOfPage: { "@type": "WebPage", "@id": absolute(origin, page.path) },
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
  const url = absolute(origin, page.path);
  const image = page.image || OG_IMAGE;
  const tags: SeoTag[] = [{ kind: "title", text: page.title }];

  const m = (attr: "name" | "property", key: string, content?: string) => {
    if (content) tags.push({ kind: "meta", attr, key, content });
  };

  m("name", "description", page.desc);
  m("name", "keywords", page.keywords);
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
  if (origin && !page.noindex) {
    languageAlternates(origin, page.path).forEach((a) =>
      tags.push({ kind: "link", rel: "alternate", href: a.href, hreflang: a.hreflang }),
    );
  }

  m("property", "og:type", page.type || "website");
  m("property", "og:site_name", SITE.name);
  m("property", "og:title", page.title);
  m("property", "og:description", page.desc);
  if (origin) m("property", "og:url", url);
  m("property", "og:image", absolute(origin, image));
  m("property", "og:image:width", "1200");
  m("property", "og:image:height", "630");
  m("property", "og:locale", LOCALES[lang].og);
  LANGS.filter((l) => l !== lang).forEach((l) =>
    tags.push({ kind: "meta", attr: "property", key: "og:locale:alternate", content: LOCALES[l].og }),
  );

  m("name", "twitter:card", "summary_large_image");
  m("name", "twitter:title", page.title);
  m("name", "twitter:description", page.desc);
  m("name", "twitter:image", absolute(origin, image));

  if (!origin) return tags;

  tags.push({ kind: "jsonld", data: organisationSchema(origin) });
  tags.push({ kind: "jsonld", data: websiteSchema(origin) });
  tags.push({
    kind: "jsonld",
    data: breadcrumbSchema(
      origin,
      page.path,
      page.type === "article" ? page.title.split(" | ")[0] : undefined,
    ),
  });
  if (page.path === PAGES.home.path || page.path === PAGES.services.path) {
    tags.push({ kind: "jsonld", data: serviceCatalogSchema(origin) });
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
  title?: { en?: string; ar?: string };
  summary?: { en?: string; ar?: string };
  body?: { en?: string; ar?: string };
  media?: string[];
  meta?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  published?: boolean;
}

function localized(text: ArticleLike["title"], lang: Lang): string {
  if (!text) return "";
  return (lang === "ar" ? text.ar : text.en) || text.en || text.ar || "";
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
  const category = typeof post.meta?.category === "string" ? post.meta.category : undefined;

  return {
    path: `/blog/${post.slug || post.id}`,
    title: `${title} | ${brand}`,
    desc: summary || localized(post.body, lang).replace(/\s+/g, " ").slice(0, 155),
    type: "article",
    image: post.media?.[0],
    published: post.createdAt,
    modified: post.updatedAt,
    section: category,
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
