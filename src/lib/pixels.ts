import type { TrackingSettings } from "../services/api-types";

/**
 * Third-party marketing tags for the public site.
 *
 * Two rules shape this file.
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
  }
}

/**
 * The site's own event vocabulary, mapped from the `data-track` labels already
 * on the buttons. Three semantic events rather than one per button: a marketing
 * platform cares whether someone became a lead, not which of two CTAs they
 * clicked, and the raw label travels alongside for anyone who does care.
 */
export type SiteEvent = "lead" | "contact" | "cta" | "pageview";

/** A click can never be a pageview, so the classifier's range excludes it. */
type ClickEvent = Exclude<SiteEvent, "pageview">;

/** Label prefix or exact label -> semantic event. First match wins. */
const EVENT_MAP: [RegExp, ClickEvent][] = [
  [/\.submit$/, "lead"],
  [/^(footer\.whatsapp|chat\.launcher|nav\.phone|footer\.email)$/, "contact"],
  [/.*/, "cta"],
];

export function classify(label: string): ClickEvent {
  for (const [pattern, event] of EVENT_MAP) if (pattern.test(label)) return event;
  return "cta";
}

/** Per-platform names for each semantic event. `null` means "do not send". */
const NAMES: Record<ClickEvent, {
  ga4: string;
  meta: string | null;
  tiktok: string | null;
  snap: string | null;
}> = {
  lead: { ga4: "generate_lead", meta: "Lead", tiktok: "SubmitForm", snap: "SIGN_UP" },
  contact: { ga4: "contact", meta: "Contact", tiktok: "Contact", snap: null },
  cta: { ga4: "select_content", meta: null, tiktok: "ClickButton", snap: null },
};

let config: TrackingSettings = {};
let active = false;
const loaded = { gtm: false, ga: false, ads: false, meta: false, tiktok: false, snap: false };

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
  return [s.gtmId, s.googleAnalyticsId, s.googleAdsId, s.metaPixelId, s.tiktokPixelId, s.snapchatPixelId]
    .some((v) => clean(v).length > 0);
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
  window.ttq?.page?.();
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
  window.snaptr?.("track", "PAGE_VIEW");
}

/* ------------------------------------------------------------------ init */

/** Whether the visitor has asked not to be tracked. */
function dntEnabled(): boolean {
  const nav = navigator as Navigator & { msDoNotTrack?: string };
  const w = window as Window & { doNotTrack?: string };
  const flag = nav.doNotTrack ?? w.doNotTrack ?? nav.msDoNotTrack;
  return flag === "1" || flag === "yes";
}

export function initPixels(settings: TrackingSettings | undefined): void {
  if (!settings) return;
  config = settings;

  if (settings.respectDnt !== false && dntEnabled()) {
    if (settings.debug) console.info("[pixels] Do Not Track is on — no marketing tags loaded.");
    return;
  }

  // Consent Mode v2 must be set before any Google tag loads, otherwise the
  // first hits go out under the wrong defaults.
  if (settings.consentMode) {
    ensureGtag();
    window.gtag!("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
      wait_for_update: 500,
    });
  }

  active = true;

  const gtm = clean(settings.gtmId);
  if (gtm) loadGtm(gtm);

  // A container is expected to own the individual tags. Loading them here as
  // well is the documented double-count, so direct ids are honoured only when
  // there is no container.
  if (!gtm) {
    const ga = clean(settings.googleAnalyticsId);
    const ads = clean(settings.googleAdsId);
    if (ga) loadGoogleAnalytics(ga);
    if (ads) loadGoogleAds(ads);
  }

  /*
   * Google's tags load either way and honour the denied defaults set above —
   * that is the whole point of Consent Mode, and it lets them model the traffic
   * they cannot measure. Meta, TikTok and Snapchat have no equivalent: they set
   * a cookie the moment they load. So when consent is required and not yet
   * given, those three are held back entirely until the visitor accepts.
   */
  if (settings.consentMode && readConsent() !== "granted") {
    if (settings.debug) console.info("[pixels] holding non-Google tags until consent");
  } else {
    loadConsentedTags();
  }

  if (settings.debug) console.info("[pixels] loaded", { ...loaded, container: gtm || "none" });
}

/** The tags that may only run once consent exists (or is not required). */
function loadConsentedTags(): void {
  if (clean(config.gtmId)) return; // the container owns them
  const meta = clean(config.metaPixelId);
  const tiktok = clean(config.tiktokPixelId);
  const snap = clean(config.snapchatPixelId);
  if (meta) loadMetaPixel(meta);
  if (tiktok) loadTikTok(tiktok);
  if (snap) loadSnapchat(snap);
}

/**
 * Records the visitor's decision and acts on it immediately — no reload.
 *
 * On acceptance Google's consent signals are updated and the tags held back in
 * `initPixels` are loaded. On refusal nothing further loads and the Google tags
 * stay denied, which is already their state.
 */
export function setConsent(value: Consent): void {
  storeConsent(value);
  if (config.debug) console.info("[pixels] consent", value);

  if (value === "granted") {
    window.gtag?.("consent", "update", {
      ad_storage: "granted",
      ad_user_data: "granted",
      ad_personalization: "granted",
      analytics_storage: "granted",
    });
    loadConsentedTags();
    return;
  }

  window.gtag?.("consent", "update", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  });
}

/* ---------------------------------------------------------------- events */

const enabled = (event: SiteEvent) => config.events?.[event] !== false;

/** Mirrors a route change into the data layer and whichever tags are active. */
export function pixelPageview(path: string): void {
  if (!active || !enabled("pageview")) return;
  push({ event: "kf_pageview", page_path: path });
  if (config.debug) console.info("[pixels] pageview", path);

  window.gtag?.("event", "page_view", { page_path: path });
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
  window.gtag?.("event", names.ga4, { content_type: "cta", item_id: label });
  if (names.meta) window.fbq?.("track", names.meta);
  if (names.tiktok) window.ttq?.track?.(names.tiktok, { content_name: label });
  if (names.snap) window.snaptr?.("track", names.snap);

  // Google Ads reports a conversion only when both halves are configured; the
  // dashboard flags an id without a label for exactly this reason.
  if (event === "lead") {
    const adsId = clean(config.googleAdsId);
    const adsLabel = clean(config.googleAdsLabel);
    if (adsId && adsLabel) window.gtag?.("event", "conversion", { send_to: `${adsId}/${adsLabel}` });
  }
}
