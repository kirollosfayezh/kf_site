/**
 * Copy and small helpers for working with Saudi and UAE clients, shared by the
 * homepage band, the Contact form and the Book page. English keys: every
 * render site passes them through t().
 *
 * Facts only from the sourced GCC fact sheet (6 Nov 2026): Saudi Arabia's
 * weekend is Friday–Saturday; Riyadh is UTC+3 and Dubai UTC+4 all year, while
 * Cairo is UTC+3 from the last Friday of April to the last Thursday of
 * October and UTC+2 the rest of the year; SAR and AED are pegged to the dollar.
 */

/** The homepage band's three facts. No claim about clients, offices or integrations. */
export const GULF_FACTS = [
  { n: "01", title: "Sunday to Thursday", desc: "The same working week as Saudi Arabia." },
  { n: "02", title: "On Riyadh time", desc: "From late April to late October, and one hour behind in winter." },
  { n: "03", title: "Arabic-first", desc: "Apps, websites and business systems designed right-to-left from the start." },
] as const;

/**
 * The official dollar pegs: SAMA's 3.75 riyals and the Central Bank's 3.6725
 * dirhams. Used for display only — a quote and a lead stay in US dollars.
 */
export const PEGS = {
  SA: { code: "SAR", rate: 3.75 },
  AE: { code: "AED", rate: 3.6725 },
} as const;

type PegCountry = keyof typeof PEGS;

const isPegCountry = (country: string | undefined): country is PegCountry => country === "SA" || country === "AE";

/**
 * The Contact form's budget bands. `value` is what the lead stores — the
 * English label, under the i18n contract — and `usd` the band's bounds, which
 * only the label's local-currency hint reads.
 */
export const BUDGET_BANDS: readonly { value: string; usd?: readonly [number | null, number | null] }[] = [
  { value: "Under $2k", usd: [null, 2000] },
  { value: "$2k – $5k", usd: [2000, 5000] },
  { value: "$5k – $15k", usd: [5000, 15000] },
  { value: "$15k+", usd: [15000, null] },
  { value: "Not sure yet" },
];

/**
 * Thousands of a local amount, rounded for a label: one decimal under 10k
 * ("7.5"), whole thousands above ("19"). German and French write the decimal
 * with a comma. The digits stay Latin in Arabic, as the dollar labels do.
 */
export function thousands(amount: number, lang: string): string {
  const k = amount / 1000;
  const rounded = k < 10 ? Math.round(k * 10) / 10 : Math.round(k);
  const text = String(rounded);
  return lang === "de" || lang === "fr" ? text.replace(".", ",") : text;
}

/**
 * "≈ SAR 7.5k – 19k" for a visitor in Saudi Arabia or the UAE, or null for
 * everyone else and for a band without bounds. The caller works out the
 * country after mount, so the prerendered page shows dollars only.
 */
export function budgetEquivalent(
  value: string,
  country: string | undefined,
  lang: string,
  t: (key: string) => string,
): string | null {
  const band = BUDGET_BANDS.find((b) => b.value === value);
  if (!band?.usd || !isPegCountry(country)) return null;
  const { code, rate } = PEGS[country];
  const cur = t(code);
  const [lo, hi] = band.usd.map((usd) => (usd == null ? null : thousands(usd * rate, lang)));
  if (lo && hi) return t("≈ {cur} {a}k – {b}k").replace("{cur}", cur).replace("{a}", lo).replace("{b}", hi);
  if (lo) return t("≈ {cur} {n}k+").replace("{cur}", cur).replace("{n}", lo);
  if (hi) return t("≈ {cur} {n}k").replace("{cur}", cur).replace("{n}", hi);
  return null;
}

/** A budget option's label: the translated dollar band, plus the local equivalent where one applies. */
export function budgetLabel(value: string, country: string | undefined, lang: string, t: (key: string) => string): string {
  const local = budgetEquivalent(value, country, lang, t);
  return local ? `${t(value)} (${local})` : t(value);
}

/**
 * Friendly names for the Gulf and Cairo time zones, so the Book page says
 * "Riyadh time" rather than "Asia/Riyadh". Every other zone keeps its IANA name.
 */
const ZONE_NAMES: Record<string, string> = {
  "Asia/Riyadh": "Riyadh time",
  "Asia/Dubai": "UAE time",
  "Asia/Kuwait": "Kuwait time",
  "Asia/Qatar": "Qatar time",
  "Asia/Bahrain": "Bahrain time",
  "Asia/Muscat": "Oman time",
  "Africa/Cairo": "Cairo time",
};

/** The dictionary key for a zone's friendly name, or undefined when it has none. */
export function zoneName(tz: string): string | undefined {
  return ZONE_NAMES[tz];
}
