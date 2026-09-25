import { apiFetch } from "./http";

/**
 * A read-through cache in front of the public content API.
 *
 * Every content page mounted, fetched, and rendered its static fallback copy
 * while it waited. Returning to /projects from a case study therefore painted
 * the six fallback cards, then replaced all six the moment the real response
 * landed — different titles, different images, six fresh image requests, and
 * every reveal animation restarted. Locally that swap was 24ms; against the
 * deployed API it is a full round trip, and it is what "the cards load but not
 * smoothly" describes.
 *
 * Two things fix it:
 *
 * 1. A resolved response is kept, so a second visit renders the real content on
 *    the first frame — no loading state, no fallback, no swap.
 * 2. In-flight requests are shared. The same collection was being fetched three
 *    times on one page load (StrictMode's double mount, plus overlapping
 *    components); they now await one promise.
 *
 * Deliberately module scope, not React state: the point is to survive unmount.
 * Deliberately no expiry — the tab is the session, and every entry is
 * revalidated in the background on each mount anyway, so a stale entry lives
 * exactly one paint.
 */

const resolved = new Map<string, unknown>();
const inFlight = new Map<string, Promise<unknown>>();

/**
 * The keys read during one render, for the build-time prerender.
 *
 * `cached()` is the only synchronous read path, so recording inside it
 * captures exactly what a page looked at — hits and misses alike. The build
 * ships the hits as the page's content snapshot; on a cold client the cache
 * holds nothing but that snapshot, so the first render reads the same keys and
 * gets the same values, and hydration matches by construction.
 */
let recorder: Set<string> | null = null;

/** What is already known for this key, or null. Synchronous, for first paint. */
export function cached<T>(key: string): T | null {
  recorder?.add(key);
  return resolved.has(key) ? (resolved.get(key) as T) : null;
}

/** Seeds the cache — from the build's fetches on the server, from the page's
 *  embedded snapshot on the client — before anything renders. */
export function primeContent(entries: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(entries)) resolved.set(key, value);
}

export function resetContent(): void {
  resolved.clear();
}

export function startRecording(): void {
  recorder = new Set();
}

export function stopRecording(): { hits: Record<string, unknown>; misses: string[] } {
  const keys = recorder ?? new Set<string>();
  recorder = null;
  const hits: Record<string, unknown> = {};
  const misses: string[] = [];
  for (const key of keys) {
    if (resolved.has(key)) hits[key] = resolved.get(key);
    else misses.push(key);
  }
  return { hits, misses };
}

/** Fetches `path`, sharing any request already in flight for the same key. */
export function fetchCached<T>(key: string, path: string): Promise<T> {
  // During the prerender everything a page needs was primed up front. A fetch
  // here would mean a key the build did not know about — and a snapshot that
  // silently differs from what the client will render. Loud beats subtle.
  if (import.meta.env.SSR) throw new Error(`content fetch during prerender: ${key}`);
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const request = apiFetch<T>(path)
    .then((data) => {
      resolved.set(key, data);
      return data;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, request);
  return request;
}

/**
 * Whether a revalidation actually changed anything, compared by identity and
 * last-modified rather than deep equality.
 *
 * This is what stops a background refresh from re-rendering: handing React a
 * new array of equivalent items remounts every card and re-requests every
 * image, which is the visible cost we are removing.
 */
export function sameItems(
  a: { id?: string; updatedAt?: string }[] | null,
  b: { id?: string; updatedAt?: string }[] | null,
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  return a.every((x, i) => x.id === b[i].id && x.updatedAt === b[i].updatedAt);
}
