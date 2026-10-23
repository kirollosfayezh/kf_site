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
 */

import { LANGS, type Lang } from "./langs.ts";
import { translate } from "./dict/index.ts";
import { ogImageUrl } from "./images.ts";

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
  email: "info@kftechsolutions.dev",
  city: "Cairo",
  country: "EG",
  founder: "Kirollos Fayez",
  // The company's own profiles, matching DEFAULT_SOCIAL. Personal accounts
  // (the founder's profile, a personal GitHub) describe a Person, not this
  // Organization, and muddy the entity Google builds for the brand.
  sameAs: [
    "https://www.facebook.com/KfTechSoltuions/",
    "https://www.instagram.com/kf__techsolutions/",
    "https://www.linkedin.com/company/kf-tech-solutions/",
    "https://www.tiktok.com/@kftechsolutions",
  ],
  // Profiles that have no footer icon (so no SocialKey) but are the company's own.
  extraSameAs: ["https://www.snapchat.com/add/kftechsolutions"],
  // How people actually type the brand. Searches for "kf tech" were landing on
  // other companies; alternateName ties the short forms to this entity.
  alternateName: ["KF Tech", "KFTech"],
} as const;

/**
 * Fallback share image: the branded card in `public/`, 1200×630 as Facebook
 * and X expect. It replaced an Unsplash stock photo — a share card is the one
 * place the brand should be recognisable, not a generic laptop.
 */
export const OG_IMAGE = "/og-default.png";
export const OG_IMAGE_ALT = "KF Tech Solutions — custom software, POS systems and AI automation";

/**
 * Contact details and profiles that can be edited in the dashboard. `SITE`
 * stays the compiled-in default; `setSiteIdentity` lets both the build (from
 * the fetched settings) and the runtime (from the settings context) replace
 * them before the schema is written, so the Organization node and the footer
 * never disagree.
 */
export interface SiteIdentity {
  phone: string;
  email: string;
  sameAs: string[];
}

let identity: SiteIdentity = { phone: SITE.phone, email: SITE.email, sameAs: [...SITE.sameAs] };

export function setSiteIdentity(next: Partial<SiteIdentity>): void {
  identity = {
    phone: next.phone?.trim() || SITE.phone,
    email: next.email?.trim() || SITE.email,
    sameAs: next.sameAs?.length ? next.sameAs : [...SITE.sameAs],
  };
}

export function siteIdentity(): SiteIdentity {
  return identity;
}

