import type { SiteSettings } from "../services/api-types.ts";

/**
 * Contact details and social profiles, resolved from site settings.
 *
 * Deliberately React-free: `build/seo-build.ts` needs the same resolution at
 * build time so the prerendered Organization schema matches what the footer
 * renders once settings arrive. The defaults are what the site shipped with
 * hardcoded, so an empty settings document changes nothing visible.
 */

export const DEFAULT_CONTACT = {
  email: "kirollos.fayez.h@gmail.com",
  phone: "+20 150 009 9671",
  whatsapp: "201500099671",
} as const;

export type SocialKey = "facebook" | "instagram" | "linkedin" | "x" | "github" | "youtube" | "tiktok";

/** The footer's order; also the order profiles appear in `sameAs`. */
export const SOCIAL_ORDER: SocialKey[] = ["facebook", "instagram", "linkedin", "x", "github", "youtube", "tiktok"];

export const DEFAULT_SOCIAL: Partial<Record<SocialKey, string>> = {
  facebook: "https://www.facebook.com/profile.php?id=61584985085435",
  linkedin: "https://linkedin.com/in/kirollos-fayez-65a33931a",
  github: "https://github.com/koko619911",
};

export interface ContactInfo {
  email: string;
  phone: string;
  whatsapp: string;
}

const clean = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Per field: the dashboard value, else the compiled-in default. */
export function resolveContact(settings?: SiteSettings["contact"] | null): ContactInfo {
  return {
    email: clean(settings?.email) || DEFAULT_CONTACT.email,
    phone: clean(settings?.phone) || DEFAULT_CONTACT.phone,
    whatsapp: whatsappDigits(clean(settings?.whatsapp)) || DEFAULT_CONTACT.whatsapp,
  };
}

/** `https://x.com/kftech` for a handle, or the URL as typed. */
function socialUrl(key: SocialKey, value: string): string | null {
  if (/^https?:\/\//i.test(value)) return value;
  const handle = value.replace(/^@/, "");
  if (!handle) return null;
  if (key === "x") return `https://x.com/${handle}`;
  return null;
}

/**
 * The profiles to show. All blank in settings → today's defaults, so the
 * footer never empties when the settings document has simply not been filled
 * in; otherwise exactly the configured ones, in a fixed order.
 */
export function resolveSocial(settings?: SiteSettings["social"] | null): { key: SocialKey; href: string }[] {
  const configured = SOCIAL_ORDER.flatMap((key) => {
    const href = socialUrl(key, clean(settings?.[key]));
    return href ? [{ key, href }] : [];
  });
  if (configured.length) return configured;
  return SOCIAL_ORDER.flatMap((key) => (DEFAULT_SOCIAL[key] ? [{ key, href: DEFAULT_SOCIAL[key]! }] : []));
}

/** `+20 150 009 9671` → `201500099671`, the form wa.me links want. */
export function whatsappDigits(value: string): string {
  return value.replace(/\D+/g, "");
}

/** What the Organization schema needs, from settings. */
export function identityFromSettings(settings: SiteSettings | null | undefined): {
  phone: string;
  email: string;
  sameAs: string[];
} {
  const contact = resolveContact(settings?.contact);
  return {
    phone: contact.phone,
    email: contact.email,
    sameAs: resolveSocial(settings?.social).map((s) => s.href),
  };
}
