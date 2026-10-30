import type { TrackingSettings } from "../../services/api-types";
import { CONVERSIONS, NAMES, classify, type ConversionDetails, type ConversionKind } from "./catalog.ts";
import { CONSENT_CHANGED_EVENT, dntEnabled, readConsent, storeConsent, type Consent } from "./consent.ts";
import {
  anyLoaded,
  ensureGtag,
  googleLoaded,
  loadClarity,
  loadGoogleAds,
  loadGoogleAnalytics,
  loadGtm,
  loadLinkedIn,
  loadMetaPixel,
  loadSnapchat,
  loadTikTok,
  loaded,
} from "./loaders.ts";
import { clean, push } from "./util.ts";

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

export { classify, type ConversionDetails, type ConversionKind, type SiteEvent } from "./catalog.ts";
export {
  CONSENT_CHANGED_EVENT,
  CONSENT_REOPEN_EVENT,
  needsConsent,
  readConsent,
  reopenConsent,
  type Consent,
} from "./consent.ts";

let config: TrackingSettings = {};
let active = false;

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
