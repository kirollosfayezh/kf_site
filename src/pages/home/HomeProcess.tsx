import { useI18n } from "../../lib/i18n";
import { Reveal } from "../../components/Reveal";
import s from "../../styles/sections.module.css";
import h from "../Home.module.css";
import { STEPS } from "./data";

/** Five written stages. The line between them fills in as the row reveals. */
export function HomeProcess() {
  const { t } = useI18n();
  return (
    <section className={s.section} id="process">
      <Reveal className={s.head}>
        <div className={s.headText}>
          <span className="kf-label">{t("How we work")}</span>
          <h2 className={s.h2}>{t("Clear stages. Written prices. No surprises.")}</h2>
        </div>
      </Reveal>
      <Reveal as="ol" className={h.steps}>
        {STEPS.map((step, i) => (
          <li key={step.n} className={h.step} style={{ animationDelay: `${i * 110}ms` }}>
            <span className={h.stepNo}>{step.n}</span>
            <h3 className={h.stepTitle}>{t(step.title)}</h3>
            <p className={h.stepDesc}>{t(step.desc)}</p>
          </li>
        ))}
      </Reveal>
    </section>
  );
}