export interface PageSeo {
  path: string;
  title: string;
  desc: string;
  keywords?: string;
  type?: "website" | "article";
  /** What kind of page this is, for the JSON-LD that goes with it. */
  kind?: "page" | "article" | "project" | "legal" | "service";
  /** The CMS item behind an article/project/legal page, for its schema. */
  item?: ArticleLike;
  image?: string;
  /** Plain-language description of the share image, for `og:image:alt`. */
  imageAlt?: string;
  /** True only when `image` really is 1200×630 — the dimensions are claimed
   *  only then, because a wrong claim makes Facebook and LinkedIn drop the card. */
  imageSized?: boolean;
  noindex?: boolean;
  /** The breadcrumb's last crumb, when the page title is not a good one (an
   *  SEO title like "X Company in Egypt" reads badly as a trail). */
  crumb?: string;
  published?: string;
  modified?: string;
  section?: string;
  /** FAQ items rendered on the page, emitted as `FAQPage` alongside the rest
   *  of the graph. Set per language by the build; the runtime uses `useFaqSchema`. */
  faq?: { q: string; a: string }[];
  /**
   * Dashboard overrides per language. `title`/`desc` hold the English text
   * (built-in or overridden); these hold an editor's explicit translations,
   * which win over the dictionary lookup `tr()` would otherwise do.
   */
  titleByLang?: Partial<Record<Lang, string>>;
  descByLang?: Partial<Record<Lang, string>>;
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
  book: {
    path: "/book",
    title: "Book a Free Call | KF Tech Solutions",
    desc: "Pick a time and we'll call you on WhatsApp: a free 30-minute call about your software, website or automation project.",
    keywords: "book a call software company, free consultation software egypt, software project call",
    type: "website",
  },
  quote: {
    // A client's private quote (`/q/<token>`): never indexed, never prerendered.
    path: "/q",
    title: "Your Quote — KF Tech Solutions",
    desc: "Your project quote from KF Tech Solutions.",
    type: "website",
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
export const PRERENDER_PAGES = Object.values(PAGES).filter((p) => p.path !== "/404" && p.path !== "/q");

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

/**
 * The title for one language: an editor's explicit translation first, then the
 * English text (built-in or overridden) through the dictionary.
 *
 * Before per-language overrides existed, any title edited in the dashboard
 * turned every translated page's `<title>` into that English string — the
 * dictionary is keyed by the *built-in* English, so the edited text matched
 * nothing and fell through untranslated.
 */
export function resolveTitle(page: PageSeo, lang: Lang): string {
  return page.titleByLang?.[lang]?.trim() || tr(page.title, lang);
}

export function resolveDesc(page: PageSeo, lang: Lang): string {
  return page.descByLang?.[lang]?.trim() || tr(page.desc, lang);
}

/** Roughly where Google cuts a title or a description in the results. */
const TITLE_MAX = 60;
const DESC_MAX = 160;

/**
 * A title that fits the results page. Past the limit the trailing brand goes
 * first: Google shows the site name above the result anyway, and a cut-off
 * headline ("…how a restaurant owner should actually decide | KF Tec…") reads
 * worse than a whole one without the suffix. The headline itself is never cut.
 */
export function fitTitle(title: string): string {
  if (title.length <= TITLE_MAX) return title;
  const m = title.match(/^(.*\S)\s+[|—–-]\s+KF Tech[^|—–]*$/);
  return m ? m[1] : title;
}

/**
 * A description that fits the results page: whole sentences where they fit,
 * else cut at a word with an ellipsis. Long card summaries (GenTrack's runs to
 * 280 characters) otherwise end mid-word in the snippet.
 */
export function fitDesc(desc: string): string {
  const d = desc.replace(/\s+/g, " ").trim();
  if (d.length <= DESC_MAX) return d;
  const head = d.slice(0, DESC_MAX);
  const stop = Math.max(...[". ", "! ", "? ", "؟ ", "。"].map((p) => head.lastIndexOf(p)));
  if (stop >= 90) return head.slice(0, stop + 1);
  const space = head.lastIndexOf(" ", DESC_MAX - 1);
  return `${head.slice(0, space > 90 ? space : DESC_MAX - 1).replace(/[,;:—–-]+$/, "")}…`;
}

/** English names of the languages, for schema `availableLanguage` fields. */
const LANGUAGE_NAMES: Record<Lang, string> = {
  en: "English",
  ar: "Arabic",
  de: "German",
  fr: "French",
};

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
 * The topics the studio works in, as `knowsAbout` on the organisation node.
 * Assistants and knowledge graphs read it to decide which questions the
 * business is an answer to ("who builds pharmacy software in Cairo?"), so it
 * names every service and every system the articles and service pages
 * describe — and nothing the studio does not do.
 */
export const KNOWS_ABOUT = [
  "Custom software development",
  "Web development",
  "Web application development",
  "Mobile app development",
  "iOS and Android apps",
  "MVP development for startups",
  "POS systems",
  "Restaurant POS and ordering systems",
  "Restaurant delivery apps",
  "Retail POS and cashier systems",
  "Inventory and warehouse management systems",
  "ERP for small and medium businesses",
  "CRM systems",
  "Real estate CRM",
  "Clinic management software",
  "Pharmacy management software",
  "HR and internal management systems",
  "E-commerce and online stores",
  "Landing pages for ads",
  "WhatsApp chatbots",
  "AI automation",
  "AI agents",
  "Business process automation",
  "Business intelligence dashboards",
  "IoT solutions",
  "API and backend engineering",
  "System integration",
  "ETA e-invoicing and e-receipt integration",
  "Nearshore software development",
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
export function organisationSchema(origin: string, siteLangs: readonly Lang[] = LANGS) {
  const { email, phone, sameAs } = siteIdentity();
  const languages = siteLangs.map((l) => LANGUAGE_NAMES[l]);
  return {
    "@context": "https://schema.org",
    // Also a LocalBusiness, so "software company in Cairo" style searches and
    // the Business Profile can tie the site to a place. Locality only: no
    // street address is claimed, because none is public.
    "@type": ["Organization", "LocalBusiness"],
    "@id": `${origin}/#organization`,
    name: SITE.name,
    alternateName: [...SITE.alternateName],
    url: `${origin}/`,
    // Google wants the logo as an ImageObject with its real dimensions; the
    // 512 icon is square, which is the one shape it never crops.
    logo: { "@type": "ImageObject", url: absolute(origin, SITE.logo), width: 512, height: 512 },
    image: absolute(origin, OG_IMAGE),
    description: PAGES.home.desc,
    email,
    telephone: phone,
    // The sales contact point is what "contact this business" answers use;
    // the languages listed are the ones the site actually serves.
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "sales",
        telephone: phone,
        email,
        availableLanguage: languages,
        areaServed: AREA_SERVED,
      },
    ],
    founder: { "@type": "Person", name: SITE.founder, jobTitle: "Founder & Lead Developer" },
    // Locality only — no street address is claimed, because none is public.
    address: {
      "@type": "PostalAddress",
      addressLocality: SITE.city,
      addressRegion: "Cairo Governorate",
      addressCountry: SITE.country,
    },
    // The city centre, not an office: enough to place the business in Cairo
    // without pretending to a street address.
    geo: { "@type": "GeoCoordinates", latitude: 30.0444, longitude: 31.2357 },
    // Cairo first — it is where the business is — then the markets served.
    // Schema.org has no "worldwide" enum, so those are named, with a catch-all Place.
    areaServed: [{ "@type": "City", name: "Cairo" }, { "@type": "City", name: "Giza" }, ...AREA_SERVED],
    availableLanguage: languages,
    sameAs: [...new Set([...sameAs, ...SITE.extraSameAs])],
    knowsAbout: KNOWS_ABOUT,
  };
}

export function websiteSchema(origin: string, siteLangs: readonly Lang[] = LANGS) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    url: `${origin}/`,
    name: SITE.name,
    // Google's site-name feature reads WebSite.alternateName.
    alternateName: [...SITE.alternateName],
    publisher: { "@id": `${origin}/#organization` },
    inLanguage: [...siteLangs],
  };
}

