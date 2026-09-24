import { useEffect, useRef, useState } from "react";
import { useI18n } from "../lib/i18n";
import { CONSENT_REOPEN_EVENT, needsConsent, readConsent, setConsent } from "../lib/pixels";
import { trackConsent } from "../services/analytics";
import type { SiteSettings } from "../services/api-types";
import s from "./ConsentBanner.module.css";

/**
 * Cookie consent, asked only when there is something to consent to.
 *
 * The banner appears when the Marketing screen has "Ask for cookie consent"
 * switched on *and* at least one tag is configured. A site with no tags sets no
 * third-party cookie, so asking permission for one would be theatre — and a
 * banner people learn to dismiss without reading is worse than no banner.
 *
 * Accept and Decline are the same size and weight on purpose. A decline hidden
 * as a faint link is a dark pattern, and under the EU rules it invalidates the
 * consent it was meant to collect.
 *
 * Deliberately not a modal: it does not trap focus or block the page. Refusing
 * to let someone read the site until they answer is its own compliance problem,
 * and the decision is remembered either way.
 */
export function ConsentBanner({ settings }: { settings: SiteSettings | null }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!settings) return;
    // `needsConsent` already accounts for a stored decision, Do Not Track, and
    // whether any tag is configured at all.
    setVisible(needsConsent(settings.pixels ?? {}));
  }, [settings]);

  // Withdrawing consent has to be as easy as giving it, so the footer link
  // brings the banner back whatever was chosen before.
  useEffect(() => {
    const onReopen = () => setVisible(true);
    window.addEventListener(CONSENT_REOPEN_EVENT, onReopen);
    return () => window.removeEventListener(CONSENT_REOPEN_EVENT, onReopen);
  }, []);

  /**
   * Publishes the bar's height so the floating chat and WhatsApp buttons can
   * lift above it. Measured rather than hardcoded: the bar is one line on a
   * desktop and four on a phone, and it changes again between languages.
   */
  useEffect(() => {
    const root = document.documentElement;
    const el = panelRef.current;
    if (!visible || !el) {
      root.style.removeProperty("--kf-consent-h");
      return;
    }
    const apply = () => root.style.setProperty("--kf-consent-h", `${Math.ceil(el.getBoundingClientRect().height) + 24}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--kf-consent-h");
    };
  }, [visible]);

  if (!visible) return null;

  const decide = (value: "granted" | "denied") => {
    // A first answer, or a change made later from the footer's "Cookie settings".
    trackConsent(value, readConsent() ? "settings" : "banner");
    setConsent(value);
    setVisible(false);
  };

  return (
    <div className={s.bar} role="region" aria-label={t("Cookie choices")}>
      <div className={s.panel} ref={panelRef}>
        <p className={s.text}>
          {t(
            "We use cookies to measure how the site is used and to make our advertising relevant. You can decline and the site works exactly the same.",
          )}
        </p>
        <div className={s.actions}>
          <button type="button" className={s.btn} onClick={() => decide("denied")}>
            {t("Decline")}
          </button>
          <button type="button" className={`${s.btn} ${s.accept}`} onClick={() => decide("granted")}>
            {t("Accept")}
          </button>
        </div>
      </div>
    </div>
  );
}
