import { Link } from "react-router-dom";
import { useI18n } from "../../lib/i18n";
import h from "../Home.module.css";
import { HERO_CODE, HERO_MARQUEE, HERO_STATS } from "./data";

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
 * The brand book's website hero (KF/brand, apps.mjs `websiteHero`): Ink stage
 * with a faint grid and one warm glow, the claim on the left, and a code card
 * on the right that describes a real kind of project instead of a stock photo.
 * Everything here is CSS: no canvas, no WebGL, nothing to download or compile.
 */
export function HomeHero() {
  const { t } = useI18n();
  return (
    <section className={h.hero} data-hero>
      <div className={h.heroGrid} aria-hidden="true" />
      <div className={h.heroGlow} aria-hidden="true" />
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
          <ul className={h.heroPromises}>
            {["Fixed quote before we start", "Working demo first", "Direct line to the developer"].map((p) => (
              <li key={p}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {t(p)}
              </li>
            ))}
          </ul>
        </div>

        {/* The code card: written in the site's own stack, typed in line by
            line. Code reads the same in every language, so it stays LTR. */}
        <div className={h.codeCard} aria-hidden="true">
          <div className={h.codeBar}>
            <i />
            <i />
            <i />
            <span>project.ts</span>
          </div>
          <pre className={h.code} dir="ltr">
            {HERO_CODE.map((line, i) => (
              <span key={i} className={h.codeLine} style={{ animationDelay: `${600 + i * 170}ms` }}>
                {line.map(([cls, text], j) => (
                  <span key={j} className={cls ? h[cls] : undefined}>
                    {text}
                  </span>
                ))}
              </span>
            ))}
            <span className={h.caret} style={{ animationDelay: `${600 + HERO_CODE.length * 170}ms` }} />
          </pre>
          <dl className={h.codeStats}>
            {HERO_STATS.map((stat) => (
              <div key={stat.l}>
                <dd>{stat.v}</dd>
                <dt>{t(stat.l)}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className={h.marquee} aria-hidden="true">
        <div className={h.marqueeTrack}>
          {[...HERO_MARQUEE, ...HERO_MARQUEE].map((m, i) => (
            <span key={i}>
              {t(m)}
              <i />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
