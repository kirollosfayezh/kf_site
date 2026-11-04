import { Link } from "react-router-dom";
import { useI18n } from "../../lib/i18n";
import { pick } from "../../lib/content-helpers";
import { FALLBACK_SOLUTIONS } from "../../lib/fallback-content";
import { Reveal } from "../../components/Reveal";
import s from "../../styles/sections.module.css";
import h from "../Home.module.css";
import type { ContentItem } from "../../services/api-types";

/** The industries, as a short row of links — the detail lives on /solutions. */
export function HomeSolutions({ solutions }: { solutions: ContentItem[] | null }) {
  const { t, lang } = useI18n();
  const items =
    solutions && solutions.length > 0
      ? solutions.map((item) => ({ key: item.id, title: pick(item.title, lang), desc: pick(item.summary, lang) }))
      : FALLBACK_SOLUTIONS.map((f) => ({ key: f.key, title: t(f.title), desc: t(f.desc) }));
  return (
    <section className={s.section} id="industries">
      <Reveal className={h.industries}>
        <div className={s.headText}>
          <span className="kf-label">{t("Industries")}</span>
          <h2 className={s.h2sm}>{t("Technology built around your business.")}</h2>
          <Link to="/solutions" className={s.viewAll} style={{ marginTop: 18 }}>
            {t("View all solutions")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
          </Link>
        </div>
        <ul className={h.industryList}>
          {items.map((item) => (
            <li key={item.key}>
              <Link to="/solutions" className={h.industry}>
                <b>{item.title}</b>
                <span>{item.desc}</span>
                <span className="kf-arrow" aria-hidden="true">&rarr;</span>
              </Link>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
