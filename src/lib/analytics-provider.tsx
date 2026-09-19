import { useEffect } from "react";
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

  useEffect(() => {
    initPixels(settings?.pixels);
  }, [settings]);

  useEffect(() => {
    const path = location.pathname || "/";
    trackPageview(path);
    pixelPageview(path);
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
