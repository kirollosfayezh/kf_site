import { useEffect, useRef } from "react";

/**
 * Ports kf-reveal.js to a per-element React hook: attach the returned ref to
 * any element that has the `kf-reveal` class. When it scrolls into view, the
 * `kf-in` class is added, triggering the kfSlide/kfRise CSS animation defined
 * in index.css. Respects prefers-reduced-motion by revealing immediately.
 */
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

    const vw = window.innerWidth || 1200;
    const rect = el.getBoundingClientRect();
    const mid = rect.left + rect.width / 2;
    el.style.setProperty("--kx", mid < vw / 2 ? "-72px" : "72px");

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add("kf-in");
            el.style.opacity = "1";
            io.unobserve(el);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);

    return () => io.disconnect();
  }, []);

  return ref;
}
