import { Link } from "react-router-dom";
import { useI18n } from "../../lib/i18n";
import { HeroStage } from "../../components/HeroStage";
import h from "../Home.module.css";
import { HERO_MARQUEE, HERO_STATS } from "./data";

/**
 * The hero headline, translated.
 *
 * It used to be three hardcoded spans, which is also how the design export
 * wrote it — and why neither the export nor this rebuild ever translated it:
 * the sentence is split across elements, so no single text node matches a
 * dictionary key. An Arabic visitor read an English headline.
 *
 * The dictionary value carries the two things a flat string cannot: `\n` marks
 * the three staggered lines, and `*word*` marks the gradient word. Both differ
 * per language — Arabic and French break the sentence in different places and
 * emphasise a different word — so they belong in the translation, not the JSX.
 *
 * The last line keeps the dimmed treatment; the stagger delays come from the
 * `up` animation, one step per line, exactly as before.
 */
function heroHeadline(t: (key: string) => string) {
  // "Custom software" leads: the h1 is the strongest on-page ranking signal
  // and the old line carried no service keyword at all.
  const lines = t("Custom software built to run on, not to demo well.").split("\n");
  return lines.map((line, i) => (
    <span
      key={line}
      className={`up ${h.heroTitleLine} ${i === lines.length - 1 ? h.heroTitleDim : ""}`}
    >
      {line.split(/\*([^*]+)\*/).map((part, j) =>
        // Odd indices are what sat between the asterisks — the gradient word.
        j % 2 === 1 ? (
          <em key={j} style={{ fontStyle: "normal" }} className="gradient-text">
            {part}
          </em>
        ) : (
          part
        ),
      )}
    </span>
  ));
}

export function HomeHero() {
  const { t } = useI18n();
  return (
    <section className={h.hero} data-hero>
      <HeroStage className={h.heroStage} />
      <div className={h.heroVignette1} aria-hidden="true" />
      <div className={h.heroVignette2} aria-hidden="true" />
      <div className={h.heroScanWrap} aria-hidden="true">
        <span className={h.heroScan} />
      </div>
      <div className={h.heroGrain} aria-hidden="true" />
      <div className={h.heroContent}>
        <div className={`fade ${h.heroKicker}`}>
          <span className={h.heroOpen}>
            <span className={h.heroOpenDot} />
            {t("OPEN FOR WORK")}
          </span>
          <span className={h.heroRule} aria-hidden="true" />
          <span>{t("CAIRO, EG")}</span>
        </div>

        <h1 className={h.heroTitle}>{heroHeadline(t)}</h1>

        <div className={h.heroRow}>
          <p className={`up ${h.heroLede}`}>
            {t(
              "KF Tech Solutions is a software company in Cairo: custom platforms, POS systems, dashboards and AI automation — engineered around how your business actually operates, then supported long after launch.",
            )}
          </p>
          <div className={`up ${h.heroActions}`}>
            <Link to="/contact" data-track="hero.start-project" className="btn btn-primary">
              {t("Start a project")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
            </Link>
            <Link to="/projects" data-track="hero.see-the-work" className={h.heroOutline}>
              {t("See the work")}
            </Link>
          </div>
          <dl className={`up ${h.heroStats}`}>
            {HERO_STATS.map((stat) => (
              <div key={stat.l}>
                <dt className={h.heroStatLabel}>{t(stat.l)}</dt>
                <dd className={h.heroStatValue}>{stat.v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className={h.heroMarquee}>
          {HERO_MARQUEE.map((m) => (
            <span key={m}>{t(m)}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
