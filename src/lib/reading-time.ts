import { LANGS, type Lang } from "./langs.ts";

/**
 * Reading time in minutes, from the body rather than a field an editor has to
 * keep in step with their own edits.
 *
 * 200 wpm is the usual English figure. Arabic is counted the same way: word
 * counts run lower for the same content, which offsets the slower per-word
 * rate closely enough for a rounded "N min read".
 */
export function readingMinutes(source: string): number {
  const words = (source || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

type Texts = Partial<Record<Lang, string>>;

interface Cardable {
  title?: Texts;
  summary?: Texts;
  body?: Texts;
  meta?: Record<string, unknown>;
  published?: boolean;
}

/**
 * The `meta` keys a card reads: the category chip, and the tags behind the
 * blog's region chips. The rest — caption, alt text, stats and their
 * translations in `meta.i18n` — is only read on the article page, which loads
 * the whole item; carried on every card it was about a third of each one.
 */
const CARD_META = ["tag", "tags"] as const;

/** The texts `pick()` can return in `lang`: its own when written, else English, else Arabic. */
function textsFor(text: Texts | undefined, lang: Lang): Texts | undefined {
  if (!text) return text;
  const keep: Lang[] = text[lang]?.trim() ? [lang] : text.en?.trim() ? [lang, "en"] : [lang, "en", "ar"];
  return Object.fromEntries(keep.filter((l) => text[l] !== undefined).map((l) => [l, text[l]]));
}

/**
 * An item as a list card needs it: no body, the reading time per language in
 * `meta.readingMinutes` instead, and only the `meta` a card reads. Mirrors
 * `cardView` in kf_backend's content service (`GET /content/:collection?view=card`),
 * so the prerendered snapshot and the client's revalidation agree. Each
 * language counts the body `pick()` would show it: its own when written, else
 * English, else Arabic. `published` goes too: a public list holds nothing else.
 *
 * `meta.langs` names the languages the post is written in (title and body, as
 * `availableLangs` counts them), so the blog can leave an English-only post off
 * `/de/blog`. Only when that is not all four: the usual card pays nothing.
 *
 * Given `lang`, the card is trimmed further to what that language's page can
 * show — its title, summary and minutes — for the prerender's per-language
 * snapshot. Every page embeds the list inline, and with ~100 posts the four
 * languages of every title and summary were most of it. The client's own
 * fetch stays whole; `sameItems` compares ids and dates, so the two agree.
 */
export function cardView<T extends Cardable>(item: T, lang?: Lang): T {
  const { body, published: _published, ...rest } = item;
  if (!body) return item;
  const fallback = body.en?.trim() ? body.en : (body.ar ?? "");
  const minutes: Partial<Record<Lang, number>> = Object.fromEntries(
    LANGS.map((l) => [l, readingMinutes(body[l]?.trim() ? (body[l] as string) : fallback)]),
  );
  const langs = LANGS.filter((l) => l === "en" || (item.title?.[l]?.trim() && body[l]?.trim()));
  const meta: Record<string, unknown> = {};
  for (const k of CARD_META) if (item.meta?.[k] !== undefined) meta[k] = item.meta[k];
  meta.readingMinutes = lang ? { [lang]: minutes[lang] } : minutes;
  if (langs.length < LANGS.length) meta.langs = langs;
  if (!lang) return { ...rest, meta } as unknown as T;
  return { ...rest, title: textsFor(item.title, lang), summary: textsFor(item.summary, lang), meta } as unknown as T;
}

/** A card's "N min read": from the card view, or counted from the body when the item still has one. */
export function cardMinutes<T extends Cardable>(item: T, lang: Lang, pickBody: (body: T["body"]) => string): number {
  const stored = (item.meta?.readingMinutes as Partial<Record<Lang, number>> | undefined)?.[lang];
  return typeof stored === "number" && stored > 0 ? stored : readingMinutes(pickBody(item.body));
}
