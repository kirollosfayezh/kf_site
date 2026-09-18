import { useEffect, useRef } from "react";

/**
 * Ports kf-reveal.js to a per-element React hook: attach the returned ref to
 * any element that has the `kf-reveal` class. When it scrolls into view, the
 * `kf-in` class is added, triggering the kfRise CSS animation defined in
 * index.css. Respects prefers-reduced-motion by revealing immediately.
 *
 * All revealed elements share **one** IntersectionObserver rather than getting
 * one each. The Home page alone mounts around forty of these, and the previous
 * version both created forty observers and called `getBoundingClientRect()`
 * forty times during mount — each of those a synchronous layout flush, on the
 * same frame React was already committing the page. The shared observer hands
 * us `entry.boundingClientRect` for free, so the horizontal offset is now read
 * off data the browser had already computed instead of forcing new layout.
 */

/** Elements waiting to be revealed, and how far sideways they should come in. */
let observer: IntersectionObserver | null = null;

function reveal(el: HTMLElement, rect: DOMRectReadOnly): void {
  const vw = window.innerWidth || 1200;
  const mid = rect.left + rect.width / 2;
  el.style.setProperty("--kx", mid < vw / 2 ? "-72px" : "72px");
  el.classList.add("kf-in");
  el.style.opacity = "1";
}

function getObserver(): IntersectionObserver {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        reveal(entry.target as HTMLElement, entry.boundingClientRect);
        observer?.unobserve(entry.target);
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
  );
  return observer;
}

export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) {
      el.classList.add("kf-in");
      el.style.opacity = "1";
      return;
    }

    const io = getObserver();
    io.observe(el);
    return () => io.unobserve(el);
  }, []);

  return ref;
}
