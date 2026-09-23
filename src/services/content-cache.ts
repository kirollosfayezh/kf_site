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

/** What is already known for this key, or null. Synchronous, for first paint. */
export function cached<T>(key: string): T | null {
  return resolved.has(key) ? (resolved.get(key) as T) : null;
}

/** Fetches `path`, sharing any request already in flight for the same key. */
export function fetchCached<T>(key: string, path: string): Promise<T> {
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
