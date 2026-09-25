import type { Lang } from "../langs.ts";

/**
 * The translation dictionary, loaded one language at a time.
 *
 * It used to be a single JSON file holding all four languages, imported
 * statically by three modules — so **every visitor downloaded and parsed 154 kB
 * of translations**, a third of the homepage's JavaScript, whatever language
 * they were reading in.
 *
 * The waste was worse than it sounds: the dictionary is keyed by the English
 * string, so `t("Home")` returns `"Home"` for an English reader by falling back
 * to the key. An English visitor was parsing 154 kB to look up answers it
 * already had. There is deliberately no `en.json` — English needs nothing.
 *
 * Loading is async, but a miss is harmless: `t()` falls back to the key, which
 * *is* the English copy. So the first paint of a non-English page shows English
 * for a moment rather than blank, and re-renders when the file lands.
 */

// No `with { type: "json" }` here: Vite's dev server serves JSON as a JS
// module, and the attribute makes the browser reject it — every non-English
// page then silently fell back to English in development. (Vite warns that
// its future config loader would like the attribute; the config only touches
// this module for `primeDict`/`translate`, never these loaders.)
const LOADERS: Record<Exclude<Lang, "en">, () => Promise<{ default: Record<string, string> }>> = {
  ar: () => import("./ar.json"),
  de: () => import("./de.json"),
  fr: () => import("./fr.json"),
};

const cache = new Map<Lang, Record<string, string>>([["en", {}]]);
const inFlight = new Map<Lang, Promise<Record<string, string>>>();

/**
 * Dashboard overrides, one flat map per language, laid over the shipped files.
 *
 * Kept apart from `cache` so a late-arriving dictionary chunk cannot wipe an
 * override that landed first, and so an override can exist for English too
 * (reworded copy) without English having to load a dictionary.
 */
const overrides = new Map<Lang, Record<string, string>>();
const merged = new Map<Lang, Record<string, string>>();

/** Replaces this language's dashboard overrides. */
export function setOverrides(lang: Lang, data: Record<string, string>): void {
  overrides.set(lang, data);
  merged.delete(lang);
}

/** Whether overrides for this language were already applied (by the page's
 *  embedded snapshot, ahead of anything a previous visit left in storage). */
export function hasOverrides(lang: Lang): boolean {
  return overrides.has(lang);
}

/** What is already loaded for this language, overrides included. Synchronous, for render. */
export function dictFor(lang: Lang): Record<string, string> {
  const base = cache.get(lang) ?? {};
  const over = overrides.get(lang);
  if (!over || Object.keys(over).length === 0) return base;
  // Rebuilt only when either side changes: both setters clear this entry.
  let hit = merged.get(lang);
  if (!hit) {
    hit = { ...base, ...over };
    merged.set(lang, hit);
  }
  return hit;
}

export function isDictLoaded(lang: Lang): boolean {
  return cache.has(lang);
}

/**
 * Seeds a language synchronously.
 *
 * Used by the build-time prerender, which must translate every page in every
 * language in one pass and cannot await a browser dynamic import per string.
 * The browser never calls this — it goes through `loadDict`.
 */
export function primeDict(lang: Lang, data: Record<string, string>): void {
  cache.set(lang, data);
  merged.delete(lang);
}

/** Loads a language's dictionary once, sharing any request already in flight. */
export function loadDict(lang: Lang): Promise<Record<string, string>> {
  const hit = cache.get(lang);
  if (hit) return Promise.resolve(hit);

  const existing = inFlight.get(lang);
  if (existing) return existing;

  const loader = LOADERS[lang as Exclude<Lang, "en">];
  if (!loader) return Promise.resolve({});

  const request = loader()
    .then((m) => {
      const data = m.default;
      cache.set(lang, data);
      merged.delete(lang);
      inFlight.delete(lang);
      return data;
    })
    .catch(() => {
      // A failed chunk must not blank the site — English is a correct fallback.
      inFlight.delete(lang);
      return {};
    });

  inFlight.set(lang, request);
  return request;
}

/**
 * The rare keys whose English *display* differs from the key itself.
 *
 * Only markup lives here — `\n` line breaks and `*word*` gradient marks — for
 * strings a component splits into styled parts. Everything else in English is
 * the key verbatim, which is why English still loads no dictionary file.
 *
 * The hero headline is the reason this exists. When the dictionary was split
 * per language, English began returning the bare key, which has no markup. The
 * headline renderer dims the *last* line, and a string with no `\n` has only
 * one line — so the whole headline, the most visible thing on the site, went
 * 42% grey with no gradient on "run". This restores the design export's three
 * lines exactly: "Software" / "built to *run* on," / "not to demo well."
 */
const EN_DISPLAY: Record<string, string> = {
  "Custom software built to run on, not to demo well.": "Custom software\nbuilt to *run* on,\nnot to demo well.",
};

/**
 * Translates one key. English returns the key — it *is* the English copy — or
 * its display override when a component needs markup the key cannot carry.
 */
export function translate(key: string, lang: Lang): string {
  // A dashboard override wins over everything, in any language.
  const over = overrides.get(lang)?.[key];
  if (over?.trim()) return over;
  if (lang === "en") return EN_DISPLAY[key] ?? key;
  return cache.get(lang)?.[key]?.trim() || key;
}
