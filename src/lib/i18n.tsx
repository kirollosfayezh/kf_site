import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import dict from "./i18n-dict.json";
import { LANGS, LANG_META, dirOf, isLang, type Lang } from "./langs";

export { LANGS, LANG_META, dirOf, isLang };
export type { Lang };

type DictEntry = Record<Lang, string>;
const DICT = dict as Record<string, DictEntry>;

const STORAGE_KEY = "kf-lang";

interface I18nContextValue {
  lang: Lang;
  dir: "ltr" | "rtl";
  /** The languages the switcher should offer, driven by site settings. */
  available: Lang[];
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readStored(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

/**
 * `?lang=ar` wins over anything stored. The SEO layer publishes hreflang
 * alternates pointing at these URLs, so a crawler — or anyone following a
 * shared link — has to land in that language rather than in whatever the last
 * visitor on this browser happened to pick. Announcing an alternate that
 * renders in English is worse for ranking than announcing none.
 */
/**
 * The language is the **first path segment** — `/de/services`. That is the URL
 * shape the prerender and the hreflang set now use, so it has to be what the
 * running app reads too.
 *
 * `?lang=` is still honoured as a fallback so old shared links keep working, but
 * it is no longer what the site advertises: Google rates URL parameters "Not
 * recommended" for language targeting, and a parameter cannot select a different
 * static file, so those URLs always served English HTML to a crawler.
 */
function readPathLang(): Lang | null {
  try {
    const first = window.location.pathname.split("/").filter(Boolean)[0];
    return isLang(first) ? first : null;
  } catch {
    return null;
  }
}

function readParam(): Lang | null {
  try {
    const v = new URLSearchParams(window.location.search).get("lang");
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

/** Path first, then the legacy query parameter. */
function readUrlLang(): Lang | null {
  return readPathLang() ?? readParam();
}

export function I18nProvider({
  children,
  defaultLang = "en",
  enabled,
}: {
  children: ReactNode;
  defaultLang?: Lang;
  /** Enabled language codes from site settings; English is always offered. */
  enabled?: Lang[];
}) {
  const [lang, setLangState] = useState<Lang>(() => readUrlLang() ?? readStored() ?? defaultLang);

  /**
   * Driven by `settings.languages` so switching a language on in the dashboard
   * actually changes the site. This list used to be hardcoded in the Nav, which
   * meant the dashboard toggle did nothing at all.
   *
   * English is always present: it is the dictionary's own key language and the
   * fallback every other language degrades to, so a settings document that
   * disabled it would leave the switcher empty.
   */
  const available = useMemo<Lang[]>(() => {
    // Until settings arrive, assume every language is on. Narrowing first and
    // widening later would strip a valid `?lang=de` off the URL a moment after
    // load and bounce the visitor back to English.
    if (!enabled) return [...LANGS];
    const set = new Set<Lang>(["en"]);
    enabled.forEach((l) => {
      if (isLang(l)) set.add(l);
    });
    return LANGS.filter((l) => set.has(l));
  }, [enabled]);

  useEffect(() => {
    // Only apply the backend-provided default when the visitor has expressed no
    // preference at all — neither in the URL nor from a previous visit.
    if (readUrlLang() === null && readStored() === null) setLangState(defaultLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultLang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dirOf(lang);
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  /** Falls back to English — and then to the key itself, which *is* the English
   *  copy — so a missing translation degrades to readable text, never to blank. */
  const t = useCallback(
    (key: string) => {
      const entry = DICT[key];
      if (!entry) return key;
      return entry[lang]?.trim() || entry.en || key;
    },
    [lang],
  );

  /** A stored preference for a language that has since been turned off must not
   *  strand the visitor in a language the switcher no longer offers. */
  useEffect(() => {
    if (!available.includes(lang)) setLangState(available[0] ?? "en");
  }, [available, lang]);

  const value = useMemo<I18nContextValue>(
    () => ({ lang, dir: dirOf(lang), available, setLang, t }),
    [lang, available, setLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
