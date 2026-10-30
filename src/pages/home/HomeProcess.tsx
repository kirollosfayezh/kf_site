import { useI18n } from "../../lib/i18n";
import { Reveal } from "../../components/Reveal";
import { BalancedGrid } from "../../components/BalancedGrid";
import s from "../../styles/sections.module.css";
import { STEPS } from "./data";

/** The five-step delivery process. */
export function HomeProcess() {
  const { t } = useI18n();
  return (
    <section className={s.sectionAlt}>
      <div className={s.section}>
        <Reveal style={{ maxWidth: 640 }}>
          <span className={s.eyebrowPink}>{t("// PROCESS")}</span>
          <h2 className={s.h2}>{t("From idea to launch.")}</h2>
        </Reveal>
        <BalancedGrid preset="steps">
          {STEPS.map((st) => (
            <Reveal key={st.n}>
              <div className={s.stepBar} />
              <div className={s.stepNum}>{st.n}</div>
              <h3 className={s.stepTitle}>{t(st.title)}</h3>
              <p className={s.stepDesc}>{t(st.desc)}</p>
            </Reveal>
          ))}
        </BalancedGrid>
      </div>
    </section>
  );
}
