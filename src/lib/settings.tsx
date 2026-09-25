import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { SiteSettings } from "../services/api-types";
import { resolveContact, type ContactInfo } from "./contact";

/**
 * Site settings, as fetched once by `App`, for anything that renders from
 * them: the footer's contact details and profiles, the WhatsApp links, the
 * share card's X handle. `null` until the fetch lands — consumers fall back to
 * the compiled-in defaults through `resolveContact`/`resolveSocial`, so the
 * first paint is never blank.
 */
const SettingsContext = createContext<SiteSettings | null>(null);

export function SettingsProvider({ value, children }: { value: SiteSettings | null; children: ReactNode }) {
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SiteSettings | null {
  return useContext(SettingsContext);
}

/** Email, phone and WhatsApp number — the dashboard's, or the defaults. */
export function useContactInfo(): ContactInfo {
  const settings = useSettings();
  return useMemo(() => resolveContact(settings?.contact), [settings?.contact]);
}
