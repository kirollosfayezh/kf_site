import { LANGS, type Lang } from "../../langs.ts";
import { OG_IMAGE, SITE, allAlternateNames, disambiguation, siteIdentity } from "../site.ts";
import { tr } from "../text.ts";
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
  // The rest of the GCC, served from the /gulf page.
  { "@type": "Country", name: "Kuwait" },
  { "@type": "Country", name: "Qatar" },
  { "@type": "Country", name: "Bahrain" },
  { "@type": "Country", name: "Oman" },
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
  // Gulf work: the site itself is a four-language right-to-left build, and
  // e-invoicing integration is offered to the published ZATCA and UAE
  // specifications — work KF builds, never an accreditation it holds.
  // Payment gateways and Salla/Zid stay out until one has been built.
  "Arabic-first (RTL) websites and mobile apps",
  "ZATCA e-invoicing (FATOORA Phase 2) integration",
  "UAE e-invoicing (PINT AE) data preparation and ASP integration",
];

/**
 * One organisation node, anchored by `@id`, that every other node references.
 *
 * `["Organization", "LocalBusiness"]` is deliberate: "software company in
 * Cairo" searches and the Business Profile tie the site to a place, and
 * `LocalBusiness` is the type that carries one. Locality only — no street
 * address is claimed, because none is public. `ProfessionalService`, which
 * the node once listed too, is deprecated by schema.org itself.
 *
 * `areaServed` carries the geography beyond Cairo. It is *not* in Google's
 * supported-properties list, so it is an entity/AI-retrieval signal rather
 * than anything that shows in search.
 *
 * Every fact here that could tell this company from a namesake — the aliases,
 * the description, the founder, the year, the city, the size, the industry
 * codes, the "not affiliated" sentence — is stated so a knowledge graph reading
 * only this node can separate the two. No `legalName`: it is unconfirmed, and
 * a guessed one is worse than none.
 *
 * `aggregateRating` is deliberately absent and must stay absent: review markup
 * about yourself, on your own site, is ineligible for star treatment and risks a
 * manual action. Ratings belong on Clutch and G2, whose pages carry them
 * legitimately.
 */
export function organisationSchema(origin: string, lang: Lang = "en", siteLangs: readonly Lang[] = LANGS) {
  const { email, phone, sameAs, foundingDate } = siteIdentity();
  const languages = siteLangs.map((l) => LANGUAGE_NAMES[l]);
  return {
    "@context": "https://schema.org",
    "@type": ["Organization", "LocalBusiness"],
    "@id": `${origin}/#organization`,
    name: SITE.name,
    // Every language's aliases on every page: the Arabic form has to resolve
    // to this entity whichever page a crawler reads it from.
    alternateName: allAlternateNames(),
    url: `${origin}/`,
    // Google wants the logo as an ImageObject with its real dimensions; the
    // 512 icon is square, which is the one shape it never crops.
    logo: { "@type": "ImageObject", url: absolute(origin, SITE.logo), width: 512, height: 512 },
    image: absolute(origin, OG_IMAGE),
    description: tr(SITE.description, lang),
    slogan: tr(SITE.slogan, lang),
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
    founder: founderSchema(origin, lang),
    foundingDate,
    foundingLocation: {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: SITE.city, addressCountry: SITE.country },
    },
    numberOfEmployees: {
      "@type": "QuantitativeValue",
      minValue: SITE.numberOfEmployees.min,
      maxValue: SITE.numberOfEmployees.max,
    },
    naics: SITE.naics,
    isicV4: SITE.isicV4,
    // Schema.org's own field for "not the other company with this name".
    disambiguatingDescription: disambiguation(origin),
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
    sameAs,
    knowsAbout: KNOWS_ABOUT,
  };
}

/** What the founder personally works on — a subset of the company's list. */
const FOUNDER_KNOWS_ABOUT = new Set([
  "Custom software development",
  "Web development",
  "Mobile app development",
  "POS systems",
  "AI automation",
  "API and backend engineering",
  "System integration",
]);

/**
 * The founder as their own entity, with one stable `@id` that article authors
 * reference. Their sameAs is personal (GitHub), never the company's profiles,
 * so a knowledge graph keeps the person and the brand as two linked things.
 * The description is the article byline, so the two can never disagree.
 */
export function founderSchema(origin: string, lang: Lang = "en") {
  return {
    "@type": "Person",
    "@id": `${origin}/about#founder`,
    name: SITE.founder,
    alternateName: [...SITE.founderAlternateName],
    jobTitle: "Founder & Lead Developer",
    description: `${tr("Founder, KF Tech Solutions", lang)} · ${tr("Builds POS, web and automation systems for businesses in Egypt and abroad.", lang)}`,
    url: `${origin}/about`,
    image: absolute(origin, "/founder.jpg"),
    sameAs: siteIdentity().founderSameAs,
    knowsAbout: KNOWS_ABOUT.filter((k) => FOUNDER_KNOWS_ABOUT.has(k)),
    worksFor: { "@id": `${origin}/#organization` },
  };
}

export function websiteSchema(origin: string, siteLangs: readonly Lang[] = LANGS, lang: Lang = "en") {
  const { alternateNames } = siteIdentity();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${origin}/#website`,
    url: `${origin}/`,
    name: SITE.name,
    // Google's site-name feature reads WebSite.alternateName, so this one is
    // per page: the Latin forms everywhere, this language's own on top. An
    // Arabic alias on the English page would be an Arabic site name in Latin
    // results.
    alternateName: [...new Set([...alternateNames.en, ...alternateNames[lang]])],
    publisher: { "@id": `${origin}/#organization` },
    inLanguage: [...siteLangs],
  };
}
