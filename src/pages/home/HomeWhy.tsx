import { useI18n } from "../../lib/i18n";
import { Reveal } from "../../components/Reveal";
import { BalancedGrid } from "../../components/BalancedGrid";
import s from "../../styles/sections.module.css";
import { WHY } from "./data";

/** Why work with the studio: six short reasons. */
export function HomeWhy() {
  const { t } = useI18n();
  return (
    <section className={s.section}>
      <Reveal style={{ maxWidth: 640 }}>
        <span className={s.eyebrow}>{t("// WHY KF TECH")}</span>
        <h2 className={s.h2sm}>{t("A partner, not just a developer.")}</h2>
      </Reveal>
      <BalancedGrid preset="cards">
        {WHY.map((w) => (
          <Reveal key={w.title} className={s.whyCard}>
            <span className={s.whyIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-orange)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            <div>
              <h3 className={s.whyTitle}>{t(w.title)}</h3>
              <p className={s.whyDesc}>{t(w.desc)}</p>
            </div>
          </Reveal>
        ))}
      </BalancedGrid>
    </section>
  );
}
