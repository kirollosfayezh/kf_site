import type { TrackingSettings } from "../services/api-types";

/**
 * Third-party marketing tags for the public site.
 *
 * Three rules shape this file.
 *
 * **Nothing loads unless an id is set.** A site with an empty Marketing screen
 * ships no third-party script and sets no third-party cookie. That is also the
 * default state, so the privacy-safe option is the one that requires no action.
 *
 * **The data layer is always published.** Every tracked event is pushed to
 * `window.dataLayer` whether or not Tag Manager is installed, so a container can
 * be added later and immediately see the site's events without a redeploy. The
 * direct pixel loaders below are the alternative to a container, not a
 * companion to one — configuring both loads the same pixel twice and
 * double-counts every conversion, which the dashboard warns about.
 *
 * **With consent mode on, nothing loads until the visitor accepts — Google
 * included.** That is what the privacy policy promises ("if you decline, none
 * of them load"). Google's tags used to load anyway in Consent Mode's denied
 * state, which is a legitimate configuration but not the one the policy
 * describes, and a policy that overstates what the site does is worse than
 * one that undersells it.
 *
 * Deliberately separate from `services/analytics.ts`: that is our own
 * first-party reporting and always runs; this is optional marketing tagging.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[] };
    _fbq?: unknown;
    ttq?: Record<string, (...args: unknown[]) => void> & { load?: (id: string) => void; page?: () => void };
    snaptr?: ((...args: unknown[]) => void) & { queue?: unknown[]; handleRequest?: (...args: unknown[]) => void };
    lintrk?: ((a: string, b?: unknown) => void) & { q?: unknown[] };
    _linkedin_partner_id?: string;
    _linkedin_data_partner_ids?: string[];
    clarity?: (...args: unknown[]) => void;
  }
}

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
type ClickEvent = Exclude<SiteEvent, "pageview">;

/** Label pattern -> semantic event. First match wins. */
const EVENT_MAP: [RegExp, ClickEvent][] = [
  [/(^|\.)(whatsapp|email|phone)$|^chat\.launcher$/, "contact"],
  [/.*/, "cta"],
];

export function classify(label: string): ClickEvent {
  for (const [pattern, event] of EVENT_MAP) if (pattern.test(label)) return event;
  return "cta";
}

/** Per-platform names for each click event. `null` means "do not send". */
const NAMES: Record<ClickEvent, { ga4: string; meta: string | null; tiktok: string | null; snap: string | null }> = {
  contact: { ga4: "contact", meta: "Contact", tiktok: "Contact", snap: null },
  cta: { ga4: "select_content", meta: null, tiktok: "ClickButton", snap: null },
};

/**
 * The things a visitor can *do* that marketing counts. Each maps to the name
 * every platform expects and to the dashboard switch that can silence it.
 * A quote accepted carries its value, so Ads and Meta can optimise on money.
 */
export type ConversionKind = "lead" | "booking" | "chat_start" | "quote_accepted" | "newsletter";

