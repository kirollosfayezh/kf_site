import { useI18n } from "../../lib/i18n";
import { Reveal } from "../../components/Reveal";
import s from "../../styles/sections.module.css";
import h from "../Home.module.css";
import { VALUES } from "./data";

/** The four-value trust strip under the hero. */
export function HomeValues() {
  const { t } = useI18n();
  return (
    <section className={s.sectionAlt}>
      <div className={`container ${h.valueStrip}`}>
        {VALUES.map((v) => (
          <Reveal key={v.title} className={s.valueCard}>
            <div className={`${s.valueTitle} gradient-text`}>{t(v.title)}</div>
            <p className={s.cardDesc}>{t(v.desc)}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
