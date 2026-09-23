import { Link } from "react-router-dom";
import { reopenConsent } from "../lib/pixels";
import { useI18n } from "../lib/i18n";
import { SocialIcon, type SocialName } from "./SocialIcon";
import styles from "./Footer.module.css";

const WA_LINK =
  "https://wa.me/201500099671?text=" + encodeURIComponent("Hi KF Tech Solutions, I'd like to discuss a software project.");
const EMAIL = "kirollos.fayez.h@gmail.com";

/**
 * Only profiles that actually exist are listed. Instagram and TikTok were here
 * with `href: "#"` — a link that looks live and goes nowhere is worse than an
 * absent one, and it costs trust on the page where people check you are real.
 * Add them back with a real URL when the accounts exist.
 */
const SOCIAL: { label: SocialName; href: string }[] = [
  { label: "Facebook", href: "https://www.facebook.com/profile.php?id=61584985085435" },
  { label: "LinkedIn", href: "https://linkedin.com/in/kirollos-fayez-65a33931a" },
  { label: "GitHub", href: "https://github.com/koko619911" },
];

/**
 * The dictionary keys the whole copyright line, year included, because that is
 * the exact string the design export translated. Keeping the year dynamic and
 * substituting it into the translated string gives both: a correct year and a
 * translated line. An untranslated year still falls back to the English key.
 */
const COPYRIGHT_KEY = "\u00A9 2026 KF Tech Solutions. All rights reserved.";

function copyright(t: (k: string) => string): string {
  return t(COPYRIGHT_KEY).replace("2026", String(new Date().getFullYear()));
}

export function Footer() {
  const { t } = useI18n();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.grid}>
          <div className={styles.brandCol}>
            <Link to="/" className={styles.brand}>
              <img src="/logo-icon.png" alt="" width={38} height={38} className={styles.logo} loading="lazy" decoding="async" />
              <span className={styles.brandTitle}>KF Tech Solutions</span>
            </Link>
            <p className={styles.desc}>
              {t("Turning ideas into real, working products. Custom software, web, mobile and business systems — built in Cairo, delivered worldwide.")}
            </p>
            <div className={styles.social}>
              {SOCIAL.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  title={s.label}
                  className={styles.socialBtn}
                >
                  <SocialIcon name={s.label} />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h2 className={styles.colTitle}>{t("Company")}</h2>
            <div className={styles.colLinks}>
              <Link to="/services">{t("Services")}</Link>
              <Link to="/solutions">{t("Solutions")}</Link>
              <Link to="/projects">{t("Projects")}</Link>
              <Link to="/blog">{t("Insights")}</Link>
              <Link to="/about">{t("About")}</Link>
              <Link to="/contact">{t("Contact")}</Link>
            </div>
          </div>

          <div>
            <h2 className={styles.colTitle}>{t("Legal")}</h2>
            <div className={styles.colLinks}>
              <Link to="/legal/privacy-policy">{t("Privacy Policy")}</Link>
              <Link to="/legal/terms-of-service">{t("Terms of Service")}</Link>
              {/* Withdrawing consent must be as easy as granting it, so this
                  sits with the other legal links rather than behind a settings
                  page. A button, not an anchor: it opens the banner, it does
                  not navigate. */}
              <button type="button" onClick={reopenConsent}>
                {t("Cookie settings")}
              </button>
            </div>
          </div>

          <div>
            <h2 className={styles.colTitle}>{t("Get in touch")}</h2>
            <div className={styles.colLinks}>
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer">
                {t("WhatsApp")}
              </a>
              <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
            </div>
          </div>
        </div>

        <div className={styles.bottom}>
          <span className={styles.bottomText}>{copyright(t)}</span>
          <span className={styles.bottomMono}>{t("Ideas into real, working products")}</span>
        </div>
      </div>

      <a
        href={WA_LINK}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("Chat on WhatsApp")} data-track="footer.whatsapp"
        style={{
          position: "fixed",
          insetInlineEnd: 22,
          // Lifts clear of the cookie bar while it is on screen. The variable is
          // unset otherwise, so this is plain 22px the rest of the time.
          bottom: "calc(22px + var(--kf-consent-h, 0px))",
          zIndex: 60,
          width: 58,
          height: 58,
          borderRadius: "50%",
          background: "#25D366",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 10px 30px -6px rgba(37,211,102,.6)",
          animation: "kfFloat 4s ease-in-out infinite",
        }}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff">
          <path d="M12 2a10 10 0 00-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1012 2zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5-4.5-.2-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.7-.1l.9-1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.4.1.2.1.9-.1 1.5z" />
        </svg>
      </a>
    </footer>
  );
}

export { WA_LINK, EMAIL };
