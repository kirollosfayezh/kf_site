import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { pick, metaString } from "../lib/content-helpers";
import { useContentList } from "../hooks/useContent";
import { useSettings } from "../lib/settings";
import { CONSENT_CHANGED_EVENT, needsConsent } from "../lib/pixels";
import { trackClick } from "../services/analytics";
import { Img } from "../components/Img";
import s from "./PromoDialog.module.css";

const DISMISS_KEY = "kf-promo-seen";

/**
 * Pages where an offer popup would get in the way of something the visitor
 * is already doing: reading their own quote, booking a call, or the ad
 * landing page, which is itself the offer.
 */
const QUIET_ROUTES = [/^\/q(\/|$)/, /^\/book$/, /^\/campaign$/];

/**
 * The offer popup, driven entirely from the dashboard's Offers screen.
 *
 * Shows the first published promo whose window is open, once per visitor per
 * promo. Deliberately:
 *
 * - **Shown promptly, and the delay is yours to set.** `delaySeconds` on the
 *   offer controls it; 1.5s is the default and 0 shows it as soon as the offer
 *   loads. The short pause exists only so the page paints first — an offer that
 *   lands over a blank screen reads as an ad, not an offer.
 * - **Dismissal is remembered per promo id**, so publishing a new offer shows
 *   again while re-visiting during the same campaign does not.
 * - **Never shown to a crawler**: it is client-only and not in the prerendered
 *   HTML, so it cannot affect what Google indexes.
 */
export function PromoDialog() {
  const { t, lang } = useI18n();
  const { data } = useContentList("promos");
  // Basename-relative, so `/ar/book` reads as `/book` here.
  const { pathname } = useLocation();
  const quiet = QUIET_ROUTES.some((r) => r.test(pathname));
  const [open, setOpen] = useState(false);

  // While the cookie bar is up the offer waits: its scrim used to cover the
  // Accept button, so the first thing a new visitor had to do was dismiss an
  // ad to reach the consent question.
  const settings = useSettings();
  const [consentPending, setConsentPending] = useState(false);
  useEffect(() => {
    if (!settings) return;
    setConsentPending(needsConsent(settings.pixels));
    const done = () => setConsentPending(false);
    window.addEventListener(CONSENT_CHANGED_EVENT, done);
    return () => window.removeEventListener(CONSENT_CHANGED_EVENT, done);
  }, [settings]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]") as string[]);
    } catch {
      /* private mode — the offer simply shows again next visit */
    }
  }, []);

  /** The first published promo inside its date window, if any. */
  const promo = useMemo(() => {
    const now = Date.now();
    return (data ?? []).find((p) => {
      const from = metaString(p.meta, "startsAt");
      const to = metaString(p.meta, "endsAt");
      if (from && Date.parse(from) > now) return false;
      // `endsAt` is inclusive of that whole day, which is what an editor means
      // by "ends on the 30th".
      if (to && Date.parse(to) + 86_400_000 < now) return false;
      return true;
    });
  }, [data]);

  useEffect(() => {
    if (!promo || dismissed.includes(promo.id) || quiet || consentPending) return;

    // Measured from when the page loaded, not from when the offer arrived —
    // otherwise the fetch time is added to the delay, and a slow connection
    // pushes the offer past the point anyone is still looking.
    const configured = Number(metaString(promo.meta, "delaySeconds") ?? "");
    const wanted = Number.isFinite(configured) && configured >= 0 ? configured * 1000 : 1500;
    const elapsed = performance.now();
    const remaining = Math.max(0, wanted - elapsed);

    if (remaining === 0) {
      setOpen(true);
      return;
    }
    const id = window.setTimeout(() => setOpen(true), remaining);
    return () => window.clearTimeout(id);
  }, [promo, dismissed, quiet, consentPending]);

  // Navigating onto a quiet route closes an offer that is already up.
  useEffect(() => {
    if (quiet) setOpen(false);
  }, [quiet]);

  // An impression, so the dashboard can tell how many saw the offer versus
  // how many clicked it — otherwise the popup's effect is invisible.
  useEffect(() => {
    if (open && promo) trackClick("promo.view");
  }, [open, promo]);

  const close = () => {
    setOpen(false);
    if (!promo) return;
    const next = [...dismissed, promo.id];
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next.slice(-20)));
    } catch {
      /* ignore */
    }
  };

  // Escape closes, focus is trapped, and the page behind does not scroll.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key !== "Tab") return;
      const f = panelRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
      if (!f?.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusId = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("button, a")?.focus(), 80);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      window.clearTimeout(focusId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || !promo) return null;

  const title = pick(promo.title, lang);
  const desc = pick(promo.summary ?? promo.body, lang);
  const badge = metaString(promo.meta, "badge");
  const ctaLabel = metaString(promo.meta, "ctaLabel");
  const ctaUrl = metaString(promo.meta, "ctaUrl");
  const endsAt = metaString(promo.meta, "endsAt");
  const photo = promo.media?.[0];

  return createPortal(
    <div className={s.scrim} onClick={close}>
      <div
        ref={panelRef}
        className={s.panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className={s.close} onClick={close} aria-label={t("Close")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {photo ? (
          <div className={s.media}>
            <Img src={photo} alt={metaString(promo.meta, "alt") || ""} width={800} sizes="(max-width: 720px) 100vw, 440px" />
            {badge ? <span className={s.badge}>{badge}</span> : null}
          </div>
        ) : null}

        <div className={s.body}>
          {!photo && badge ? <span className={s.badge} style={{ position: "static", alignSelf: "flex-start" }}>{badge}</span> : null}
          <h2 className={s.title}>{title}</h2>
          {desc ? <p className={s.desc}>{desc}</p> : null}
          {endsAt ? (
            <div className={s.ends}>
              {t("Offer ends")} {new Date(endsAt).toLocaleDateString(lang === "ar" ? "ar-EG" : lang, { day: "numeric", month: "long", year: "numeric" })}
            </div>
          ) : null}

          <div className={s.actions}>
            {ctaUrl && /^https?:\/\//.test(ctaUrl) ? (
              <a href={ctaUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" data-track="promo.cta" onClick={close}>
                {ctaLabel || t("Claim this offer")}
              </a>
            ) : (
              <Link to={ctaUrl || "/contact"} className="btn btn-primary" data-track="promo.cta" onClick={close}>
                {ctaLabel || t("Claim this offer")}
              </Link>
            )}
            <button type="button" className="btn btn-outline" onClick={close}>
              {t("Maybe later")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
