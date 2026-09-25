import { Link } from "react-router-dom";
import { reopenConsent } from "../lib/pixels";
import { useI18n } from "../lib/i18n";
import { useContactInfo, useSettings } from "../lib/settings";
import { resolveSocial, type SocialKey } from "../lib/contact";
import { useWhatsAppLink } from "../hooks/useWhatsAppLink";
import { SocialIcon, type SocialName } from "./SocialIcon";
import { NewsletterForm } from "./NewsletterForm";
import styles from "./Footer.module.css";

/** Settings keys → the icon set's names. */
const ICON: Record<SocialKey, SocialName> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X",
  github: "GitHub",
  youtube: "YouTube",
  tiktok: "TikTok",
};

/**
 * The dictionary keys the whole copyright line, year included, because that is
 * the exact string the design export translated. Keeping the year dynamic and
 * substituting it into the translated string gives both: a correct year and a
 * translated line. An untranslated year still falls back to the English key.
 */
const COPYRIGHT_KEY = "© 2026 KF Tech Solutions. All rights reserved.";

function copyright(t: (k: string) => string): string {
  return t(COPYRIGHT_KEY).replace("2026", String(new Date().getFullYear()));
}

/**
 * Contact details and profiles come from Site settings (with the launch
 * values as defaults), so the dashboard's Contact card actually does what it
 * says. Only profiles that exist are listed: a link that looks live and goes
 * nowhere is worse than an absent one, and it costs trust on the page where
 * people check you are real.
 */
export function Footer() {
  const { t } = useI18n();
  const settings = useSettings();
  const { email } = useContactInfo();
  const waLink = useWhatsAppLink();
  const social = resolveSocial(settings?.social);

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
              {social.map((s) => (
                <a
                  key={s.key}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={ICON[s.key]}
                  title={ICON[s.key]}
                  data-track={`footer.social.${s.key}`}
                  className={styles.socialBtn}
                >
                  <SocialIcon name={ICON[s.key]} />
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
              <Link to="/book">{t("Book a call")}</Link>
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
              <a href={waLink} target="_blank" rel="noopener noreferrer" data-track="footer.links.whatsapp">
                {t("WhatsApp")}
              </a>
              <a href={`mailto:${email}`} data-track="footer.links.email">{email}</a>
            </div>
          </div>
        </div>

        <div className={styles.newsletter}>
          <h2 className={styles.colTitle}>{t("Newsletter")}</h2>
          <p className={styles.desc}>
            {t("Occasional notes on software, automation and running a better business. No spam.")}
          </p>
          <NewsletterForm source="footer" compact />
        </div>

        <div className={styles.bottom}>
          <span className={styles.bottomText}>{copyright(t)}</span>
          <span className={styles.bottomMono}>{t("Ideas into real, working products")}</span>
        </div>
      </div>

      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("Chat on WhatsApp")}
        data-track="footer.whatsapp"
        className={styles.waFab}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
          <path d="M12 2a10 10 0 00-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1012 2zm5.8 14.2c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5-4.5-.2-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.4c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.7-.1l.9-1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.5.4.1.2.1.9-.1 1.5z" />
        </svg>
      </a>
    </footer>
  );
}
