import { listedIn } from "./content-helpers.ts";
import type { Lang } from "./langs.ts";

/** The fields of a blog card this needs. */
export interface GuideCard {
  slug?: string;
  id?: string;
  createdAt?: string;
  meta?: Record<string, unknown>;
}

/**
 * Which articles belong under which service, by the English topic tags the
 * articles already carry (`meta.tag` is the primary category, `meta.tags` the
 * keywords). Compared case-insensitively. A primary-category match weighs
 * more than a keyword match, so an article *about* POS outranks one that
 * mentions POS in passing.
 */
const MATCH: Record<string, { primary: string[]; tags: string[] }> = {
  "custom-software": {
    primary: [],
    tags: ["custom software", "software cost", "custom software cost", "software development cost", "buy vs build", "software company", "vendor selection", "outsourcing", "contracts", "software contract", "fixed price", "time and materials", "scoping", "software requirements", "project brief", "ip ownership", "software handover", "software maintenance", "custom erp"],
  },
  "web-development": {
    primary: ["web development"],
    tags: ["web development", "website design", "web design", "website cost", "landing page", "seo", "e-commerce", "online store", "shopify", "bilingual website", "arabic website", "multilingual website", "real estate website", "export website"],
  },
  "mobile-applications": {
    primary: ["mobile"],
    tags: ["app development", "mobile app development", "app development cost", "mobile app cost", "mvp", "flutter", "react native", "pwa", "mobile apps", "delivery app"],
  },
  "business-systems": {
    primary: ["business systems", "pos system"],
    tags: ["pos", "erp", "custom erp", "inventory", "cashier system", "accounting", "hr software", "inventory management", "clinic management system", "pharmacy software"],
  },
  automation: {
    primary: ["automation"],
    tags: ["automation", "whatsapp", "chatbot", "whatsapp business api", "whatsapp reminders", "operations"],
  },
  "iot-solutions": {
    primary: [],
    tags: ["iot", "iot monitoring", "fleet management", "gps tracking", "vehicle tracking", "fuel monitoring", "generator rental", "weighing scale", "scale integration"],
  },
  "ai-solutions": {
    primary: ["ai"],
    tags: ["ai", "ai chatbot", "ocr", "ai search", "data extraction", "document search"],
  },
  "api-and-backend": {
    primary: [],
    tags: ["api integration", "api", "integration", "payment gateway", "payment integration", "online payments", "erp integration", "uae pass", "nafath", "oauth 2.0", "single sign-on", "e-invoicing"],
  },
};

const lower = (v: unknown) => (typeof v === "string" ? v.toLowerCase() : "");

function score(card: GuideCard, service: string): number {
  const rule = MATCH[service];
  if (!rule) return 0;
  const primary = lower(card.meta?.tag);
  const tags = Array.isArray(card.meta?.tags) ? (card.meta.tags as unknown[]).map(lower) : [];
  return (rule.primary.includes(primary) ? 3 : 0) + tags.filter((t) => rule.tags.includes(t)).length;
}

/**
 * Up to `limit` articles for a service page, best match first and newest on a
 * tie, among the posts published in the page's language. Empty when nothing
 * matches, so the page simply has no guides section.
 */
export function guidesFor<T extends GuideCard>(cards: readonly T[], service: string, lang: Lang, limit = 3): T[] {
  return cards
    .filter((c) => listedIn(c.meta, lang))
    .map((c) => ({ c, s: score(c, service) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || String(b.c.createdAt ?? "").localeCompare(String(a.c.createdAt ?? "")))
    .slice(0, limit)
    .map((x) => x.c);
}
