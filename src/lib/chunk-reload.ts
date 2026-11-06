import { lazy, type ComponentType, type LazyExoticComponent } from "react";

/**
 * Recovery from a deploy that happened while the page was open.
 *
 * Every build renames its code files (`Legal-1ol2EnMy.js` becomes
 * `Legal-CXu3sSpx.js`), and Vercel serves only the current build's files. A
 * tab opened before a deploy still runs the old entry script, so the first
 * page it has not loaded yet asks for a file that is gone: a 404 and "Failed
 * to fetch dynamically imported module", and the page never appears. Loading
 * the URL again fetches the new HTML and the new file names, so that is what
 * happens — once. A second failure within a few seconds is a real outage, not
 * a stale tab, and is left to surface rather than reload in a loop.
 */

const KEY = "kf-chunk-reload";
const WINDOW_MS = 10_000;
let reloadedThisPage = false;

/** The browsers' messages for a module file that could not be loaded. */
export function isChunkLoadError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(
    msg,
  );
}

/** Reloads the page unless it already did so moments ago. True when it reloads. */
export function reloadForNewDeploy(now: number = Date.now()): boolean {
  if (reloadedThisPage) return false;
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (now - last < WINDOW_MS) return false;
    sessionStorage.setItem(KEY, String(now));
  } catch {
    // Storage blocked (private mode, sandbox): the in-memory flag still
    // limits this page to one reload.
  }
  reloadedThisPage = true;
  window.location.reload();
  return true;
}

/** `React.lazy` that reloads the page once when its file is from an older deploy. */
export function lazyWithReload<T extends ComponentType<any>>( // eslint-disable-line @typescript-eslint/no-explicit-any
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() =>
    factory().catch((err: unknown) => {
      // Never settles: the page is about to be replaced, so no error screen flashes.
      if (isChunkLoadError(err) && reloadForNewDeploy()) return new Promise<{ default: T }>(() => {});
      throw err;
    }),
  );
}

/** Covers the other dynamic imports (dictionaries, preloads) Vite reports. */
export function installChunkReload(): void {
  window.addEventListener("vite:preloadError", (event) => {
    if (reloadForNewDeploy()) event.preventDefault();
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) reloadForNewDeploy();
  });
}

/** For tests, which share the module state. */
export function resetChunkReload(): void {
  reloadedThisPage = false;
}
