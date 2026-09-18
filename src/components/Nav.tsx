import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme";
import styles from "./Nav.module.css";

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "Services", href: "/services" },
  { label: "Solutions", href: "/solutions" },
  { label: "Projects", href: "/projects" },
  { label: "Insights", href: "/blog" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

const LANGS: { code: "en" | "ar"; short: string; label: string }[] = [
  { code: "en", short: "EN", label: "English" },
  { code: "ar", short: "AR", label: "العربية" },
];

export function Nav() {
  const { t, lang, setLang } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  // Lenis drives the scroll frame by frame, so this listener fires at display
  // rate. Reading `window.scrollY` straight from the handler forced a layout
  // flush on every one of those frames; coalescing into a single rAF means at
  // most one read per painted frame, and React bails out of the re-render
  // whenever the boolean has not actually flipped.
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      setScrolled(window.scrollY > 40);
    };
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname]);

  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  return (
    <>
      <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ""}`}>
        <div className={styles.inner}>
          <Link to="/" className={styles.brand} aria-label="KF Tech Solutions home">
            {/* The original export's mark: a gradient code-window glyph, not
                the letters "KF". Eager + fixed size — it is above the fold. */}
            <img src="/logo-icon.png" alt="" width={40} height={40} className={styles.logo} decoding="async" />
            <span className={styles.brandText}>
              <span className={styles.brandTitle}>KF Tech Solutions</span>
              <span className={styles.brandSub}>{t("Ideas into real, working products")}</span>
            </span>
          </Link>

          <nav aria-label="Primary" className={`${styles.navLinks} kf-desktop-nav`}>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={`${styles.navLink} ${location.pathname === item.href ? styles.navLinkActive : ""}`}
              >
                {t(item.label)}
              </Link>
            ))}
          </nav>

          <div className={styles.actions}>
            <div className={styles.langWrap}>
              <button
                type="button"
                className={styles.langBtn}
                aria-label="Change language"
                aria-expanded={langOpen}
                onClick={() => setLangOpen((o) => !o)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M2 12h20" />
                  <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
                <span className={styles.langCode}>{current.short}</span>
              </button>
              {langOpen && (
                <div role="menu" aria-label="Language" className={styles.langMenu}>
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      role="menuitem"
                      className={`${styles.langItem} ${l.code === lang ? styles.langItemActive : ""}`}
                      onClick={() => {
                        setLang(l.code);
                        setLangOpen(false);
                      }}
                    >
                      <span className={styles.langShort}>{l.short}</span>
                      <span className={styles.langLabel}>{l.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button type="button" className={styles.iconBtn} aria-label="Toggle light and dark theme" onClick={toggleTheme}>
              {theme === "dark" ? (
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
                </svg>
              )}
            </button>

            <Link to="/contact" className={`${styles.cta} kf-desktop-nav`}>
              {t("Let's Build")} <span aria-hidden="true">&rarr;</span>
            </Link>

            <button
              type="button"
              aria-label="Open menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className={`${styles.iconBtn} kf-mobile-btn`}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <div role="dialog" aria-label="Menu" className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : styles.mobileMenuClosed}`}>
        <div className={styles.mobileTop}>
          <span className={styles.mobileTitle}>{t("Menu")}</span>
          <button type="button" aria-label="Close menu" className={styles.iconBtn} onClick={() => setMenuOpen(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <nav aria-label="Mobile" className={styles.mobileNav}>
          {NAV_ITEMS.map((item) => (
            <Link key={item.href} to={item.href} className={styles.mobileLink} onClick={() => setMenuOpen(false)}>
              {t(item.label)}
            </Link>
          ))}
          <Link to="/contact" className={styles.mobileCta} onClick={() => setMenuOpen(false)}>
            {t("Let's Build")} <span aria-hidden="true">&rarr;</span>
          </Link>
        </nav>
      </div>
    </>
  );
}