/**
 * The service list, keyed by the **CMS slug** each service renders under.
 *
 * The slug is what `/services` uses as the card's `id`, so `@id` fragments
 * here resolve to a real anchor. The previous list derived ids from the
 * names ("custom-software-development") and none of them matched a card, so
 * every Service entity pointed into the void. Also used for llms.txt, so
 * assistants and the OfferCatalog describe the same offerings.
 */
export const SERVICES: { slug: string; name: string; desc: string }[] = [
  { slug: "custom-software", name: "Custom Software Development", desc: "Business systems built around your exact requirements." },
  { slug: "web-development", name: "Web Development", desc: "Fast, responsive, conversion-focused websites and web applications." },
  { slug: "mobile-applications", name: "Mobile Application Development", desc: "Cross-platform apps for iOS and Android." },
  { slug: "business-systems", name: "Business Systems & POS", desc: "POS, inventory, HR and internal management systems." },
  { slug: "automation", name: "Automation", desc: "Replace repetitive manual workflows with smart automation." },
  { slug: "iot-solutions", name: "IoT Solutions", desc: "Connected devices, sensors and telemetry dashboards." },
  { slug: "ai-solutions", name: "AI Automation", desc: "AI agents and automated workflows integrated into real operations." },
  { slug: "api-and-backend", name: "API & Backend Engineering", desc: "Secure, scalable APIs and backend infrastructure." },
];

