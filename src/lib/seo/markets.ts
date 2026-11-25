/**
 * The country landing pages the site has a route for, in footer order.
 *
 * Its own module with no imports, because both `market-page.ts` (the pages'
 * SEO) and `pages.ts` (which routes own their metadata) need it, and
 * `market-page.ts` already depends on `pages.ts` through `cms.ts`. Add a
 * country here and in kf_backend's `KNOWN_MARKETS`, and the route, the footer
 * link, the prerender and the SEO audit all follow.
 */
export const MARKETS = [
  { slug: "saudi-arabia", name: "Saudi Arabia" },
  { slug: "uae", name: "UAE" },
  { slug: "kuwait", name: "Kuwait" },
  { slug: "qatar", name: "Qatar" },
  { slug: "oman", name: "Oman" },
  { slug: "gulf", name: "Other Gulf countries" },
  { slug: "jordan", name: "Jordan" },
] as const;
