import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { Reveal } from "../components/Reveal";
import s from "../styles/sections.module.css";

/**
 * Any URL that doesn't match a route used to fall through to an empty
 * `<Outlet />`: no nav, no footer, no text — a black screen. Visitors hitting a
 * stale link, and crawlers following one, both got a dead end with a 200 on it.
 *
 * This renders inside the Layout, so the nav and footer still give people a way
 * out, and `PAGES.notFound` marks it `noindex,follow` so the soft-404 isn't
 * indexed but its links are still crawled.
 */
export function NotFound() {
  const { t } = useI18n();

  const links: { to: string; label: string }[] = [
    { to: "/services", label: t("Services") },
    { to: "/solutions", label: t("Solutions") },
    { to: "/projects", label: t("Our Work") },
    { to: "/blog", label: t("Insights") },
    { to: "/contact", label: t("Contact") },
  ];

  return (
    <section className={s.pageHero}>
      <div className={s.pageHeroGlow} aria-hidden="true" />
      <div className={s.pageHeroInner} style={{ maxWidth: 720 }}>
        <Reveal>
          <p
            style={{
              fontFamily: "var(--font-mono, monospace)",
              color: "var(--brand-orange)",
              letterSpacing: "0.12em",
              fontSize: "var(--fs-ui)",
              marginBottom: 18,
            }}
          >
            404
          </p>
          <h1 className={s.pageTitle}>{t("This page doesn't exist.")}</h1>
          <p className={s.pageLede}>
            {t("The link may be out of date, or the address mistyped. Here's where to go instead.")}
          </p>

          <nav
            aria-label={t("Site sections")}
            style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 34 }}
          >
            <Link
              to="/"
              style={{
                padding: "12px 22px",
                borderRadius: 999,
                fontWeight: 600,
                color: "#fff",
                background: "linear-gradient(90deg, var(--brand-orange), var(--brand-pink))",
              }}
            >
              {t("Home")}
            </Link>
            {links.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                style={{
                  padding: "12px 22px",
                  borderRadius: 999,
                  fontWeight: 600,
                  color: "var(--text2)",
                  border: "1px solid var(--border)",
                }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </Reveal>
      </div>
    </section>
  );
}