/**
 * A stable `@id` per service, so each one is an entity rather than an anonymous
 * blob nested inside an Offer. It is what lets the catalogue, the card on
 * /services and an assistant's knowledge graph all point at the same thing.
 */
const serviceId = (origin: string, slug: string) => `${origin}/services/${slug}#service`;

/** A service's own landing page, `/services/<slug>`. */
export const servicePath = (slug: string) => `/services/${slug}`;

/** The full node for one service, in one language. */
function serviceNode(origin: string, lang: Lang, svc: (typeof SERVICES)[number]) {
  return {
    "@type": "Service",
    "@id": serviceId(origin, svc.slug),
    name: tr(svc.name, lang),
    description: tr(svc.desc, lang),
    serviceType: svc.name,
    url: absolute(origin, localePath(lang, servicePath(svc.slug))),
    provider: { "@id": `${origin}/#organization` },
    areaServed: AREA_SERVED,
    availableChannel: {
      "@type": "ServiceChannel",
      serviceUrl: absolute(origin, localePath(lang, PAGES.contact.path)),
    },
  };
}

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
  return SERVICES.map((svc) => ({ "@context": "https://schema.org", ...serviceNode(origin, lang, svc) }));
}

/**
 * The catalogue of offerings.
 *
 * On /services it references the Service nodes above by `@id`, so one service
 * is one entity. Anywhere else (the homepage) the nodes are inlined: an `@id`
 * reference only resolves within the page that defines it, and the homepage
 * used to reference eight ids that existed only on /services — a catalogue of
 * dangling pointers.
 */
