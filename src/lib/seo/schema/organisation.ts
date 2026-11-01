import { LANGS, type Lang } from "../../langs.ts";
import { PAGES } from "../pages.ts";
import { OG_IMAGE, SITE, siteIdentity } from "../site.ts";
import { LANGUAGE_NAMES, absolute } from "../urls.ts";

/**
 * Based in Egypt, delivering worldwide. Schema.org has no "worldwide" enum, so
 * the markets actually served are named as `Country` entities with a catch-all
 * `Place`. Shared by the organisation and every service so the two can never
 * claim different coverage.
 */
export const AREA_SERVED = [
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
