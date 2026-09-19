import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import styles from "./Footer.module.css";

const WA_LINK =
  "https://wa.me/201500099671?text=" + encodeURIComponent("Hi KF Tech Solutions, I'd like to discuss a software project.");
const EMAIL = "kirollos.fayez.h@gmail.com";

const SOCIAL = [
  { label: "Facebook", href: "https://www.facebook.com/profile.php?id=61584985085435" },
  { label: "Instagram", href: "#" },
  { label: "TikTok", href: "#" },
  { label: "LinkedIn", href: "https://linkedin.com/in/kirollos-fayez-65a33931a" },
  { label: "GitHub", href: "https://github.com/koko619911" },
];

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
                <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label} className={styles.socialBtn}>
                  {s.label[0]}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h2 className={styles.colTitle}>Company</h2>
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
            <h2 className={styles.colTitle}>Legal</h2>
            <div className={styles.colLinks}>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
            </div>
          </div>

          <div>
            <h2 className={styles.colTitle}>Get in touch</h2>
            <div className={styles.colLinks}>
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer">
                WhatsApp
              </a>
              <a href={`mailto:${EMAIL}`}>{EMAIL}</a>
            </div>
          </div>
        </div>

        <div className={styles.bottom}>
          <span className={styles.bottomText}>&copy; {new Date().getFullYear()} KF Tech Solutions. All rights reserved.</span>
          <span className={styles.bottomMono}>{t("Ideas into real, working products")}</span>
        </div>
      </div>

      <a
        href={WA_LINK}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp" data-track="footer.whatsapp"
        style={{
          position: "fixed",
          insetInlineEnd: 22,
          bottom: 22,
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
