import { API_BASE } from "./http";

/**
 * First-party analytics: page views and clicks on the controls that matter,
 * sent to our own API. No cookies and no third party — the visitor id is a
 * random string in localStorage so repeat visits can be told apart, and so a
 * visitor who later gets in touch (chat, form, booking) is linked to what they
 * read first. The Privacy Policy says so.
 *
 * Two events besides views and clicks feed the dashboard's Visitors screen:
 * `session`, once per tab, carrying where the visit came from (referrer and
 * campaign parameters) and the device's time zone; and `consent`, the
 * visitor's cookie choice, kept as a record the business can show.
 *
 * Events are queued and flushed in batches, because one request per click would
 * both hammer the API and lose the last event when the page unloads.
 */

type EventType = "pageview" | "click" | "conversion" | "session" | "consent";

interface Touch {
  referrer?: string;
  landingPath?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  gclid?: string;
  fbclid?: string;
}

interface QueuedEvent {
  type: EventType;
  path: string;
  label?: string;
  visitorId?: string;
  sessionId?: string;
  touch?: Touch;
  timezone?: string;
  screen?: string;
  status?: "granted" | "denied";
  source?: "banner" | "settings";
  referrer?: string;
  lang?: string;
  device?: "mobile" | "tablet" | "desktop";
  ts: number;
}

const STORAGE_KEY = "kf-visitor-id";
const SESSION_KEY = "kf-session-id";
const FLUSH_DELAY = 2000;
const MAX_BATCH = 50;

let queue: QueuedEvent[] = [];
let timer: number | undefined;
let listening = false;

/** Reuses the chat widget's visitor id, so a person is one visitor across both. */
export function currentVisitorId(): string | undefined {
  return visitorId();
}

function visitorId(): string | undefined {
  try {
    let id = localStorage.getItem(STORAGE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    // Private mode or blocked storage: still report, just without an id.
    return undefined;
  }
}

/**
 * One id per browser tab visit. sessionStorage is per tab and survives
 * reloads, which is what a "session" means here. Returns whether it is new,
 * so the `session` event goes out once.
 */
let memorySession: string | null = null;
function session(): { id: string; fresh: boolean } {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return { id: existing, fresh: false };
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
    return { id, fresh: true };
  } catch {
    if (memorySession) return { id: memorySession, fresh: false };
    memorySession = `s-${Date.now().toString(36)}`;
    return { id: memorySession, fresh: true };
  }
}

/**
 * The referrer and landing URL parked by `auto-language.ts` before it
 * redirected a first-time visitor to their language. Read once and cleared:
 * after that redirect `document.referrer` is this site, so without the stash
 * every such visitor arrived from "direct".
 */
function entryStash(): { referrer?: string; url?: string } | null {
  try {
    const raw = sessionStorage.getItem("kf-entry");
    if (!raw) return null;
    sessionStorage.removeItem("kf-entry");
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as { referrer?: string; url?: string }) : null;
  } catch {
    return null;
  }
}

/** Where this visit came from: the referring site and any campaign tags on the landing URL. */
function touch(): Touch {
  const entry = entryStash();
  const q = new URLSearchParams(window.location.search);
  const t: Touch = {
    referrer: hostOf(entry?.referrer) ?? referrer(),
    landingPath: window.location.pathname,
    utmSource: q.get("utm_source") ?? undefined,
    utmMedium: q.get("utm_medium") ?? undefined,
    utmCampaign: q.get("utm_campaign") ?? undefined,
    utmTerm: q.get("utm_term") ?? undefined,
    utmContent: q.get("utm_content") ?? undefined,
    gclid: q.get("gclid") ?? undefined,
    fbclid: q.get("fbclid") ?? undefined,
  };
  for (const k of Object.keys(t) as (keyof Touch)[]) if (!t[k]) delete t[k];
  return t;
}

function timezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

function device(): QueuedEvent["device"] {
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

/** Only the host, so we group "came from Google" rather than per-URL noise.
 *  Our own host reads as no referrer at all: an internal hop is not a source. */
function hostOf(raw: string | undefined): string | undefined {
  try {
    if (!raw) return undefined;
    const url = new URL(raw);
    if (url.host === window.location.host) return undefined;
    return `${url.protocol}//${url.host}`;
  } catch {
    return undefined;
  }
}

function referrer(): string | undefined {
  return hostOf(document.referrer);
}

function send(events: QueuedEvent[]): void {
  if (events.length === 0) return;
  const url = `${API_BASE}/analytics/events`;
  const payload = JSON.stringify({ events });

  // sendBeacon survives the page being closed, which plain fetch does not.
  try {
    if (navigator.sendBeacon?.(url, new Blob([payload], { type: "application/json" }))) return;
  } catch {
    /* fall through to fetch */
  }
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // Analytics must never surface an error to the visitor.
  });
}

function flush(): void {
  window.clearTimeout(timer);
  timer = undefined;
  if (queue.length === 0) return;
  const batch = queue.slice(0, MAX_BATCH);
  queue = queue.slice(MAX_BATCH);
  send(batch);
}

function enqueue(event: Omit<QueuedEvent, "ts" | "visitorId" | "device" | "lang" | "referrer" | "sessionId">): void {
  const s = session();
  if (s.fresh) {
    queue.push({
      type: "session",
      path: window.location.pathname,
      visitorId: visitorId(),
      sessionId: s.id,
      touch: touch(),
      timezone: timezone(),
      screen: `${window.screen.width}x${window.screen.height}`,
      lang: document.documentElement.lang || undefined,
      ts: Date.now(),
    });
  }
  queue.push({
    ...event,
    sessionId: s.id,
    visitorId: visitorId(),
    device: device(),
    lang: document.documentElement.lang || undefined,
    referrer: referrer(),
    ts: Date.now(),
  });

  if (!listening) {
    listening = true;
    // A visitor leaving is exactly when the last events would otherwise be lost.
    addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
    addEventListener("pagehide", flush);
  }

  if (queue.length >= MAX_BATCH) {
    flush();
    return;
  }
  window.clearTimeout(timer);
  timer = window.setTimeout(flush, FLUSH_DELAY);
}

export function trackPageview(path: string): void {
  enqueue({ type: "pageview", path });
}

/** `label` is a stable dotted id, e.g. "hero.start-project". */
export function trackClick(label: string, path = window.location.pathname): void {
  enqueue({ type: "click", path, label });
}

/**
 * The visitor's cookie choice, sent straight away (not batched): it is the
 * record, so it must not wait on a timer the visitor might outrun.
 */
export function trackConsent(status: "granted" | "denied", source: "banner" | "settings"): void {
  enqueue({ type: "consent", path: window.location.pathname, status, source });
  flush();
}

/**
 * Something the visitor completed — a lead sent, a call booked, a quote
 * accepted. `kind` is the label. Sent straight away, like consent: it is the
 * event the dashboard's numbers hang on, and a visitor who has just submitted
 * a form is exactly the one about to leave the page.
 */
export function trackConversionEvent(kind: string): void {
  enqueue({ type: "conversion", path: window.location.pathname, label: kind });
  flush();
}
