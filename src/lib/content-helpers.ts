// Extensions on these imports, like the SEO layer's: `lib/seo` reads
// `articleExtras` for the BlogPosting and share-image tags, and
// tsconfig.node.json checks that code under Node's module rules, which need them.
import type { LocalizedText } from "../services/api-types.ts";
import { dictFor } from "./dict/index.ts";
import type { Lang } from "./langs.ts";

/**
 * Reads the requested language out of a CMS field, falling back to the UI
 * dictionary before falling back to English.
 *
 * The CMS now stores all four languages, so a stored value always wins. The
 * dictionary still backs it up for two reasons: the seeder writes `ar: ""`
 * "until translations are supplied through the dashboard", and every document
 * written before `de`/`fr` existed has neither. Without the lookup the whole
 * catalogue would render in English on a non-English page.
 *
 * Doing it here rather than in the seed data also fixes already-seeded
 * databases, and anything an admin types in the dashboard still wins.
 */
export function pick(text: LocalizedText | undefined, lang: Lang): string {
  if (!text) return "";

  const stored = text[lang];
  if (stored?.trim()) return stored;

  const english = (text.en || text.ar || "").trim();
  if (lang !== "en" && english) {
    const translated = dictFor(lang)[english];
    if (translated?.trim()) return translated;
  }
  return english;
}

/** Same dictionary fallback for plain (non-localised) CMS strings, such as the
 *  bullet lists stored in `meta.points`. */
export function pickPlain(value: string | undefined, lang: Lang): string {
  const s = (value || "").trim();
  if (!s || lang === "en") return s;
  return dictFor(lang)[s]?.trim() || s;
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

/** A concept demo (a made-up business we designed) rather than client work. */
export function isConcept(meta: Record<string, unknown> | undefined): boolean {
  return meta?.concept === true;
}

export function metaPoints(meta: Record<string, unknown> | undefined, key = "points"): string[] {
  const v = meta?.[key];
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

/** An article's photo caption and alt text, stats band and tag chips, in one language. */
export interface ArticleExtras {
  caption?: string;
  alt?: string;
  stats: { value: string; label: string }[];
  tags: string[];
}

/**
 * `meta.stats` — the design export's "THE ROUGH MATH" band. Stored as
 * `["40 min", "saved per night"]` pairs so an editor can add one without a
 * schema change; anything malformed is skipped rather than rendered half-empty.
 */
function statPairs(raw: unknown): { value: string; label: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is string[] => Array.isArray(r) && typeof r[0] === "string" && typeof r[1] === "string")
    .map(([value, label]) => ({ value, label }));
}

/**
 * An article's front-matter extras in one language.
 *
 * The seeder stores a translation's own caption, alt text, stats and tags
 * under `meta.i18n.<lang>`, and those are shown as written. Whatever a
 * translation did not write falls back to the English value through the
 * dictionary — which is all there was before, so an article whose
 * translations carry no extras renders exactly as it did. Stats and tags fall
 * back as whole lists, never item by item: a translation may count or group
 * them differently.
 *
 * React-free: the BlogPosting keywords and the share image's alt text read
 * it too, at build time as well as in the browser.
 */
export function articleExtras(meta: Record<string, unknown> | undefined, lang: Lang): ArticleExtras {
  const byLang = meta?.i18n;
  const raw = byLang && typeof byLang === "object" ? (byLang as Record<string, unknown>)[lang] : undefined;
  const own = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : undefined;

  const text = (key: string) => metaString(own, key) ?? (pickPlain(metaString(meta, key), lang) || undefined);
  const ownStats = statPairs(own?.stats);
  const ownTags = metaPoints(own, "tags");
  return {
    caption: text("caption"),
    alt: text("alt"),
    stats: ownStats.length
      ? ownStats
      : statPairs(meta?.stats).map(({ value, label }) => ({ value: pickPlain(value, lang), label: pickPlain(label, lang) })),
    tags: ownTags.length ? ownTags : metaPoints(meta, "tags").map((tag) => pickPlain(tag, lang)),
  };
}

/**
 * Whether a list card belongs on this language's pages. `cardView` names a
 * post's languages in `meta.langs` only when it lacks a translation, so a card
 * without the field — a post written in all four, or one from an API that
 * predates it — is listed everywhere.
 */
export function listedIn(meta: Record<string, unknown> | undefined, lang: Lang): boolean {
  const langs = meta?.langs;
  return !Array.isArray(langs) || langs.includes(lang);
}

/**
 * The blog's region filter, in chip order, and the English tags that put a
 * post in each (compared case-insensitively). The four smaller Gulf states
 * have no chip of their own; they are under "GCC" with the Gulf-wide posts.
 */
export const BLOG_REGIONS = [
  { label: "Saudi Arabia", tags: ["saudi arabia", "ksa"] },
  { label: "UAE", tags: ["uae", "united arab emirates", "dubai", "abu dhabi"] },
  { label: "GCC", tags: ["gcc", "gulf", "kuwait", "qatar", "bahrain", "oman"] },
  { label: "Egypt", tags: ["egypt"] },
] as const;

export type BlogRegion = (typeof BLOG_REGIONS)[number]["label"];

/** The regions a post's English `meta.tags` place it in — never the translated tags. */
export function postRegions(meta: Record<string, unknown> | undefined): BlogRegion[] {
  const tags = new Set(metaPoints(meta, "tags").map((tag) => tag.trim().toLowerCase()));
  return BLOG_REGIONS.filter((r) => r.tags.some((tag) => tags.has(tag))).map((r) => r.label);
}

export function initials(text: string): string {
  return text
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}
