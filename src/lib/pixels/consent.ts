/** The visitor's consent choice: storage, the banner's events, and whether a banner is needed at all. */
import type { TrackingSettings } from "../../services/api-types";
import { clean } from "./util.ts";

/* ---------------------------------------------------------------- consent */

export const CONSENT_KEY = "kf-consent";
export type Consent = "granted" | "denied";

/**
 * The visitor's stored choice, or null if they have not made one.
 *
 * Wrapped because `localStorage` throws outright in some privacy modes rather
 * than returning null — and a consent check that throws would take the whole
 * page down.
 */
export function readConsent(): Consent | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

/** Lets the footer's "Cookie settings" link reopen the banner from anywhere,
 *  without threading state through the whole tree for a once-a-session action. */
export const CONSENT_REOPEN_EVENT = "kf:consent-reopen";

/** Fired on `window` after a decision is stored; `detail` is the `Consent`. */
export const CONSENT_CHANGED_EVENT = "kf:consent-changed";

export function reopenConsent(): void {
  window.dispatchEvent(new CustomEvent(CONSENT_REOPEN_EVENT));
}

export function storeConsent(value: Consent): void {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    /* a visitor who blocks storage simply gets asked again next visit */
  }
}

/**
 * Whether a banner should be shown: only when consent is actually required
 * *and* something would otherwise set a third-party cookie.
 *
 * A site with no tags configured sets no such cookie, so asking permission for
 * one would be theatre — and trains people to dismiss the banner that does
 * matter.
 */
export function needsConsent(settings: TrackingSettings | undefined): boolean {
  if (!settings?.consentMode) return false;
  // A decision of either kind is final until the visitor reopens the banner.
  if (readConsent()) return false;
  // Nothing loads under Do Not Track, so there is nothing to ask about.
  if (settings.respectDnt !== false && dntEnabled()) return false;
  return anyTagConfigured(settings);
}

export function anyTagConfigured(s: TrackingSettings): boolean {
  return [
    s.gtmId,
    s.googleAnalyticsId,
    s.googleAdsId,
    s.metaPixelId,
    s.tiktokPixelId,
    s.snapchatPixelId,
    s.linkedinPartnerId,
    s.clarityId,
  ].some((v) => clean(v).length > 0);
}

/** Whether the visitor has asked not to be tracked. */
export function dntEnabled(): boolean {
  const nav = navigator as Navigator & { msDoNotTrack?: string };
  const w = window as Window & { doNotTrack?: string };
  const flag = nav.doNotTrack ?? w.doNotTrack ?? nav.msDoNotTrack;
  return flag === "1" || flag === "yes";
}
