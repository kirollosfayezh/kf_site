import type { LocalizedText } from "../services/api-types";
import dict from "./i18n-dict.json";
import type { Lang } from "./langs";

const DICT = dict as Record<string, Record<Lang, string>>;

/**
 * Reads the requested language out of a CMS field, falling back to the UI
 * dictionary before falling back to English.
 *
 * `LocalizedText` only has `en` and `ar` fields — those are the two languages
 * the CMS stores. German and French therefore always resolve through the
 * dictionary, which is correct: the copy was lifted from the design export and
 * that export ships a German and French translation for each of those strings.
 *
 * Arabic additionally needs this because the seeder writes `ar: ""` "until
 * translations are supplied through the dashboard"; without the lookup the
 * whole catalogue renders in English on a non-English page.
 *
 * Doing it here rather than in the seed data also fixes already-seeded
 * databases, and anything an admin types in the dashboard still wins — a real
 * stored value is always preferred over the dictionary.
 */
export function pick(text: LocalizedText | undefined, lang: Lang): string {
  if (!text) return "";

  const stored = lang === "ar" ? text.ar : lang === "en" ? text.en : undefined;
  if (stored?.trim()) return stored;

  const english = (text.en || text.ar || "").trim();
  if (lang !== "en" && english) {
    const translated = DICT[english]?.[lang];
    if (translated?.trim()) return translated;
  }
  return english;
}

/** Same dictionary fallback for plain (non-localised) CMS strings, such as the
 *  bullet lists stored in `meta.points`. */
export function pickPlain(value: string | undefined, lang: Lang): string {
  const s = (value || "").trim();
  if (!s || lang === "en") return s;
  return DICT[s]?.[lang]?.trim() || s;
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
