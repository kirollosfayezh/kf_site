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

const LOADERS: Record<Exclude<Lang, "en">, () => Promise<{ default: Record<string, string> }>> = {
  ar: () => import("./ar.json"),
  de: () => import("./de.json"),
  fr: () => import("./fr.json"),
};

const cache = new Map<Lang, Record<string, string>>([["en", {}]]);
const inFlight = new Map<Lang, Promise<Record<string, string>>>();

/** What is already loaded for this language. Synchronous, for render. */
export function dictFor(lang: Lang): Record<string, string> {
  return cache.get(lang) ?? {};
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
 * Translates one key. `en` short-circuits: the key is the English copy, so
 * there is nothing to look up and nothing to load.
 */
export function translate(key: string, lang: Lang): string {
  if (lang === "en") return key;
  return cache.get(lang)?.[key]?.trim() || key;
}
