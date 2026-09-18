import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import dict from "./i18n-dict.json";

export type Lang = "en" | "ar";

type DictEntry = { en: string; ar: string };
const DICT = dict as Record<string, DictEntry>;

const STORAGE_KEY = "kf-lang";

interface I18nContextValue {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readStored(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "en" || v === "ar" ? v : null;
  } catch {
    return null;
  }
}

export function I18nProvider({ children, defaultLang = "en" }: { children: ReactNode; defaultLang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(() => readStored() ?? defaultLang);

  useEffect(() => {
    // Only apply the backend-provided default the first time nothing is stored yet.
    if (readStored() === null) setLangState(defaultLang);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultLang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback(
    (key: string) => {
      const entry = DICT[key];
      if (!entry) return key;
      return lang === "ar" ? entry.ar : entry.en;
    },
    [lang],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ lang, dir: lang === "ar" ? "rtl" : "ltr", setLang, t }),
    [lang, setLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