interface ConversionSpec {
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

const CONVERSIONS: Record<ConversionKind, ConversionSpec> = {
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

let config: TrackingSettings = {};
let active = false;
const loaded = { gtm: false, ga: false, ads: false, meta: false, tiktok: false, snap: false, linkedin: false, clarity: false };

/* ---------------------------------------------------------------- consent */

const CONSENT_KEY = "kf-consent";
export type Consent = "granted" | "denied";

/**
 * The visitor's stored choice, or null if they have not made one.
 *
 * Wrapped because `localStorage` throws outright in some privacy modes rather
 * than returning null — and a consent check that throws would take the whole
 * page down.
 */
export function readConsent(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

/** Lets the footer's "Cookie settings" link reopen the banner from anywhere,
 *  without threading state through the whole tree for a once-a-session action. */
export const CONSENT_REOPEN_EVENT = "kf:consent-reopen";

/** Fired on `window` after a decision is stored; `detail` is the `Consent`. */
export const CONSENT_CHANGED_EVENT = "kf:consent-changed";

export function reopenConsent(): void {
  window.dispatchEvent(new CustomEvent(CONSENT_REOPEN_EVENT));
}

function storeConsent(value: Consent): void {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* a visitor who blocks storage simply gets asked again next visit */
  }
}

/**
 * Whether a banner should be shown: only when consent is actually required
 * *and* something would otherwise set a third-party cookie.
 *
 * A site with no tags configured sets no such cookie, so asking permission for
 * one would be theatre — and trains people to dismiss the banner that does
 * matter.
 */
export function needsConsent(settings: TrackingSettings | undefined): boolean {
  if (!settings?.consentMode) return false;
  // A decision of either kind is final until the visitor reopens the banner.
  if (readConsent()) return false;
  // Nothing loads under Do Not Track, so there is nothing to ask about.
  if (settings.respectDnt !== false && dntEnabled()) return false;
  return anyTagConfigured(settings);
}

function anyTagConfigured(s: TrackingSettings): boolean {
  return [
    s.gtmId,
    s.googleAnalyticsId,
    s.googleAdsId,
    s.metaPixelId,
    s.tiktokPixelId,
    s.snapchatPixelId,
    s.linkedinPartnerId,
    s.clarityId,
  ].some((v) => clean(v).length > 0);
}

const clean = (v: string | undefined) => v?.trim() || "";

function injectScript(src: string): void {
  const s = document.createElement("script");
  s.src = src;
  s.async = true;
  document.head.appendChild(s);
}

/** The data layer exists from the first call, so nothing races the container. */
function push(payload: Record<string, unknown>): void {
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}

/* --------------------------------------------------------------- loaders */

/*
 * No loader sends a page view of its own. `pixelPageview` is the single
 * source of page views for every tag, on every route change and once for the
 * landing page — the TikTok and Snapchat snippets used to fire their own on
 * load as well, so the entry page counted twice, while Meta got none.
 * LinkedIn's Insight Tag and Clarity track on their own and have no SPA
 * page-view call, so they are loaded and left alone.
 */

function loadGtm(id: string): void {
  if (loaded.gtm) return;
  loaded.gtm = true;
  push({ "gtm.start": Date.now(), event: "gtm.js" });
  injectScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`);
}

function ensureGtag(): void {
  if (window.gtag) return;
  window.dataLayer = window.dataLayer || [];
  // Must push `arguments` itself, not an array copy — Google's tag reads the
  // arguments object and a spread breaks `config` and `consent` calls.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag("js", new Date());
}

function loadGoogleAnalytics(id: string): void {
  if (loaded.ga) return;
  loaded.ga = true;
  injectScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
  ensureGtag();
  // The SPA sends its own page_view per route change, so the automatic one
  // would double-count the landing page.
  window.gtag!("config", id, { send_page_view: false });
}

function loadGoogleAds(id: string): void {
  if (loaded.ads) return;
  loaded.ads = true;
  // Shares the gtag.js runtime with GA4; loading it twice is harmless but the
  // script only needs fetching once.
  if (!loaded.ga) injectScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
  ensureGtag();
  window.gtag!("config", id);
}

function loadMetaPixel(id: string): void {
  if (loaded.meta) return;
  loaded.meta = true;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const w = window as any;
  if (!w.fbq) {
    const n: any = (w.fbq = function (...args: unknown[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
    });
    if (!w._fbq) w._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
  injectScript("https://connect.facebook.net/en_US/fbevents.js");
  window.fbq?.("init", id);
}

function loadTikTok(id: string): void {
  if (loaded.tiktok) return;
  loaded.tiktok = true;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const w = window as any;
  w.TiktokAnalyticsObject = "ttq";
  const ttq: any = (w.ttq = w.ttq || []);
  ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
  ttq.setAndDefer = (obj: any, method: string) => {
    obj[method] = (...args: unknown[]) => obj.push([method, ...args]);
  };
  for (const m of ttq.methods) ttq.setAndDefer(ttq, m);
  ttq.load = (pixelId: string) => {
    ttq._i = ttq._i || {};
    ttq._i[pixelId] = [];
    ttq._t = ttq._t || {};
    ttq._t[pixelId] = Date.now();
    ttq._o = ttq._o || {};
    ttq._o[pixelId] = {};
    injectScript(`https://analytics.tiktok.com/i18n/pixel/events.js?sdkid=${encodeURIComponent(pixelId)}&lib=ttq`);
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
  window.ttq?.load?.(id);
}

function loadSnapchat(id: string): void {
  if (loaded.snap) return;
  loaded.snap = true;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const w = window as any;
  if (!w.snaptr) {
    const a: any = (w.snaptr = function (...args: unknown[]) {
      a.handleRequest ? a.handleRequest.apply(a, args) : a.queue.push(args);
    });
    a.queue = [];
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
  injectScript("https://sc-static.net/scevent.min.js");
  window.snaptr?.("init", id);
}

function loadLinkedIn(partnerId: string): void {
  if (loaded.linkedin) return;
  loaded.linkedin = true;
  window._linkedin_partner_id = partnerId;
  window._linkedin_data_partner_ids = window._linkedin_data_partner_ids || [];
  window._linkedin_data_partner_ids.push(partnerId);
  if (!window.lintrk) {
    const stub = ((a: string, b?: unknown) => {
      (stub.q ||= []).push([a, b]);
    }) as Window["lintrk"] & { q?: unknown[] };
    window.lintrk = stub;
  }
  injectScript("https://snap.licdn.com/li.lms-analytics/insight.min.js");
}

function loadClarity(id: string): void {
  if (loaded.clarity) return;
  loaded.clarity = true;
  if (!window.clarity) {
    const stub = function (...args: unknown[]) {
      (stub.q ||= []).push(args);
    } as ((...args: unknown[]) => void) & { q?: unknown[] };
    window.clarity = stub;
  }
  injectScript(`https://www.clarity.ms/tag/${encodeURIComponent(id)}`);
  // Clarity records session replays, so it only ever loads once the visitor
  // has accepted (or consent is not required); tell it so it sets its cookie.
  window.clarity("consent");
}

/* ------------------------------------------------------------------ init */

/** Whether the visitor has asked not to be tracked. */
function dntEnabled(): boolean {
  const nav = navigator as Navigator & { msDoNotTrack?: string };
  const w = window as Window & { doNotTrack?: string };
  const flag = nav.doNotTrack ?? w.doNotTrack ?? nav.msDoNotTrack;
  return flag === "1" || flag === "yes";
}

/** Whether a Google tag is present to receive `gtag("event", …)` calls. */
const googleLoaded = () => loaded.gtm || loaded.ga || loaded.ads;
const anyLoaded = () => Object.values(loaded).some(Boolean);

/**
 * Loads every configured tag. Idempotent — each loader checks its own flag.
 *
 * A container is expected to own the individual tags. Loading them here as
 * well is the documented double-count, so direct ids are honoured only when
 * there is no container.
 */
function loadAll(): void {
  const gtm = clean(config.gtmId);
  if (gtm) {
    loadGtm(gtm);
    return;
  }
  const ga = clean(config.googleAnalyticsId);
  const ads = clean(config.googleAdsId);
  const meta = clean(config.metaPixelId);
  const tiktok = clean(config.tiktokPixelId);
  const snap = clean(config.snapchatPixelId);
  const linkedin = clean(config.linkedinPartnerId);
  const clarity = clean(config.clarityId);
  if (ga) loadGoogleAnalytics(ga);
  if (ads) loadGoogleAds(ads);
  if (meta) loadMetaPixel(meta);
  if (tiktok) loadTikTok(tiktok);
  if (snap) loadSnapchat(snap);
  if (linkedin) loadLinkedIn(linkedin);
  if (clarity) loadClarity(clarity);
}

const DENIED = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
};

const GRANTED = {
  ad_storage: "granted",
  ad_user_data: "granted",
  ad_personalization: "granted",
  analytics_storage: "granted",
};

/**
 * The consent state machine, in full:
 *
 * - Do Not Track on → nothing loads, nothing is pushed.
 * - Consent mode off → every configured tag loads at once.
 * - Consent mode on → Google's consent defaults are declared (denied), then:
 *   a stored "granted" from an earlier visit is replayed and everything loads;
 *   otherwise **nothing** loads until the banner's Accept.
 *
 * The replay is what was missing before: a returning visitor who had accepted
 * got the tags loaded, but never the `consent update` — so Google treated
 * every later visit as denied and dropped the ad cookies it was allowed to set.
 */
export function initPixels(settings: TrackingSettings | undefined): void {
  if (!settings) return;
  config = settings;

  if (settings.respectDnt !== false && dntEnabled()) {
    if (settings.debug) console.info("[pixels] Do Not Track is on — no marketing tags loaded.");
    return;
  }

  active = true;

  if (!settings.consentMode) {
    loadAll();
    if (settings.debug) console.info("[pixels] loaded", { ...loaded, container: clean(settings.gtmId) || "none" });
    return;
  }

  // Consent Mode v2 must be declared before any Google tag loads, otherwise
  // the first hits go out under the wrong defaults.
  ensureGtag();
  window.gtag!("consent", "default", { ...DENIED, wait_for_update: 500 });

  if (readConsent() === "granted") {
    window.gtag!("consent", "update", GRANTED);
    loadAll();
    if (settings.debug) console.info("[pixels] consent previously granted — loaded", { ...loaded });
    return;
  }
  if (settings.debug) console.info("[pixels] holding every tag until consent");
}

/**
 * Records the visitor's decision and acts on it immediately — no reload.
 *
 * On acceptance Google's consent signals are updated, every tag loads, and the
 * page the visitor is on is reported once to the tags that just arrived (the
 * route effect ran while they were held, so they never saw it). On refusal
 * nothing further loads; tags loaded earlier in this session stay, and the
 * next page load holds them.
 */
export function setConsent(value: Consent): void {
  storeConsent(value);
  if (config.debug) console.info("[pixels] consent", value);
  // Anything waiting on the decision (the offer popup holds back while the
  // bar is up) hears about it without a reload.
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: value }));

  if (value === "granted") {
    window.gtag?.("consent", "update", GRANTED);
    const first = !anyLoaded();
    loadAll();
    if (first) pixelPageview(window.location.pathname || "/");
    return;
  }

  window.gtag?.("consent", "update", DENIED);
}

