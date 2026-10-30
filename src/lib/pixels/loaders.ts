/** One loader per marketing tag. Each is idempotent and records itself in `loaded`. */
import { injectScript, push } from "./util.ts";

/* --------------------------------------------------------------- loaders */

/*
 * No loader sends a page view of its own. `pixelPageview` is the single
 * source of page views for every tag, on every route change and once for the
 * landing page — the TikTok and Snapchat snippets used to fire their own on
 * load as well, so the entry page counted twice, while Meta got none.
 * LinkedIn's Insight Tag and Clarity track on their own and have no SPA
 * page-view call, so they are loaded and left alone.
 */

export function loadGtm(id: string): void {
  if (loaded.gtm) return;
  loaded.gtm = true;
  push({ "gtm.start": Date.now(), event: "gtm.js" });
  injectScript(`https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(id)}`);
}

export function ensureGtag(): void {
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

export function loadGoogleAnalytics(id: string): void {
  if (loaded.ga) return;
  loaded.ga = true;
  injectScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
  ensureGtag();
  // The SPA sends its own page_view per route change, so the automatic one
  // would double-count the landing page.
  window.gtag!("config", id, { send_page_view: false });
}

export function loadGoogleAds(id: string): void {
  if (loaded.ads) return;
  loaded.ads = true;
  // Shares the gtag.js runtime with GA4; loading it twice is harmless but the
  // script only needs fetching once.
  if (!loaded.ga) injectScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
  ensureGtag();
  window.gtag!("config", id);
}

export function loadMetaPixel(id: string): void {
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

export function loadTikTok(id: string): void {
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

export function loadSnapchat(id: string): void {
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

export function loadLinkedIn(partnerId: string): void {
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

export function loadClarity(id: string): void {
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

export const loaded = { gtm: false, ga: false, ads: false, meta: false, tiktok: false, snap: false, linkedin: false, clarity: false };

/** Whether a Google tag is present to receive `gtag("event", …)` calls. */
export const googleLoaded = () => loaded.gtm || loaded.ga || loaded.ads;
export const anyLoaded = () => Object.values(loaded).some(Boolean);
