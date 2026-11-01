import type { Lang } from "../../langs.ts";
import { PAGES } from "../pages.ts";
import { tr } from "../text.ts";
import { absolute, localePath } from "../urls.ts";
import { AREA_SERVED } from "./organisation.ts";

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
export const serviceId = (origin: string, slug: string) => `${origin}/services/${slug}#service`;

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
