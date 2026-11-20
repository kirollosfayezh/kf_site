import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "../lib/i18n";
import { useContactInfo } from "../lib/settings";
import { useWhatsAppLink } from "../hooks/useWhatsAppLink";
import styles from "./ContactFab.module.css";

/**
 * The bottom floating launcher: a call button that opens a small card with
 * the two ways to reach a person — WhatsApp and a phone call.
 *
 * It replaced a WhatsApp-only button: visitors who would rather ring had to
 * find the number in the footer. The card opens to the side of the button,
 * not above it, because the chat launcher sits directly above.
 *
 * Both rows keep labels the analytics already understand: `footer.whatsapp`
 * (the old button's label, so its history continues) and `footer.phone`. The
 * toggle itself is not tracked — opening the card is not a contact.
 */
export function ContactFab() {
  const { t } = useI18n();
  const { phone } = useContactInfo();
  const waLink = useWhatsAppLink();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const tel = `tel:${phone.replace(/[^+\d]/g, "")}`;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={styles.root}>
      <div id={menuId} className={styles.menu} data-open={open || undefined} hidden={!open}>
        <a
          href={waLink}
          target="_blank"
          rel="noopener noreferrer"
          data-track="footer.whatsapp"
          className={styles.item}
          onClick={() => setOpen(false)}
        >
          <span className={`${styles.icon} ${styles.iconWa}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d={WA_PATH} />
            </svg>
          </span>
          <span className={styles.text}>
            <b>{t("WhatsApp")}</b>
            <span dir="ltr">{phone}</span>
          </span>
        </a>
        <a href={tel} data-track="footer.phone" className={styles.item} onClick={() => setOpen(false)}>
          <span className={`${styles.icon} ${styles.iconCall}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d={PHONE_PATH} />
            </svg>
          </span>
          <span className={styles.text}>
            <b>{t("Call us")}</b>
            <span dir="ltr">{phone}</span>
          </span>
        </a>
      </div>

      <button
        ref={toggleRef}
        type="button"
        className={styles.fab}
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={open ? t("Close") : t("Call or WhatsApp us")}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d={PHONE_PATH} />
          </svg>
        )}
      </button>
    </div>
  );
}

const PHONE_PATH =
  "M6.6 10.8a15.2 15.2 0 006.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 013 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z";

const WA_PATH =
  "M12 2a10 10 0 00-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1012 2zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5-4.5-.2-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.7-.1l.9-1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.4.1.2.1.9-.1 1.5z";
