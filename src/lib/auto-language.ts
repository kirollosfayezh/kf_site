import { LANGS, isLang, type Lang } from "./langs";

/**
 * Sends a first-time visitor to the language they most likely read.
 *
 * Runs once, before React mounts, so there is no flash of the wrong language.
 *
 * **It never overrides an explicit choice.** A URL that already carries a
 * language prefix, and a visitor who has used the switcher before, are both
 * left alone — so a link someone shares always opens in the language it was
 * shared in, and the switcher is never fought by the detector.
 *
 * **It never runs for a crawler.** Googlebot is served the prerendered English
 * HTML at `/` and this file is client-side only, so the indexed page and its
 * canonical stay in agreement. Auto-redirecting a crawler by IP is the
 * documented way to get a multilingual site mis-indexed — Google crawls mostly
 * from the United States, so it would only ever see one language.
 *
 * Two signals, no network request and no IP lookup:
 *
 * 1. `navigator.languages` — what the visitor set on their own device. The
 *    strongest signal there is, because they chose it.
 * 2. The IANA time zone (`Africa/Cairo`, `Asia/Riyadh`) — a good country proxy
 *    that costs nothing, needs no geo-IP service, and sends no data anywhere.
 *    Used only when the browser language says nothing useful.
 */

const STORAGE_KEY = "kf-lang";
const AUTO_KEY = "kf-lang-auto";

/** Time zones whose country reads Arabic, and the European pair we serve. */
const ZONE_LANG: Record<string, Lang> = {
  // Arabic-speaking countries
  "Africa/Cairo": "ar",
  "Asia/Riyadh": "ar",
  "Asia/Dubai": "ar",
  "Asia/Qatar": "ar",
  "Asia/Kuwait": "ar",
  "Asia/Bahrain": "ar",
  "Asia/Muscat": "ar",
  "Asia/Amman": "ar",
  "Asia/Beirut": "ar",
  "Asia/Damascus": "ar",
  "Asia/Baghdad": "ar",
  "Asia/Aden": "ar",
  "Asia/Gaza": "ar",
  "Asia/Hebron": "ar",
  "Africa/Khartoum": "ar",
  "Africa/Tripoli": "ar",
  "Africa/Tunis": "ar",
  "Africa/Algiers": "ar",
  "Africa/Casablanca": "ar",
  "Africa/El_Aaiun": "ar",
  "Africa/Nouakchott": "ar",
  "Africa/Mogadishu": "ar",
  "Africa/Djibouti": "ar",
  // German
  "Europe/Berlin": "de",
  "Europe/Vienna": "de",
  "Europe/Zurich": "de",
  // French
  "Europe/Paris": "fr",
  "Europe/Brussels": "fr",
  "Europe/Monaco": "fr",
  "Europe/Luxembourg": "fr",
  "Africa/Abidjan": "fr",
  "Africa/Dakar": "fr",
};

function fromBrowser(): Lang | null {
  const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const tag of tags) {
    const base = (tag || "").toLowerCase().split("-")[0];
    if (isLang(base) && LANGS.includes(base)) return base;
  }
  return null;
}

function fromTimeZone(): Lang | null {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return ZONE_LANG[zone] ?? null;
  } catch {
    return null;
  }
}

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
  const param = params.get("lang");
  if (!isLang(param)) return false;
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
 * Redirects if, and only if, this is a first visit to an unprefixed URL and the
 * visitor reads a language we serve other than English. Returns nothing; it
 * either navigates or leaves the page alone.
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

  // A visitor who has ever used the switcher, or been redirected once already.
  if (stored(STORAGE_KEY) || stored(AUTO_KEY)) return;

  /*
   * A non-English browser language wins outright: someone whose device is set
   * to German is telling us what they read, wherever they happen to be.
   *
   * Otherwise the time zone decides — which is what makes someone in Cairo with
   * an English phone land on Arabic. Plenty of people in the region run their
   * device in English and still prefer to read Arabic, so location is the
   * better signal once the browser has said nothing but "English".
   */
  const browser = fromBrowser();
  const detected = browser && browser !== "en" ? browser : (fromTimeZone() ?? browser);
  if (!detected || detected === "en") {
    // Still mark it, so an English reader is not re-checked on every page.
    try {
      localStorage.setItem(AUTO_KEY, "en");
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    localStorage.setItem(AUTO_KEY, detected);
  } catch {
    /* a visitor who blocks storage is simply detected again next visit */
  }

  // `replace`, not `assign`: the English URL should not sit in the back stack,
  // or Back from the Arabic page bounces straight into the redirect again.
  stashEntry();
  window.location.replace(`/${detected}${path === "/" ? "" : path}${window.location.search}${window.location.hash}`);
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
