import { API_BASE } from "./http";

/**
 * First-party analytics: page views and clicks on the controls that matter,
 * sent to our own API. No cookies and no third party — the visitor id is a
 * random string in localStorage purely so repeat visits can be told apart.
 *
 * Events are queued and flushed in batches, because one request per click would
 * both hammer the API and lose the last event when the page unloads.
 */

type EventType = "pageview" | "click";

interface QueuedEvent {
  type: EventType;
  path: string;
  label?: string;
  visitorId?: string;
  referrer?: string;
  lang?: string;
  device?: "mobile" | "tablet" | "desktop";
  ts: number;
}

const STORAGE_KEY = "kf-visitor-id";
const FLUSH_DELAY = 2000;
const MAX_BATCH = 50;

let queue: QueuedEvent[] = [];
let timer: number | undefined;
let listening = false;

/** Reuses the chat widget's visitor id, so a person is one visitor across both. */
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

function device(): QueuedEvent["device"] {
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

/** Only the host, so we group "came from Google" rather than per-URL noise. */
function referrer(): string | undefined {
  try {
    const raw = document.referrer;
    if (!raw) return undefined;
    const url = new URL(raw);
    if (url.host === window.location.host) return undefined;
    return `${url.protocol}//${url.host}`;
  } catch {
    return undefined;
  }
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

function enqueue(event: Omit<QueuedEvent, "ts" | "visitorId" | "device" | "lang" | "referrer">): void {
  queue.push({
    ...event,
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
