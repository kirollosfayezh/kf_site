import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import Lenis from "lenis";

/**
 * Lenis smooth scrolling, wired once for the whole app.
 *
 * Same options the static export used (`_initLenis` in every `.dc.html`):
 * `{ duration: 1.05, smoothWheel: true, touchMultiplier: 1.6 }`, driven by a
 * rAF loop and skipped entirely under `prefers-reduced-motion`.
 *
 * Unlike the static pages — where each document created and destroyed its own
 * instance — this is a single instance that survives client-side navigation.
 * Route changes only reset the scroll position; we never tear the instance
 * down and rebuild it, which used to leave the wheel handler detached for a
 * frame and made the first scroll after a navigation feel stuck.
 */
export function useSmoothScroll() {
  const lenisRef = useRef<Lenis | null>(null);
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // `scroll-behavior: smooth` on <html> fights Lenis' own interpolation and
    // makes programmatic jumps (anchor links, route changes) crawl.
    const root = document.documentElement;
    const prevBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";

    const lenis = new Lenis({ duration: 1.05, smoothWheel: true, touchMultiplier: 1.6 });
    lenisRef.current = lenis;

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
      lenisRef.current = null;
      root.style.scrollBehavior = prevBehavior;
    };
  }, []);

  // Scroll to top on navigation. With Lenis active, `window.scrollTo` is not
  // enough: Lenis keeps its own animated position and would scroll straight
  // back, so the instance has to be told to reset too.
  useEffect(() => {
    const lenis = lenisRef.current;
    if (lenis) {
      lenis.scrollTo(0, { immediate: true, force: true });
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname]);
}
