import { LANGS, type Lang } from "../langs.ts";

export function absolute(origin: string, pathOrUrl: string): string {
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  return `${origin}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
}

/** BCP-47 tags and OG locales for each language the site serves. */
export const LOCALES: Record<Lang, { hreflang: string; og: string }> = {
  en: { hreflang: "en", og: "en_US" },
  ar: { hreflang: "ar", og: "ar_EG" },
  de: { hreflang: "de", og: "de_DE" },
  fr: { hreflang: "fr", og: "fr_FR" },
};

/** English names of the languages, for schema `availableLanguage` fields. */
export const LANGUAGE_NAMES: Record<Lang, string> = {
  en: "English",
  ar: "Arabic",
  de: "German",
  fr: "French",
};

/**
 * The path a page lives at in a given language. English is the root; every other
 * language gets a prefix — `/ar/services`, `/de/services`.
 *
 * This replaces `?lang=de`. Google's multi-regional guidance rates URL
 * parameters "Not recommended", and the previous setup failed in a specific,
 * silent way: the canonical always pointed at the unsuffixed path, so each
 * translated variant canonicalised away to English. A self-contradictory cluster
 * like that is discarded wholesale, which meant the hreflang did nothing at all.
 *
 * Worse, a query string does not change which static file is served, so
 * `/?lang=de` returned the *English* prerendered HTML. There was no German page
 * for a crawler to index — the translation only appeared after hydration.
 */
export function localePath(lang: Lang, path: string): string {
  if (lang === "en") return path;
  const clean = path === "/" ? "" : path;
  return `/${lang}${clean}`;
}

/** Every language variant of a page, as real URLs a crawler can fetch. */
export function languageAlternates(origin: string, path: string, langs: readonly Lang[] = LANGS) {
  return [
    ...langs.map((l) => ({
      hreflang: LOCALES[l].hreflang,
      href: absolute(origin, localePath(l, path)),
    })),
    // x-default points at the language-neutral entry point, which for this site
    // is the English root.
    { hreflang: "x-default", href: absolute(origin, path) },
  ];
}
