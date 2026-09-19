/**
 * Third-party marketing pixels (GA4 and Meta), loaded only when an id is set in
 * the dashboard's site settings. Nothing is injected otherwise, so a site with
 * no ids configured ships no third-party script and sets no third-party cookie.
 *
 * These are deliberately separate from `services/analytics.ts`: that is our own
 * first-party reporting and always runs; these are optional marketing tags.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[] };
    _fbq?: unknown;
  }
}

let loaded = { ga: false, meta: false };

function injectScript(src: string, async = true): void {
  const s = document.createElement("script");
  s.src = src;
  s.async = async;
  document.head.appendChild(s);
}

function loadGoogleAnalytics(id: string): void {
  if (loaded.ga) return;
  loaded.ga = true;

  injectScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  // The SPA sends its own page_view per route change, so the automatic one
  // would double-count the first page.
  window.gtag("config", id, { send_page_view: false });
}

function loadMetaPixel(id: string): void {
  if (loaded.meta) return;
  loaded.meta = true;

  /* eslint-disable */
  const f = window as any;
  if (!f.fbq) {
    const n: any = (f.fbq = function (...args: unknown[]) {
      n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
  }
  /* eslint-enable */
  injectScript("https://connect.facebook.net/en_US/fbevents.js");
  window.fbq?.("init", id);
}

export function initPixels(pixels: { googleAnalyticsId?: string; metaPixelId?: string } | undefined): void {
  if (!pixels) return;
  const ga = pixels.googleAnalyticsId?.trim();
  const meta = pixels.metaPixelId?.trim();
  if (ga) loadGoogleAnalytics(ga);
  if (meta) loadMetaPixel(meta);
}

/** Mirrors a route change into whichever pixels are active. */
export function pixelPageview(path: string): void {
  window.gtag?.("event", "page_view", { page_path: path });
  window.fbq?.("track", "PageView");
}

/** Mirrors a tracked click; Meta gets a Lead event for form submissions. */
export function pixelEvent(label: string): void {
  window.gtag?.("event", "select_content", { content_type: "cta", item_id: label });
  if (label.endsWith(".submit")) window.fbq?.("track", "Lead");
}
