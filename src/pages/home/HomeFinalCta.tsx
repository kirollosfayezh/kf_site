import { Link } from "react-router-dom";
import { useI18n } from "../../lib/i18n";
import { Reveal } from "../../components/Reveal";
import s from "../../styles/sections.module.css";

/** The closing call to action. */
export function HomeFinalCta({ waLink }: { waLink: string }) {
  const { t } = useI18n();
  return (
    <section className={s.finalCta}>
      <div className={s.finalCtaGlow} aria-hidden="true" />
      <Reveal className={s.finalCtaInner}>
        <h2 className={s.finalCtaTitle}>
          {t("Have an idea?")}
          <br />
          <span className="gradient-text">{t("Let's build it.")}</span>
        </h2>
        <p className={s.finalCtaLede}>{t("Tell us what you're trying to build and we'll help turn the idea into a real, working product.")}</p>
        <div className={s.finalCtaActions}>
          <Link to="/contact" className="btn btn-primary" data-track="home.final.start-project">
            {t("Start Your Project")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
          </Link>
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline" data-track="home.final.whatsapp">
            {t("WhatsApp Us")}
          </a>
        </div>
      </Reveal>
    </section>
  );
}