export function serviceCatalogSchema(origin: string, lang: Lang, opts: { inline?: boolean } = {}) {
  return {
    "@context": "https://schema.org",
    "@type": "OfferCatalog",
    "@id": `${origin}/services#catalog`,
    name: tr("Software & automation services", lang),
    itemListElement: SERVICES.map((svc, i) => ({
      "@type": "Offer",
      position: i + 1,
      itemOffered: opts.inline ? serviceNode(origin, lang, svc) : { "@id": serviceId(origin, svc.slug) },
    })),
  };
}

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
function imageObject(origin: string, page: PageSeo) {
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

/**
 * Routes whose page owns its own metadata, built from fetched data. The
 * Layout's `RouteSeo` must return null for these: effects run child-first, so
 * if it resolved them it would run *after* the page and overwrite the article's
 * tags with — since no PAGES entry matches — the noindex "Page not found" set.
 * That is exactly what happened to every case study and legal page on a
 * client-side navigation.
 */
const SELF_DESCRIBED = ["/blog/", "/projects/", "/legal/", "/services/"];

/** Resolve a pathname to its PAGES entry. Returns null for routes that own
 *  their own metadata (`/blog/:id`, `/projects/:slug`, `/legal/:slug`). */
export function pageForPath(pathname: string): PageSeo | null {
  return pageForPathIn(PAGES, pathname);
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
  | { kind: "link"; rel: string; href: string; hreflang?: string; type?: string; title?: string }
  | { kind: "jsonld"; data: unknown };

/** Site-wide inputs the tag builder needs beyond the page itself. */
export interface SeoOptions {
  /**
   * The languages the site currently serves, from the dashboard's language
   * list. hreflang, `og:locale:alternate` and the schema's language fields are
   * limited to these — advertising a German alternate while German is switched
   * off points crawlers at pages that render in English.
   */
  siteLangs?: readonly Lang[];
  /** The site's X handle (`@kftech`), for `twitter:site`. */
  twitterSite?: string;
}

/**
 * `origin` may be empty when `VITE_SITE_URL` was not set at build time. The
 * tags that need an absolute URL — canonical, hreflang, og:url and the JSON-LD
 * graph, which is keyed by absolute @id — are then omitted rather than emitted
 * with a guessed or relative origin: a canonical pointing at the wrong host is
 * far more damaging than a missing one. Everything origin-independent (title,
 * description, robots, the OG/Twitter card) still ships, and at runtime the
 * client re-applies the full set using the origin actually serving the page.
 */
export function seoTags(page: PageSeo, lang: Lang, origin: string, opts: SeoOptions = {}): SeoTag[] {
  const siteLangs = opts.siteLangs ?? LANGS;
  // The canonical is the URL *for this language*. Pointing every translation at
  // the English path is what invalidated the hreflang cluster before.
  // Only prefix the path for a language the page actually exists in — and the
  // site currently serves; anything else canonicalises to the English URL
  // rather than to a page that is not there.
  const available = (page.langs ?? siteLangs).filter((l) => siteLangs.includes(l));
  const url = absolute(origin, available.includes(lang) ? localePath(lang, page.path) : page.path);
  const image = page.image || OG_IMAGE;
  // Dimensions are claimed for the branded default and for CMS photos that
  // went through `ogImageUrl`; a wrong claim makes the card get dropped.
  const imageSized = !page.image || page.imageSized === true;
  const title = fitTitle(resolveTitle(page, lang));
  const desc = fitDesc(resolveDesc(page, lang));
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

  // The feed for this language, on the blog index and every article — the
  // link is how readers and aggregators discover it.
  if (origin && (page.path === PAGES.blog.path || page.kind === "article")) {
    const feedTitle = resolveTitle(PAGES.blog, lang).split(" | ")[0];
    const feedFor = (l: Lang) =>
      tags.push({
        kind: "link",
        rel: "alternate",
        type: "application/rss+xml",
        title: feedTitle,
        href: absolute(origin, localePath(l, "/feed.xml")),
      });
    feedFor(available.includes(lang) ? lang : "en");
    if (lang !== "en" && available.includes(lang)) feedFor("en");
  }

  m("property", "og:type", page.type || "website");
  m("property", "og:site_name", SITE.name);
  m("property", "og:title", title);
  m("property", "og:description", desc);
  if (origin) m("property", "og:url", url);
  m("property", "og:image", absolute(origin, image));
  if (imageSized) {
    m("property", "og:image:width", "1200");
    m("property", "og:image:height", "630");
  }
  m("property", "og:image:alt", tr(page.imageAlt || OG_IMAGE_ALT, lang));
  m("property", "og:locale", LOCALES[lang].og);
  siteLangs
    .filter((l) => l !== lang)
    .forEach((l) =>
      tags.push({ kind: "meta", attr: "property", key: "og:locale:alternate", content: LOCALES[l].og }),
    );

  m("name", "twitter:card", "summary_large_image");
  m("name", "twitter:site", opts.twitterSite?.trim() || undefined);
  m("name", "twitter:title", title);
  m("name", "twitter:description", desc);
  m("name", "twitter:image", absolute(origin, image));
  m("name", "twitter:image:alt", tr(page.imageAlt || OG_IMAGE_ALT, lang));

  if (!origin) return tags;

  tags.push({ kind: "jsonld", data: organisationSchema(origin, siteLangs) });
  tags.push({ kind: "jsonld", data: websiteSchema(origin, siteLangs) });
  // No trail on the homepage: a single "Home" crumb is noise.
  if (page.path !== PAGES.home.path && !page.noindex) {
    tags.push({ kind: "jsonld", data: breadcrumbSchema(origin, page, lang, available) });
  }
  if (page.path === PAGES.home.path) {
    tags.push({ kind: "jsonld", data: serviceCatalogSchema(origin, lang, { inline: true }) });
  }
  // The `Service` entities themselves live on /services; the catalogue there
  // references them by id, while the homepage inlines its own copies.
  if (page.path === PAGES.services.path) {
    tags.push({ kind: "jsonld", data: serviceCatalogSchema(origin, lang) });
    serviceSchemas(origin, lang).forEach((data) => tags.push({ kind: "jsonld", data }));
  }
  if (page.kind === "article" || page.type === "article") {
    tags.push({ kind: "jsonld", data: articleSchema(origin, page, lang) });
  }
  if (page.kind === "project" && page.item) {
    tags.push({ kind: "jsonld", data: projectSchema(origin, page.item, lang, url) });
  }
  if (page.kind === "service" && page.item) {
    tags.push({ kind: "jsonld", data: servicePageSchema(origin, page, lang, url) });
  }
  const faq = page.faq?.length ? faqSchema(page.faq) : null;
  if (faq) tags.push({ kind: "jsonld", data: faq });

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
          }${t.type ? ` type="${esc(t.type)}"` : ""}${
            t.title ? ` title="${esc(t.title)}"` : ""
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
export function availableLangs(post: ArticleLike, siteLangs: readonly Lang[] = LANGS): Lang[] {
  return LANGS.filter(
    (l) =>
      siteLangs.includes(l) &&
      (l === "en" ||
        ((post.title?.[l] ?? "").trim().length > 0 && (post.body?.[l] ?? "").trim().length > 0)),
  );
}

/** The share image for a CMS item: its first photo, cropped to card size. */
function itemImage(item: ArticleLike, lang: Lang): Pick<PageSeo, "image" | "imageSized" | "imageAlt"> {
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

/** One language of a LocalizedText stored in `meta` (the service landing-page
 *  fields), with no cross-language fallback — an empty string means absent. */
function metaText(item: ArticleLike, key: string, lang: Lang): string {
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
function servicePageSchema(origin: string, page: PageSeo, lang: Lang, url: string) {
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

/* ------------------------------------------------------ dashboard overrides */

/** A per-language text as the API stores it, or the legacy plain string. */
type Localised = string | Partial<Record<Lang, string>> | null | undefined;

/** One row of `GET /api/seo` — a per-page override edited in the dashboard. */
export interface SeoOverride {
  key: string;
  title?: Localised;
  description?: Localised;
  keywords?: string;
  image?: string;
  noindex?: boolean | null;
}

/** A legacy string override is an English one. */
function localisedOverride(value: Localised): Partial<Record<Lang, string>> {
  if (!value) return {};
  if (typeof value === "string") return { en: value };
  return value;
}

/** The non-blank translations, minus English (which lives in `title`/`desc`). */
function translationsOf(value: Partial<Record<Lang, string>>): Partial<Record<Lang, string>> | undefined {
  const out: Partial<Record<Lang, string>> = {};
  for (const l of LANGS) {
    if (l !== "en" && value[l]?.trim()) out[l] = value[l]!.trim();
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Merges dashboard overrides onto the compiled-in `PAGES` table.
 *
 * A blank string means "inherit", never "clear": an editor who empties the
 * description field gets the built-in one back rather than a page with no
 * description at all. `noindex` is three-state for the same reason — only an
 * explicit `true`/`false` overrides, `null`/absent inherits.
 *
 * Translations are kept apart from the English text: `title` is what the
 * dictionary lookup keys on, `titleByLang` is what an editor typed for one
 * language and wins outright there (see `resolveTitle`).
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
    const title = localisedOverride(o.title);
    const description = localisedOverride(o.description);
    merged[o.key] = {
      ...base,
      title: title.en?.trim() || base.title,
      desc: description.en?.trim() || base.desc,
      titleByLang: translationsOf(title),
      descByLang: translationsOf(description),
      keywords: o.keywords?.trim() || base.keywords,
      image: o.image?.trim() || base.image,
      // A dashboard share image is a raw URL of unknown size; claim nothing.
      imageSized: o.image?.trim() ? false : base.imageSized,
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
  if (SELF_DESCRIBED.some((prefix) => clean.startsWith(prefix))) return null;
  if (clean.startsWith("/q/")) return pages.quote ?? PAGES.quote;
  return Object.values(pages).find((p) => p.path === clean) ?? pages.notFound ?? PAGES.notFound;
}
