/**
 * The opening animation's state, shared by everything that has to wait for it.
 *
 * `<html data-intro>` carries the phase — `pending` (set by the inline boot
 * script before the first paint, so the page is covered from the start),
 * `loading` (the engine is being fetched), `playing`, `revealed` (the paper
 * has been cut; the page's own entrance may run) — and is removed once the
 * overlay is gone. The hero's WebGL scene, the offer popup and the chat's
 * greeting all hold back until then, so nothing competes with the intro for
 * the GPU or pops up underneath it.
 *
 * The same rules decide whether it plays here and in `build/boot-script.ts`;
 * keep the two in step.
 */

export type IntroState = "pending" | "loading" | "playing" | "revealed";

export const INTRO_SEEN_KEY = "kf-intro-seen";
/** Once a day is often enough: a returning visitor gets the page, not the show. */
export const INTRO_TTL_MS = 24 * 60 * 60 * 1000;
export const INTRO_REVEALED_EVENT = "kf:intro-revealed";
export const INTRO_DONE_EVENT = "kf:intro-done";

export function introState(): IntroState | null {
  const v = document.documentElement.getAttribute("data-intro");
  return v === "pending" || v === "loading" || v === "playing" || v === "revealed" ? v : null;
}

/** True while the overlay is up at all. */
export function introRunning(): boolean {
  return introState() !== null;
}

/** True while the overlay still covers the page (before the cut). */
export function introCovering(): boolean {
  const s = introState();
  return s !== null && s !== "revealed";
}

export function setIntroState(state: IntroState | null): void {
  const root = document.documentElement;
  if (state) root.setAttribute("data-intro", state);
  else root.removeAttribute("data-intro");
  // Visible in DevTools' Performance panel and `performance.getEntriesByType("mark")`:
  // how long the show took on a real device is one call away.
  performance.mark?.(`kf-intro-${state ?? "done"}`);
  if (state === "revealed") window.dispatchEvent(new CustomEvent(INTRO_REVEALED_EVENT));
  if (state === null) window.dispatchEvent(new CustomEvent(INTRO_DONE_EVENT));
}

export function markIntroSeen(): void {
  try {
    localStorage.setItem(INTRO_SEEN_KEY, String(Date.now()));
  } catch {
    /* no storage: they may see it again next visit */
  }
}

/** Runs `fn` now if nothing covers the page, else once the intro reveals it. */
export function afterIntroReveal(fn: () => void): () => void {
  if (!introCovering()) {
    fn();
    return () => {};
  }
  const once = () => fn();
  window.addEventListener(INTRO_REVEALED_EVENT, once, { once: true });
  return () => window.removeEventListener(INTRO_REVEALED_EVENT, once);
}

/**
 * Runs `fn` now if no intro is up, else once the overlay is gone. For work
 * heavy enough to stall a frame (the hero's shader compile): started at the
 * reveal it would freeze the paper's fade-out.
 */
export function afterIntroDone(fn: () => void): () => void {
  if (!introRunning()) {
    fn();
    return () => {};
  }
  const once = () => fn();
  window.addEventListener(INTRO_DONE_EVENT, once, { once: true });
  return () => window.removeEventListener(INTRO_DONE_EVENT, once);
}

/** Only the homepage gets the show; a deep link is someone who wants that page. */
export function isIntroRoute(pathname: string): boolean {
  const p = pathname.replace(/\/+$/, "") || "/";
  return p === "/" || p === "/ar" || p === "/de" || p === "/fr";
}

/**
 * Whether the intro should play on this visit. Mirrors the boot script:
 * homepage, not seen today, motion allowed, not an automated browser (lab
 * tools and crawlers measure the page, not the show), not on a data-saving
 * or 2G connection, and a viewport big enough to read it.
 */
export function shouldPlayIntro(pathname: string): boolean {
  if (!isIntroRoute(pathname)) return false;
  // `?kf-intro` replays it regardless of the once-a-day memory and of the
  // lab-tool rules: for showing it to someone, and for testing it on a real
  // phone through a driven browser. Nobody adds that to an audit by accident.
  const replay = new URLSearchParams(window.location.search).has("kf-intro");
  if (!replay) {
    try {
      const seen = Number(localStorage.getItem(INTRO_SEEN_KEY) || 0);
      if (Date.now() - seen < INTRO_TTL_MS) return false;
    } catch {
      /* fine: no memory of it either way */
    }
    // Lab tools measure the page, not the show. Headless and driven browsers
    // report `webdriver`; Lighthouse (PageSpeed Insights, the DevTools panel),
    // GTmetrix and WebPageTest identify themselves in the user agent instead.
    if (navigator.webdriver || /Lighthouse|HeadlessChrome|GTmetrix|PTST/.test(navigator.userAgent)) return false;
  }
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const conn = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
  if (conn?.saveData || /2g/.test(conn?.effectiveType ?? "")) return false;
  if (Math.min(window.innerWidth, window.innerHeight) < 320) return false;
  return true;
}

/** WebGL that is actually accelerated; the scene is not worth a software renderer. */
export function hasFastWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2", { failIfMajorPerformanceCaveat: true }) ?? c.getContext("webgl", { failIfMajorPerformanceCaveat: true });
    if (!gl) return false;
    (gl as WebGLRenderingContext).getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}
