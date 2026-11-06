import { LANGS, type Lang } from "../langs.ts";

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
  // The spelling the Arabic pages already use for the founder.
  founderAlternateName: ["كيرلس فايز"],
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
  // other companies; alternateName ties the short forms to this entity. The
  // space gets dropped too, so "KFTech Solutions" must resolve here as well.
  alternateName: ["KF Tech", "KFTech", "KFTech Solutions"],
  // The short form the owner chose for Arabic text; the Latin forms stay
  // Latin in every language.
  alternateNamesByLang: { ar: ["كي إف تك"] } as Partial<Record<Lang, string[]>>,
  // The year on the Clutch profile; knowledge graphs use it to tell
  // same-named companies apart.
  foundingDate: "2020",
  // Structured data only — never shown as text (the owner's decision).
  numberOfEmployees: { min: 2, max: 9 },
  // Industry codes Google says it reads "behind the scenes" to disambiguate
  // an organisation: custom computer programming services.
  naics: "541511",
  isicV4: "6201",
  // Both are dictionary keys: the slogan is visible copy on the homepage, the
  // description is the Organization's own and names the brand, the city, the
  // founder and the year — the four facts that separate it from a namesake.
  slogan: "Ideas into real, working products",
  description:
    "KF Tech Solutions is an independent software studio in Cairo, Egypt, founded in 2020 by Kirollos Fayez. It builds custom software, web and mobile apps, POS and business systems, and AI automation for businesses in Egypt and worldwide.",
  // The founder's own profiles. They go on the Person node only, never on the
  // Organization (see sameAs above).
  founderSameAs: ["https://github.com/kirollosfayezh"],
  // Real, unrelated businesses that AI assistants have answered with when
  // asked for "KF Tech Solutions" (ChatGPT, Nov 2026, gave kftechsols.com).
  // Named in llms.txt and disambiguatingDescription so a model reading either
  // can separate the two.
  notAffiliatedWith: [{ name: "KFTECH Software Solutions", url: "https://kftechsols.com" }],
} as const;

/**
 * The one-sentence "which KF Tech is this" answer, shared by JSON-LD and
 * llms.txt. English only: machines read it, and the visible About note and
 * FAQ already say it to readers in their language. `id` defaults to the live
 * identity; `setSiteIdentity` never leaves its list empty, so only a caller
 * passing its own can get the sentence without the "not affiliated" clause.
 */
export function disambiguation(
  origin: string,
  id: Pick<SiteIdentity, "foundingDate" | "notAffiliatedWith"> = siteIdentity(),
): string {
  const { foundingDate, notAffiliatedWith } = id;
  const others = notAffiliatedWith.map((o) => `${o.name} (${new URL(o.url).host})`).join(" or ");
  return (
    `${SITE.name} is a software studio in ${SITE.city}, Egypt, founded by ${SITE.founder} in ${foundingDate}; ` +
    `its only website is ${new URL(origin).host}.` +
    (others ? ` It is not affiliated with ${others}.` : "")
  );
}

/**
 * Fallback share image: the branded card in `public/`, 1200×630 as Facebook
 * and X expect. It replaced an Unsplash stock photo — a share card is the one
 * place the brand should be recognisable, not a generic laptop.
 */
export const OG_IMAGE = "/og-default.png";
export const OG_IMAGE_ALT = "KF Tech Solutions — custom software, POS systems and AI automation";

/**
 * The brand facts an editor can change in the dashboard. `SITE` stays the
 * compiled-in default; `setSiteIdentity` lets both the build (from the fetched
 * settings) and the runtime (from the settings context) replace them before
 * the schema is written, so the Organization node, llms.txt and the footer
 * never disagree. Every field falls back on its own: a settings document with
 * only the phone filled in still ships the compiled aliases and profiles.
 */
export interface SiteIdentityInput {
  phone?: string;
  email?: string;
  /** The social profiles (the footer's), already resolved against their defaults. */
  sameAs?: string[];
  /** Directories and other company profiles that have no footer icon. */
  profiles?: string[];
  alternateNames?: Partial<Record<Lang, string[]>>;
  foundingDate?: string;
  founderSameAs?: string[];
  notAffiliatedWith?: { name: string; url: string }[];
}

export interface SiteIdentity {
  phone: string;
  email: string;
  /** Social profiles first, then directories, deduplicated. */
  sameAs: string[];
  alternateNames: Record<Lang, string[]>;
  foundingDate: string;
  founderSameAs: string[];
  notAffiliatedWith: { name: string; url: string }[];
}

const cleanList = (list: readonly string[] | undefined): string[] =>
  [...new Set((list ?? []).map((s) => s.trim()).filter(Boolean))];

/** The given list when it has anything in it, else the compiled default. */
const listOr = (next: readonly string[] | undefined, fallback: readonly string[]): string[] => {
  const cleaned = cleanList(next);
  return cleaned.length ? cleaned : [...fallback];
};

function resolveIdentity(next: SiteIdentityInput): SiteIdentity {
  const alternateNames = {} as Record<Lang, string[]>;
  for (const l of LANGS) {
    const fallback = l === "en" ? SITE.alternateName : (SITE.alternateNamesByLang[l] ?? []);
    alternateNames[l] = listOr(next.alternateNames?.[l], fallback);
  }
  const notAffiliatedWith = (next.notAffiliatedWith ?? []).filter((o) => o.name?.trim() && o.url?.trim());
  return {
    phone: next.phone?.trim() || SITE.phone,
    email: next.email?.trim() || SITE.email,
    sameAs: [...new Set([...listOr(next.sameAs, SITE.sameAs), ...listOr(next.profiles, SITE.extraSameAs)])],
    alternateNames,
    foundingDate: next.foundingDate?.trim() || SITE.foundingDate,
    founderSameAs: listOr(next.founderSameAs, SITE.founderSameAs),
    notAffiliatedWith: notAffiliatedWith.length ? notAffiliatedWith : [...SITE.notAffiliatedWith],
  };
}

let identity: SiteIdentity = resolveIdentity({});

export function setSiteIdentity(next: SiteIdentityInput): void {
  identity = resolveIdentity(next);
}

/** Back to the compiled defaults — for tests, which share the module state. */
export function resetSiteIdentity(): void {
  identity = resolveIdentity({});
}

export function siteIdentity(): SiteIdentity {
  return identity;
}

/** Every alias in every language, Latin forms first, for the Organization node. */
export function allAlternateNames(): string[] {
  const order = [...LANGS.filter((l) => l !== "ar"), "ar" as const];
  return [...new Set(order.flatMap((l) => identity.alternateNames[l]))];
}
