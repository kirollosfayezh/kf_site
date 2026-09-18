import type { LocalizedText } from "../services/api-types";
import type { Lang } from "./i18n";

export function pick(text: LocalizedText | undefined, lang: Lang): string {
  if (!text) return "";
  return (lang === "ar" ? text.ar : text.en) || text.en || text.ar || "";
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
