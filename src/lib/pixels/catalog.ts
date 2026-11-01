/** The event vocabulary: click labels → semantic events, and each platform's name for them. */

/**
 * The site's own click vocabulary, mapped from the `data-track` labels on the
 * buttons. Two semantic events rather than one per button: a marketing
 * platform cares whether someone reached out, not which of two CTAs they
 * clicked, and the raw label travels alongside for anyone who does care.
 *
 * A click is never a conversion. Conversions (`pixelConversion`) are reported
 * by the code that knows the request succeeded — the form's success branch —
 * not by the button. The old `*.submit → lead` rule fired the moment the
 * button was pressed, so an empty form, a validation error and a server
 * failure each counted as a lead in every ad platform.
 */
export type SiteEvent = "contact" | "cta" | "pageview";

/** A click can never be a pageview, so the classifier's range excludes it. */
export type ClickEvent = Exclude<SiteEvent, "pageview">;

/** Label pattern -> semantic event. First match wins. */
export const EVENT_MAP: [RegExp, ClickEvent][] = [
  [/(^|\.)(whatsapp|email|phone)$|^chat\.launcher$/, "contact"],
  [/.*/, "cta"],
];

export function classify(label: string): ClickEvent {
  for (const [pattern, event] of EVENT_MAP) if (pattern.test(label)) return event;
  return "cta";
}

/** Per-platform names for each click event. `null` means "do not send". */
export const NAMES: Record<ClickEvent, { ga4: string; meta: string | null; tiktok: string | null; snap: string | null }> = {
  contact: { ga4: "contact", meta: "Contact", tiktok: "Contact", snap: null },
  cta: { ga4: "select_content", meta: null, tiktok: "ClickButton", snap: null },
};

/**
 * The things a visitor can *do* that marketing counts. Each maps to the name
 * every platform expects and to the dashboard switch that can silence it.
 * A quote accepted carries its value, so Ads and Meta can optimise on money.
 */
export type ConversionKind = "lead" | "booking" | "chat_start" | "quote_accepted" | "newsletter";

export interface ConversionSpec {
  /** The `pixels.events` key that switches this conversion off. */
  switch: string;
  ga4: string;
  meta: string | null;
  tiktok: string | null;
  snap: string | null;
  /** Report to Google Ads (needs id + label) and LinkedIn (needs a conversion id). */
  ads: boolean;
  linkedin: boolean;
}

export const CONVERSIONS: Record<ConversionKind, ConversionSpec> = {
  lead: { switch: "lead", ga4: "generate_lead", meta: "Lead", tiktok: "SubmitForm", snap: "SIGN_UP", ads: true, linkedin: true },
  booking: { switch: "booking", ga4: "book_call", meta: "Schedule", tiktok: "SubmitForm", snap: "SIGN_UP", ads: true, linkedin: true },
  chat_start: { switch: "chat", ga4: "chat_start", meta: "Contact", tiktok: "Contact", snap: null, ads: false, linkedin: false },
  quote_accepted: { switch: "quote", ga4: "purchase", meta: "Purchase", tiktok: "CompletePayment", snap: "PURCHASE", ads: true, linkedin: true },
  newsletter: { switch: "newsletter", ga4: "sign_up", meta: "Subscribe", tiktok: "Subscribe", snap: "SUBSCRIBE", ads: false, linkedin: false },
};

export interface ConversionDetails {
  value?: number;
  currency?: string;
  /** A booking or quote number, so a platform can dedupe a retried report. */
  id?: string;
}