/* ---------------------------------------------------------------- events */

const enabled = (key: string) => config.events?.[key] !== false;

/**
 * Mirrors a route change into the data layer and whichever tags are active.
 *
 * `gtag("event", …)` is only called once a Google tag has loaded: before that
 * the call would sit in `dataLayer` and be replayed the moment gtag.js
 * arrived — after Accept, that meant every held page view fired at once.
 */
export function pixelPageview(path: string): void {
  if (!active || !enabled("pageview")) return;
  push({ event: "kf_pageview", page_path: path });
  if (config.debug) console.info("[pixels] pageview", path);

  if (googleLoaded()) window.gtag?.("event", "page_view", { page_path: path });
  window.fbq?.("track", "PageView");
  window.ttq?.page?.();
  window.snaptr?.("track", "PAGE_VIEW");
}

/**
 * Mirrors a tracked click. The raw label is always published to the data layer;
 * the platforms receive their own name for the semantic event behind it.
 */
export function pixelEvent(label: string): void {
  if (!active) return;
  const event = classify(label);
  if (!enabled(event)) return;

  push({ event: `kf_${event}`, kf_label: label, page_path: window.location.pathname });
  if (config.debug) console.info("[pixels]", event, label);

  const names = NAMES[event];
  if (googleLoaded()) window.gtag?.("event", names.ga4, { content_type: "cta", item_id: label });
  if (names.meta) window.fbq?.("track", names.meta);
  if (names.tiktok) window.ttq?.track?.(names.tiktok, { content_name: label });
  if (names.snap) window.snaptr?.("track", names.snap);
}

