import { isLang, type Lang } from "./langs.ts";

/**
 * Keeps a visitor in the language they chose.
 *
 * Runs once, before React mounts, so there is no flash of the wrong language.
 *
 * **English is the default for everyone.** The site used to guess a first-time
 * visitor's language from the browser and the time zone and redirect Cairo to
 * `/ar`; the owner asked for English first (2026-11-04), so the only things
 * that pick another language now are a prefixed URL and the switcher.
 *
 * **It never overrides an explicit choice.** A URL that already carries a
 * language prefix is left alone — a link someone shares always opens in the
 * language it was shared in.
 */

const STORAGE_KEY = "kf-lang";

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * `/services?lang=ar` → `/ar/services`; `/ar/services?lang=ar` just loses the
 * parameter. Returns true when it navigated, so the caller stops.
 */
function redirectLegacyParam(path: string, first: string | undefined): boolean {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("lang");
  const param: Lang | null = isLang(raw) ? raw : null;
  if (!param) return false;
  params.delete("lang");
  const search = params.toString() ? `?${params.toString()}` : "";
  const prefixed = first && isLang(first);
  const unprefixed = prefixed ? path.slice(first.length + 1) || "/" : path;
  const target = param === "en" ? unprefixed : `/${param}${unprefixed === "/" ? "" : unprefixed}`;
  try {
    localStorage.setItem(STORAGE_KEY, param);
  } catch {
    /* ignore */
  }
  if (target === path) {
    // Same page: only tidy the address bar, no navigation.
    window.history.replaceState(null, "", `${path}${search}${window.location.hash}`);
    return false;
  }
  stashEntry();
  window.location.replace(`${target}${search}${window.location.hash}`);
  return true;
}

/**
 * Redirects an unprefixed URL to the language the visitor picked with the
 * switcher (or a legacy `?lang=` link). Returns nothing; it either navigates
 * or leaves the page alone.
 */
export function applyAutoLanguage(): void {
  if (typeof window === "undefined") return;

  const path = window.location.pathname;
  const first = path.split("/").filter(Boolean)[0];

  // The legacy `?lang=` form, still found in old shared links. It becomes the
  // path-prefix URL — the only form the site advertises — and the parameter is
  // dropped. Vercel also redirects these, but its `has` matching does not run
  // under `vercel dev`, and a client-side fallback costs nothing.
  if (redirectLegacyParam(path, first)) return;

  // An explicit language in the URL always wins — shared links, and every
  // crawler hitting a prefixed page.
  if (first && isLang(first)) return;

  // A visitor who chose a language with the switcher lands on its own URL.
  // The page under an unprefixed URL is English — prerendered, canonical and
  // all — so switching it in place would show Arabic under an English
  // canonical; navigating to `/ar/...` keeps the served page honest.
  const chosen = stored(STORAGE_KEY);
  if (chosen) {
    if (isLang(chosen) && chosen !== "en") {
      stashEntry();
      window.location.replace(`/${chosen}${path === "/" ? "" : path}${window.location.search}${window.location.hash}`);
    }
    return;
  }
}

/**
 * Where the visitor came from, kept across the redirect.
 *
 * After `location.replace` the new page's `document.referrer` is this site,
 * which analytics rightly ignores as internal — so every first-time Arabic
 * visitor arrived from "direct", whatever ad or search result actually sent
 * them. The real referrer and landing URL are parked in session storage for
 * the session event on the other side to pick up.
 */
export const ENTRY_KEY = "kf-entry";

function stashEntry(): void {
  try {
    sessionStorage.setItem(ENTRY_KEY, JSON.stringify({ referrer: document.referrer, url: window.location.href }));
  } catch {
    /* no storage: the referrer is lost, as before */
  }
}
