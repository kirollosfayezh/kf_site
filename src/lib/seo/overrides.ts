import { LANGS, type Lang } from "../langs.ts";
import { PAGES } from "./pages.ts";
import type { PageSeo } from "./types.ts";

/** A per-language text as the API stores it, or the legacy plain string. */
type Localised = string | Partial<Record<Lang, string>> | null | undefined;

/** One row of `GET /api/seo` — a per-page override edited in the dashboard. */
export interface SeoOverride {
  key: string;
  title?: Localised;
  description?: Localised;
  keywords?: string;
  image?: string;
  noindex?: boolean | null;
}

/** A legacy string override is an English one. */
function localisedOverride(value: Localised): Partial<Record<Lang, string>> {
  if (!value) return {};
  if (typeof value === "string") return { en: value };
  return value;
}

/** The non-blank translations, minus English (which lives in `title`/`desc`). */
function translationsOf(value: Partial<Record<Lang, string>>): Partial<Record<Lang, string>> | undefined {
  const out: Partial<Record<Lang, string>> = {};
  for (const l of LANGS) {
    if (l !== "en" && value[l]?.trim()) out[l] = value[l]!.trim();
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * Merges dashboard overrides onto the compiled-in `PAGES` table.
 *
 * A blank string means "inherit", never "clear": an editor who empties the
 * description field gets the built-in one back rather than a page with no
 * description at all. `noindex` is three-state for the same reason — only an
 * explicit `true`/`false` overrides, `null`/absent inherits.
 *
 * Translations are kept apart from the English text: `title` is what the
 * dictionary lookup keys on, `titleByLang` is what an editor typed for one
 * language and wins outright there (see `resolveTitle`).
 *
 * Unknown keys are ignored rather than added, so a stale row left behind by a
 * renamed route can never introduce a page the router does not serve.
 */
export function mergeSeoOverrides(overrides: SeoOverride[] | undefined | null): Record<string, PageSeo> {
  if (!overrides?.length) return PAGES;

  const merged: Record<string, PageSeo> = { ...PAGES };
  for (const o of overrides) {
    const base = PAGES[o.key];
    if (!base) continue;
    const title = localisedOverride(o.title);
    const description = localisedOverride(o.description);
    merged[o.key] = {
      ...base,
      title: title.en?.trim() || base.title,
      desc: description.en?.trim() || base.desc,
      titleByLang: translationsOf(title),
      descByLang: translationsOf(description),
      keywords: o.keywords?.trim() || base.keywords,
      image: o.image?.trim() || base.image,
      // A dashboard share image is a raw URL of unknown size; claim nothing.
      imageSized: o.image?.trim() ? false : base.imageSized,
      noindex: typeof o.noindex === "boolean" ? o.noindex : base.noindex,
    };
  }
  return merged;
}
