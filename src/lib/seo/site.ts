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
    "https://www.facebook.com/KFTechSolutionsEG/",
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
