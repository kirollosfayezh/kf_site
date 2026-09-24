import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js/max";
import { getCountryForTimezone } from "countries-and-timezones";

/**
 * Phone handling for the chat widget.
 *
 * Checked against Google's full numbering metadata (`/max`), so a number passes
 * only if its country really issues numbers of that shape. The backend runs the
 * same rules (kf_backend `shared/phone.ts`) and is the final word; this copy is
 * what lets the field format, detect the country and say "looks good" while the
 * visitor is still typing.
 *
 * Only the chat widget imports this, and the widget is its own lazy chunk, so
 * the metadata never weighs on first paint.
 */

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN = "۰۱۲۳۴۵۶۷۸۹";

/** Western digits, `+` for a leading `00`/`+`, and nothing else. */
export function cleanPhoneInput(raw: string): string {
  let s = raw
    .replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(PERSIAN.indexOf(d)))
    .replace(/[０-９]/g, (d) => String(d.charCodeAt(0) - 0xff10))
    .replace(/＋/g, "+")
    .trim();
  const plus = s.startsWith("+");
  s = s.replace(/\D/g, "");
  if (plus) return `+${s}`;
  if (s.startsWith("00")) return `+${s.slice(2)}`;
  return s;
}

const ALL = new Set<string>(getCountries());

export function isCountry(value: unknown): value is CountryCode {
  return typeof value === "string" && ALL.has(value);
}

const LANG_COUNTRY: Record<string, CountryCode> = { ar: "EG", de: "DE", fr: "FR", en: "EG" };
const COUNTRY_KEY = "kf-chat-country";

/**
 * The visitor's most likely country, for numbers typed without a country code.
 *
 * In order: the country they picked last time; their device's time zone, which
 * says where they physically are (a German browser in Cairo is in Egypt); the
 * region in their browser languages ("ar-SA"); the site language; Egypt, where
 * most of the site's visitors are.
 */
export function guessCountry(siteLang?: string): CountryCode {
  try {
    const stored = localStorage.getItem(COUNTRY_KEY);
    if (isCountry(stored)) return stored;
  } catch {
    /* private mode */
  }
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const id = tz ? getCountryForTimezone(tz)?.id : undefined;
    if (isCountry(id)) return id;
  } catch {
    /* no Intl time zone support */
  }
  try {
    for (const tag of navigator.languages ?? [navigator.language]) {
      const region = new Intl.Locale(tag).maximize().region;
      if (isCountry(region)) return region;
    }
  } catch {
    /* no Intl.Locale */
  }
  return (siteLang && LANG_COUNTRY[siteLang]) || "EG";
}

export function rememberCountry(country: CountryCode): void {
  try {
    localStorage.setItem(COUNTRY_KEY, country);
  } catch {
    /* private mode */
  }
}

export interface PhoneState {
  /** The input as it should be displayed: formatted as the visitor types. */
  display: string;
  /** The country the number belongs to, once it can be told. */
  country?: CountryCode;
  valid: boolean;
  e164?: string;
  /** MOBILE, FIXED_LINE, … when valid. */
  type?: string;
  /** Enough digits typed that "invalid" is a fair thing to say. */
  complete: boolean;
}

/**
 * Reads what the visitor typed so far.
 *
 * A number typed without "+" has two readings: national in `country`, or an
 * international number missing its "+" ("201012345678"). When both are valid
 * the mobile wins — people chat from mobiles — and a tie keeps the national
 * reading. Same rule as the backend, so the field never says "looks good" to a
 * number the server then files under a different country.
 */
export function readPhone(raw: string, country: CountryCode): PhoneState {
  const input = cleanPhoneInput(raw);
  const digits = input.replace(/\D/g, "");

  const typer = new AsYouType(input.startsWith("+") ? undefined : country);
  const display = input ? typer.input(input) : "";

  const attempts = input.startsWith("+") ? [input] : [input, `+${input}`];
  let best: { parsed: NonNullable<ReturnType<typeof parsePhoneNumberFromString>>; score: number } | null = null;
  if (digits.length >= 6) {
    for (const candidate of attempts) {
      const parsed = parsePhoneNumberFromString(candidate, country);
      if (!parsed?.isValid()) continue;
      const type = parsed.getType();
      const score = type === "MOBILE" || type === "FIXED_LINE_OR_MOBILE" ? 2 : 1;
      if (!best || score > best.score) best = { parsed, score };
    }
  }

  if (best) {
    const p = best.parsed;
    // Re-format in the detected country's own style, so "201012345678" typed
    // from Germany shows as "+20 10 12345678" rather than as a German number.
    const shown = input.startsWith("+") || p.country !== country ? p.formatInternational() : display;
    return { display: shown, country: p.country, valid: true, e164: p.number, type: p.getType(), complete: true };
  }

  const detected = typer.getCountry();
  return {
    display,
    country: isCountry(detected) ? detected : input.startsWith("+") ? undefined : country,
    valid: false,
    complete: digits.length >= 8,
  };
}

/** 🇪🇬 from "EG". Regional-indicator pairs; shows as letters where emoji flags are unsupported. */
export function flagOf(country: string): string {
  return country
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65));
}

export interface CountryOption {
  code: CountryCode;
  name: string;
  dial: string;
}

/** Every country libphonenumber knows, named in the site's language and sorted by that name. */
export function countryOptions(lang: string): CountryOption[] {
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([lang, "en"], { type: "region" });
  } catch {
    names = null;
  }
  return getCountries()
    .map((code) => ({ code, name: names?.of(code) ?? code, dial: `+${getCountryCallingCode(code)}` }))
    .sort((a, b) => a.name.localeCompare(b.name, lang));
}

export function dialCode(country: CountryCode): string {
  return `+${getCountryCallingCode(country)}`;
}

/**
 * Re-points a number at another country when the visitor picks one from the
 * list: "+20 10 1234 5678" becomes "+966 " + the same national digits. A
 * number typed without a country code is left alone — the new country simply
 * changes how it is read.
 */
export function switchCountry(raw: string, to: CountryCode): string {
  const input = cleanPhoneInput(raw);
  if (!input.startsWith("+")) return raw;
  const parsed = parsePhoneNumberFromString(input);
  const national = parsed?.nationalNumber ?? "";
  return `${dialCode(to)} ${national}`.trimEnd() + (national ? "" : " ");
}
