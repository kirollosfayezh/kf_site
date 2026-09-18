import type { LocalizedText } from "../services/api-types";
import type { Lang } from "./i18n";

export function pick(text: LocalizedText | undefined, lang: Lang): string {
  if (!text) return "";
  return (lang === "ar" ? text.ar : text.en) || text.en || text.ar || "";
}

/**
 * Normalises a media URL for display.
 *
 * Unsplash serves the original file when no transform is given — the seeded
 * blog images are ~4 MB each that way, which stalls the card grid. The static
 * export always requested a sized, auto-formatted variant; this applies the
 * same transform to any bare Unsplash URL the CMS hands us. Every other URL is
 * returned untouched, so uploads and third-party media are unaffected.
 */
export function mediaUrl(src: string | undefined, width = 1200): string | undefined {
  if (!src) return src;
  if (!/^https?:\/\/images\.unsplash\.com\//.test(src)) return src;
  if (src.includes("?")) return src;
  return `${src}?w=${width}&q=80&auto=format&fit=crop`;
}

/**
 * `meta` is an untyped bag on the API contract, so these narrow the two fields
 * the card layouts depend on rather than casting at every call site. Anything
 * of the wrong shape reads as absent, which is what the fallbacks expect.
 */
export function metaString(meta: Record<string, unknown> | undefined, key: string): string | undefined {
  const v = meta?.[key];
  return typeof v === "string" && v.trim() ? v : undefined;
}

export function metaPoints(meta: Record<string, unknown> | undefined, key = "points"): string[] {
  const v = meta?.[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

export function initials(text: string): string {
  return text
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}
