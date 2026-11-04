import { Link } from "react-router-dom";
import { useI18n } from "../../lib/i18n";
import h from "../Home.module.css";
import { HomeShowreel } from "./HomeShowreel";

/**
 * The hero headline, translated. The dictionary value carries `\n` for the
 * line breaks and `*word*` for the gradient words, because both differ per
 * language. "Custom software" leads: the h1 is the strongest on-page ranking
 * signal for the service.
 */
function heroHeadline(t: (key: string) => string) {
  const lines = t("Custom software,\nfrom idea to *working product.*").split("\n");
  return lines.map((line, i) => (
    <span key={line} className={h.heroLine} style={{ animationDelay: `${80 + i * 90}ms` }}>
      {line.split(/\*([^*]+)\*/).map((part, j) =>
        j % 2 === 1 ? (
          <em key={j} className="gradient-text">
            {part}
          </em>
        ) : (
          part
        ),
      )}
    </span>
  ));
}

/**
 * The hero: the claim, one line of what we build and two actions on one side,
 * and the showreel of real client products on the other. Deliberately short —
 * the promises and numbers that used to crowd it live further down the page.
 */
export function HomeHero() {
  const { t } = useI18n();
  return (
    <section className={h.hero} data-hero>
      <div className={h.heroGlowClip} aria-hidden="true">
        <div className={h.heroGlow} />
      </div>
      <div className={h.heroInner}>
        <div className={h.heroCopy}>
          <span className={`kf-label ${h.heroKicker}`}>
            <span className="kf-dot" aria-hidden="true" />
            {t("OPEN FOR NEW PROJECTS")} <span aria-hidden="true">—</span> {t("CAIRO, EG")}
          </span>
          <h1 className={h.heroTitle}>{heroHeadline(t)}</h1>
          <p className={h.heroLede}>
            {t("Websites, admin dashboards, iOS & Android apps and business systems — built around how your business actually runs, and supported after launch.")}
          </p>
          <div className={h.heroActions}>
            <Link to="/contact" data-track="hero.start-project" className="btn btn-primary">
              {t("Start a project")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
            </Link>
            <Link to="/projects" data-track="hero.see-the-work" className="btn btn-outline">
              {t("See the work")}
            </Link>
          </div>
        </div>

        <HomeShowreel />
      </div>

    </section>
  );
}
