import type { PageSeo } from "./types.ts";

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

/**
 * Routes whose page owns its own metadata, built from fetched data. The
 * Layout's `RouteSeo` must return null for these: effects run child-first, so
 * if it resolved them it would run *after* the page and overwrite the article's
 * tags with — since no PAGES entry matches — the noindex "Page not found" set.
 * That is exactly what happened to every case study and legal page on a
 * client-side navigation.
 */
export const SELF_DESCRIBED = ["/blog/", "/projects/", "/legal/", "/services/"];

/** Resolve a pathname to its PAGES entry. Returns null for routes that own
 *  their own metadata (`/blog/:id`, `/projects/:slug`, `/legal/:slug`). */
export function pageForPath(pathname: string): PageSeo | null {
  return pageForPathIn(PAGES, pathname);
}

/* ------------------------------------------------------- tag descriptors */

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
