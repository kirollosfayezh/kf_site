import { useEffect, useState, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { LANG_META, useI18n } from "../lib/i18n";
import { FlagIcon } from "./FlagIcon";
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

export function Nav() {
  const { t, lang, setLang, available } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  /**
   * Watches a sentinel at the top of the document instead of listening for
   * scroll events.
   *
   * Lenis moves the page programmatically and emits no native `scroll` event
   * while it is driving, so a `window.addEventListener("scroll", ...)` here
   * never fired: `scrolled` stayed false for the whole session and the bar kept
   * the transparent state, where the design export shows a blurred translucent
   * bar with a bottom border once the page moves.
   *
   * An IntersectionObserver is indifferent to how the page got scrolled, so it
   * works whether Lenis is driving or — under `prefers-reduced-motion`, where
   * Lenis never starts — the browser is. It also costs nothing per frame.
   */
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => setLangOpen(false), [location.pathname]);

  /**
   * A dropdown that only closes by clicking its own trigger again is the main
   * reason this one felt unfinished — every stray click left it hanging over
   * the page. Pointerdown rather than click so it closes on press, and capture
   * so a click on a link underneath still dismisses it.
   */
  useEffect(() => {
    if (!langOpen) return;
    const onPointer = (e: PointerEvent) => {
      if (!langRef.current?.contains(e.target as Node)) setLangOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLangOpen(false);
        langRef.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [langOpen]);

  const current = LANG_META[lang];

  return (
    <>
      {/* Sits at the very top of the document; once it leaves the viewport the
          page has been scrolled. See the observer above for why this replaces a
          scroll listener. 41px matches the old `scrollY > 40` threshold. */}
      <div
        ref={sentinelRef}
        aria-hidden="true"
        style={{ position: "absolute", top: 0, insetInlineStart: 0, width: 1, height: 41, pointerEvents: "none" }}
      />
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
            <div className={styles.langWrap} ref={langRef}>
              <button
                type="button"
                className={styles.langBtn}
                aria-label={`${t("Change language")} — ${current.label}`}
                aria-haspopup="menu"
                aria-expanded={langOpen}
                onClick={() => setLangOpen((o) => !o)}
              >
                <FlagIcon lang={lang} size={20} />
                <span className={styles.langCode}>{current.short}</span>
                <svg
                  className={`${styles.langChevron} ${langOpen ? styles.langChevronOpen : ""}`}
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {langOpen && (
                <div role="menu" aria-label={t("Language")} className={styles.langMenu}>
                  {available.map((code) => (
                    <button
                      key={code}
                      type="button"
                      role="menuitemradio"
                      aria-checked={code === lang}
                      lang={code}
                      className={`${styles.langItem} ${code === lang ? styles.langItemActive : ""}`}
                      onClick={() => {
                        setLang(code);
                        setLangOpen(false);
                      }}
                    >
                      <FlagIcon lang={code} size={22} />
                      <span className={styles.langLabel}>{LANG_META[code].label}</span>
                      <span className={styles.langShort}>{LANG_META[code].short}</span>
                      {code === lang ? (
                        <svg
                          className={styles.langCheck}
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button type="button" className={styles.iconBtn} aria-label={t("Toggle light and dark theme")} onClick={toggleTheme}>
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

            <Link to="/contact" data-track="nav.lets-build" className={`${styles.cta} kf-desktop-nav`}>
              {t("Let's Build")} <span aria-hidden="true">&rarr;</span>
            </Link>

            <button
              type="button"
              aria-label={t("Open menu")}
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

      <div role="dialog" aria-label={t("Menu")} className={`${styles.mobileMenu} ${menuOpen ? styles.mobileMenuOpen : styles.mobileMenuClosed}`}>
        <div className={styles.mobileTop}>
          <span className={styles.mobileTitle}>{t("Menu")}</span>
          <button type="button" aria-label={t("Close menu")} className={styles.iconBtn} onClick={() => setMenuOpen(false)}>
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
          <Link to="/contact" data-track="nav.lets-build-mobile" className={styles.mobileCta} onClick={() => setMenuOpen(false)}>
            {t("Let's Build")} <span aria-hidden="true">&rarr;</span>
          </Link>
        </nav>
      </div>
    </>
  );
}
