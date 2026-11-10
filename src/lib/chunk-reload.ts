import { createElement, lazy, useState, type ComponentProps, type ComponentType } from "react";

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

/** A route page that can be loaded ahead of its first render. */
export type PreloadablePage<T extends ComponentType<any>> = ComponentType<ComponentProps<T>> & { // eslint-disable-line @typescript-eslint/no-explicit-any
  preload: () => Promise<void>;
};

/**
 * `React.lazy` that reloads the page once when its file is from an older
 * deploy, and that can be loaded ahead of time with `.preload()`.
 *
 * Once the module is in, the page renders it directly instead of through
 * `lazy`. That matters for hydration: `main.tsx` preloads the current
 * route's page before hydrating, so the page hydrates in the same pass as
 * the layout. Through `lazy` it suspended instead, and any state update in
 * that gap (the settings or content revalidating, the theme) made React
 * throw the prerendered page away and draw it again — measured on the live
 * article at 2.6 s on a throttled phone, with the cover photo as the
 * largest paint arriving 2 s after it had downloaded.
 */
export function lazyWithReload<T extends ComponentType<any>>( // eslint-disable-line @typescript-eslint/no-explicit-any
  factory: () => Promise<{ default: T }>,
): PreloadablePage<T> {
  let loaded: T | undefined;
  const load = () =>
    factory().then(
      (m) => {
        loaded = m.default;
        return m;
      },
      (err: unknown) => {
        // Never settles: the page is about to be replaced, so no error screen flashes.
        if (isChunkLoadError(err) && reloadForNewDeploy()) return new Promise<{ default: T }>(() => {});
        throw err;
      },
    );
  const Lazy = lazy(load);
  // Chosen once per mount: switching from `Lazy` to the module on a later
  // render would remount the page and lose its state (a half-filled form).
  const Page = ((props: ComponentProps<T>) => {
    const [Component] = useState<ComponentType<any>>(() => loaded ?? Lazy); // eslint-disable-line @typescript-eslint/no-explicit-any
    return createElement(Component, props);
  }) as PreloadablePage<T>;
  Page.preload = () => (loaded ? Promise.resolve() : load().then(() => undefined));
  return Page;
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
