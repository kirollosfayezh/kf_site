import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { LANG_META, useI18n, type Lang } from "../lib/i18n";
import { localePath } from "../lib/seo";
import { useTheme } from "../lib/theme";
import { pick } from "../lib/content-helpers";
import { useContentList } from "../hooks/useContent";
import { FALLBACK_PROJECTS, FALLBACK_SERVICES, FALLBACK_SOLUTIONS } from "../lib/fallback-content";
import { FlagIcon } from "./FlagIcon";
import { useWhatsAppLink } from "../hooks/useWhatsAppLink";
import styles from "./MobileMenu.module.css";

interface Leaf {
  key: string;
  label: string;
  href: string;
}

interface Branch {
  id: string;
  label: string;
  href: string;
  /** Present on the three sections that have their own list of pages. */
  children?: Leaf[];
}

/**
 * The phone navigation: a drawer with the site as a tree.
 *
 * It used to be a flat list of seven huge links on a full-screen sheet, with
 * the language and theme controls crowding the app bar above it. Services,
 * Solutions and Projects now open into their own items — every project links
 * straight to its case study — and each branch collapses again, so the tree
 * stays short however much is published. Language and theme live at the
 * bottom of the drawer, which is what lets the app bar shrink to the logo and
 * one button.
 */
export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang, setLang, available } = useI18n();
  const waLink = useWhatsAppLink();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const closeRef = useRef<HTMLButtonElement>(null);

  const services = useContentList("services");
  const solutions = useContentList("solutions");
  const projects = useContentList("projects");

  const tree = useMemo<Branch[]>(() => {
    const serviceLeaves: Leaf[] =
      services.data && services.data.length > 0
        ? services.data.map((s) => ({ key: s.id, label: pick(s.title, lang), href: `/services/${s.slug || s.id}` }))
        : FALLBACK_SERVICES.map((f) => ({ key: f.key, label: t(f.title), href: `/services/${f.slug ?? f.key}` }));

    const solutionLeaves: Leaf[] =
      solutions.data && solutions.data.length > 0
        ? solutions.data.map((s) => ({ key: s.id, label: pick(s.title, lang), href: `/solutions#${s.slug || s.id}` }))
        : FALLBACK_SOLUTIONS.map((f) => ({ key: f.key, label: t(f.title), href: `/solutions#${f.slug ?? f.key}` }));

    // The static fallback projects have no case-study page, so they point at
    // the gallery rather than at a URL that would 404.
    const projectLeaves: Leaf[] =
      projects.data && projects.data.length > 0
        ? projects.data.map((p) => ({ key: p.id, label: pick(p.title, lang), href: `/projects/${p.slug || p.id}` }))
        : FALLBACK_PROJECTS.map((f) => ({ key: f.key, label: t(f.title), href: "/projects" }));

    return [
      { id: "home", label: t("Home"), href: "/" },
      { id: "services", label: t("Services"), href: "/services", children: serviceLeaves },
      { id: "solutions", label: t("Solutions"), href: "/solutions", children: solutionLeaves },
      { id: "projects", label: t("Projects"), href: "/projects", children: projectLeaves },
      { id: "blog", label: t("Insights"), href: "/blog" },
      { id: "about", label: t("About"), href: "/about" },
      { id: "contact", label: t("Contact"), href: "/contact" },
    ];
  }, [services.data, solutions.data, projects.data, lang, t]);

  /** The branch the visitor is currently inside — it opens by itself. */
  const activeBranch = useMemo(() => {
    const first = "/" + (location.pathname.split("/").filter(Boolean)[0] ?? "");
    return tree.find((b) => b.children && b.href === first)?.id ?? null;
  }, [tree, location.pathname]);

  // Projects starts open: it is the branch people come to the menu for.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["projects"]));
  useEffect(() => {
    if (activeBranch) setExpanded((cur) => (cur.has(activeBranch) ? cur : new Set(cur).add(activeBranch)));
  }, [activeBranch]);

  const toggle = (id: string) =>
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Page scroll is locked while the drawer is open, Escape closes it, and
  // focus moves into it so a keyboard or screen-reader user lands inside.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // The hash is read after mount: the build-time render has none, and this
  // drawer is always in the tree, so a `#slug` deep link would otherwise make
  // the first client render disagree with the HTML for one `aria-current`.
  const [hash, setHash] = useState("");
  useEffect(() => setHash(location.hash), [location.hash]);

  const isCurrent = (href: string) => {
    const [path, target] = href.split("#");
    if (target) return location.pathname === path && hash === `#${target}`;
    return location.pathname === path;
  };

  // The chips are real links (a full navigation, as in the header switcher:
  // the language prefix is the router's `basename`, which is only read at
  // startup); the click handler just records the choice.
  function chooseLang(code: Lang) {
    if (code !== lang) setLang(code);
  }

  return (
    <>
      <div
        className={`${styles.backdrop} ${open ? styles.backdropOpen : ""}`}
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("Menu")}
        aria-hidden={!open}
        inert={!open}
        data-lenis-prevent
        className={`${styles.drawer} ${open ? styles.drawerOpen : ""}`}
      >
        <div className={styles.top}>
          <Link to="/" className={styles.brand} onClick={onClose}>
            <img src="/logo-icon.png" alt="" width={32} height={32} className={styles.logo} decoding="async" />
            <span className={styles.brandTitle}>KF Tech Solutions</span>
          </Link>
          <button ref={closeRef} type="button" aria-label={t("Close menu")} className={styles.close} onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <nav aria-label={t("Mobile navigation")} className={styles.body}>
          <ul className={styles.tree} role="list">
            {tree.map((branch) => {
              const isOpen = !!branch.children && expanded.has(branch.id);
              const here = isCurrent(branch.href) || activeBranch === branch.id;
              const listId = `mm-${branch.id}`;
              return (
                <li key={branch.id} className={styles.branch}>
                  <div className={`${styles.row} ${here ? styles.rowActive : ""}`}>
                    <Link
                      to={branch.href}
                      className={styles.rowLink}
                      aria-current={isCurrent(branch.href) ? "page" : undefined}
                      onClick={onClose}
                    >
                      {branch.label}
                      {branch.children && branch.children.length > 0 && (
                        <span className={styles.count}>{branch.children.length}</span>
                      )}
                    </Link>
                    {branch.children && branch.children.length > 0 && (
                      <button
                        type="button"
                        className={styles.toggle}
                        aria-expanded={isOpen}
                        aria-controls={listId}
                        aria-label={`${isOpen ? t("Collapse") : t("Expand")} ${branch.label}`}
                        onClick={() => toggle(branch.id)}
                      >
                        <svg
                          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
                          width="16"
                          height="16"
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
                    )}
                  </div>

                  {branch.children && branch.children.length > 0 && (
                    <div className={`${styles.leavesWrap} ${isOpen ? styles.leavesWrapOpen : ""}`}>
                      <ul id={listId} className={styles.leaves} role="list">
                        {branch.children.map((leaf) => (
                          <li key={leaf.key}>
                            <Link
                              to={leaf.href}
                              tabIndex={isOpen ? undefined : -1}
                              className={`${styles.leaf} ${isCurrent(leaf.href) ? styles.leafActive : ""}`}
                              aria-current={isCurrent(leaf.href) ? "page" : undefined}
                              onClick={onClose}
                            >
                              {leaf.label}
                            </Link>
                          </li>
                        ))}
                        <li>
                          <Link
                            to={branch.href}
                            tabIndex={isOpen ? undefined : -1}
                            className={`${styles.leaf} ${styles.leafAll}`}
                            onClick={onClose}
                          >
                            {t("View all")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
                          </Link>
                        </li>
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        <div className={styles.footer}>
          {available.length > 1 && (
            <div className={styles.group}>
              <span className={styles.groupLabel}>{t("Language")}</span>
              <div className={styles.langs} role="radiogroup" aria-label={t("Language")}>
                {available.map((code) => (
                  <a
                    key={code}
                    href={localePath(code, location.pathname)}
                    hrefLang={code}
                    role="radio"
                    aria-checked={code === lang}
                    lang={code}
                    className={`${styles.langChip} ${code === lang ? styles.langChipOn : ""}`}
                    onClick={() => chooseLang(code)}
                  >
                    <FlagIcon lang={code} size={18} />
                    <span>{LANG_META[code].short}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <button type="button" className={styles.themeRow} onClick={toggleTheme}>
            <span className={styles.groupLabel}>{t("Theme")}</span>
            <span className={styles.themeValue}>
              {theme === "dark" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              )}
              {theme === "dark" ? t("Dark") : t("Light")}
            </span>
          </button>

          <div className={styles.ctas}>
            <Link to="/contact" data-track="nav.lets-build-mobile" className={styles.cta} onClick={onClose}>
              {t("Let's Build")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
            </Link>
            <a href={waLink} target="_blank" rel="noopener noreferrer" className={styles.wa} aria-label={t("Chat on WhatsApp")} data-track="nav.mobile.whatsapp">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.2-3.58.93.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.46 9.48-9.46 2.53 0 4.9.99 6.7 2.78a9.4 9.4 0 0 1 2.77 6.7c0 5.22-4.25 9.46-9.47 9.46zm8.06-17.52A11.32 11.32 0 0 0 12.04.64C5.76.64.64 5.75.64 12.03c0 2 .52 3.97 1.52 5.7L.54 23.64l6.05-1.59a11.4 11.4 0 0 0 5.44 1.39h.01c6.28 0 11.4-5.11 11.4-11.4 0-3.04-1.19-5.9-3.34-8.06z" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