/**
 * Reports something that actually happened — the server accepted the form,
 * the booking was made, the quote was signed. Called from success branches
 * only, never from a button.
 */
export function pixelConversion(kind: ConversionKind, details: ConversionDetails = {}): void {
  if (!active) return;
  const spec = CONVERSIONS[kind];
  if (!enabled(spec.switch)) return;

  const { value, currency, id } = details;
  push({
    event: "kf_conversion",
    kf_kind: kind,
    page_path: window.location.pathname,
    ...(value !== undefined ? { value } : {}),
    ...(currency ? { currency } : {}),
    ...(id ? { transaction_id: id } : {}),
  });
  if (config.debug) console.info("[pixels] conversion", kind, details);

  const money = value !== undefined ? { value, currency } : {};
  if (googleLoaded()) {
    window.gtag?.("event", spec.ga4, { ...money, ...(id ? { transaction_id: id } : {}), method: kind });
  }
  if (spec.meta) window.fbq?.("track", spec.meta, money);
  if (spec.tiktok) window.ttq?.track?.(spec.tiktok, { content_name: kind, ...money });
  if (spec.snap) window.snaptr?.("track", spec.snap, { ...(value !== undefined ? { price: value } : {}), currency, transaction_id: id });

  // Google Ads reports a conversion only when both halves are configured; the
  // dashboard flags an id without a label for exactly this reason.
  if (spec.ads && googleLoaded()) {
    const adsId = clean(config.googleAdsId);
    const adsLabel = clean(config.googleAdsLabel);
    if (adsId && adsLabel) {
      window.gtag?.("event", "conversion", { send_to: `${adsId}/${adsLabel}`, ...money, ...(id ? { transaction_id: id } : {}) });
    }
  }
  // LinkedIn needs the conversion's own id from Campaign Manager.
  const linkedinConversion = clean(config.linkedinConversionId);
  if (spec.linkedin && loaded.linkedin && linkedinConversion) {
    window.lintrk?.("track", { conversion_id: Number(linkedinConversion) });
  }
}
