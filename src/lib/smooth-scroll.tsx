import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import Lenis from "lenis";

/**
 * Lenis smooth scrolling, wired once for the whole app.
 *
 * Driven by a rAF loop and skipped entirely under `prefers-reduced-motion`.
 *
 * The static export used `duration: 1.05` (`_initLenis` in every `.dc.html`).
 * That is Lenis' time-based mode: whatever you do, the page takes a fixed 1.05s
 * to arrive. Measured on the built site, scrolling kept moving for **951ms
 * after the last wheel event** while frames held a steady 60fps — so the page
 * was not dropping frames, it was simply ignoring you for a second. That reads
 * as lag, and no amount of paint optimisation would have touched it.
 *
 * `lerp` replaces it with frame-rate-independent exponential smoothing: the
 * distance left is closed by a fraction each frame, so it starts moving on the
 * first frame and settles in roughly a quarter of the time while staying just
 * as smooth. Raise it towards 1 for snappier, lower for floatier.
 *
 * Unlike the static pages — where each document created and destroyed its own
 * instance — this is a single instance that survives client-side navigation.
 * Route changes only reset the scroll position; we never tear the instance
 * down and rebuild it, which used to leave the wheel handler detached for a
 * frame and made the first scroll after a navigation feel stuck.
 */
export function useSmoothScroll() {
  const lenisRef = useRef<Lenis | null>(null);
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    // `scroll-behavior: smooth` on <html> fights Lenis' own interpolation and
    // makes programmatic jumps (anchor links, route changes) crawl.
    const root = document.documentElement;
    const prevBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";

    const lenis = new Lenis({ lerp: 0.2, smoothWheel: true, touchMultiplier: 1.6 });
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
  //
  // A `#slug` in the URL (the mobile menu deep-links to one service or
  // industry) scrolls to that card instead. The card may not exist yet — the
  // list renders from the CMS a round trip later — so it is looked for over a
  // short window rather than once.
  useEffect(() => {
    const lenis = lenisRef.current;
    const toTop = () => {
      if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
      else window.scrollTo(0, 0);
    };

    const id = decodeURIComponent(hash.replace(/^#/, ""));
    if (!id) {
      toTop();
      return;
    }

    toTop();
    let raf = 0;
    const deadline = performance.now() + 2500;
    const seek = () => {
      const el = document.getElementById(id);
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - HEADER_OFFSET;
        if (lenis) lenis.scrollTo(top, { force: true });
        else window.scrollTo({ top, behavior: "smooth" });
        return;
      }
      if (performance.now() < deadline) raf = requestAnimationFrame(seek);
    };
    raf = requestAnimationFrame(seek);
    return () => cancelAnimationFrame(raf);
  }, [pathname, hash]);
}

/** The fixed header's height plus a little air, so a target is not hidden under it. */
const HEADER_OFFSET = 88;
