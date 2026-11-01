import type { Lang } from "../langs.ts";
import { translate } from "../dict/index.ts";
import type { ArticleLike, PageSeo } from "./types.ts";

/**
 * Translates a title, description or keyword list through the same dictionary
 * the UI uses, keyed by the exact English string.
 *
 * Per-language URLs on their own are not enough: a German page serving the
 * English `<title>` and description still reads to Google as a near-duplicate
 * of the English one, which is the outcome the hreflang cluster exists to
 * prevent. Falls back to the English text so a missing entry degrades to
 * "untranslated" rather than "empty".
 */
export function tr(text: string, lang: Lang): string;
export function tr(text: string | undefined, lang: Lang): string | undefined;
export function tr(text: string | undefined, lang: Lang): string | undefined {
  if (!text || lang === "en") return text;
  return translate(text, lang);
}

/**
 * The title for one language: an editor's explicit translation first, then the
 * English text (built-in or overridden) through the dictionary.
 *
 * Before per-language overrides existed, any title edited in the dashboard
 * turned every translated page's `<title>` into that English string — the
 * dictionary is keyed by the *built-in* English, so the edited text matched
 * nothing and fell through untranslated.
 */
export function resolveTitle(page: PageSeo, lang: Lang): string {
  return page.titleByLang?.[lang]?.trim() || tr(page.title, lang);
}

export function resolveDesc(page: PageSeo, lang: Lang): string {
  return page.descByLang?.[lang]?.trim() || tr(page.desc, lang);
}

/** Roughly where Google cuts a title or a description in the results. */
const TITLE_MAX = 60;
const DESC_MAX = 160;

/**
 * A title that fits the results page. Past the limit the trailing brand goes
 * first: Google shows the site name above the result anyway, and a cut-off
 * headline ("…how a restaurant owner should actually decide | KF Tec…") reads
 * worse than a whole one without the suffix. The headline itself is never cut.
 */
export function fitTitle(title: string): string {
  if (title.length <= TITLE_MAX) return title;
  const m = title.match(/^(.*\S)\s+[|—–-]\s+KF Tech[^|—–]*$/);
  return m ? m[1] : title;
}

/**
 * A description that fits the results page: whole sentences where they fit,
 * else cut at a word with an ellipsis. Long card summaries (GenTrack's runs to
 * 280 characters) otherwise end mid-word in the snippet.
 */
export function fitDesc(desc: string): string {
  const d = desc.replace(/\s+/g, " ").trim();
  if (d.length <= DESC_MAX) return d;
  const head = d.slice(0, DESC_MAX);
  const stop = Math.max(...[". ", "! ", "? ", "؟ ", "。"].map((p) => head.lastIndexOf(p)));
  if (stop >= 90) return head.slice(0, stop + 1);
  const space = head.lastIndexOf(" ", DESC_MAX - 1);
  return `${head.slice(0, space > 90 ? space : DESC_MAX - 1).replace(/[,;:—–-]+$/, "")}…`;
}

/** One language of a CMS text, falling back to English, then Arabic. */
export function localized(text: ArticleLike["title"], lang: Lang): string {
  if (!text) return "";
  return text[lang] || text.en || text.ar || "";
}
