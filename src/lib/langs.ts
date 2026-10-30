/**
 * Language primitives, deliberately free of React.
 *
 * `lib/seo/` is imported by the Vite build script (`build/seo-build.ts`) in
 * plain Node to prerender pages and write the sitemap. If these lived in
 * `lib/i18n.tsx` that import would drag React and JSX into the config load and
 * break the build, so the plain values live here and both sides import them.
 */

export const LANGS = ["en", "ar", "de", "fr"] as const;
export type Lang = (typeof LANGS)[number];

/** Arabic is the only right-to-left language the site ships. */
const RTL: ReadonlySet<Lang> = new Set<Lang>(["ar"]);

export function isLang(value: unknown): value is Lang {
  return typeof value === "string" && (LANGS as readonly string[]).includes(value);
}

export function dirOf(lang: Lang): "ltr" | "rtl" {
  return RTL.has(lang) ? "rtl" : "ltr";
}

/** Display metadata for the language switcher, in the order it should appear. */
export const LANG_META: Record<Lang, { short: string; label: string }> = {
  en: { short: "EN", label: "English" },
  ar: { short: "AR", label: "العربية" },
  de: { short: "DE", label: "Deutsch" },
  fr: { short: "FR", label: "Français" },
};
