import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { trackClick, trackPageview } from "../services/analytics";
import { initPixels, pixelEvent, pixelPageview } from "./pixels";
import type { SiteSettings } from "../services/api-types";

/**
 * Reports a page view on every route change, and any click on an element
 * carrying `data-track="some.label"` (including clicks on children of it).
 *
 * Using one delegated listener rather than an onClick per button means adding
 * tracking to a new control is a single attribute, and no handler can be
 * forgotten when a component is refactored.
 */
export function AnalyticsProvider({ settings }: { settings: SiteSettings | null }) {
  const location = useLocation();
  const replayed = useRef(false);

  useEffect(() => {
    if (!settings) return;
    // `?? {}` matters: a settings document written before the Marketing screen
    // existed has no `pixels` at all, and passing `undefined` would skip
    // initialisation entirely — taking the data layer with it, so a Tag Manager
    // container added later would see no events.
    initPixels(settings.pixels ?? {});

    // The landing page's route effect already ran, while the tags were still
    // inactive, so that view never reached them. Replay it once — without this
    // every marketing platform is missing the entry page of every session, which
    // is the one that carries the campaign parameters.
    if (!replayed.current) {
      replayed.current = true;
      pixelPageview(window.location.pathname || "/");
    }
  }, [settings]);

  useEffect(() => {
    const path = location.pathname || "/";
    trackPageview(path);
    // Suppressed until the replay above has run, so the entry page is reported
    // exactly once rather than zero or two times.
    if (replayed.current) pixelPageview(path);
  }, [location.pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>("[data-track]");
      const label = target?.dataset.track?.trim();
      if (!label) return;
      trackClick(label);
      pixelEvent(label);
    };
    // Capture phase: a tracked control that navigates away still reports first.
    document.addEventListener("click", onClick, { capture: true });
    return () => document.removeEventListener("click", onClick, { capture: true });
  }, []);

  return null;
}
