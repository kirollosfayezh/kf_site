import { Link } from "react-router-dom";
import { useI18n } from "../../lib/i18n";
import { Reveal } from "../../components/Reveal";
import { useContactInfo } from "../../lib/settings";
import h from "../Home.module.css";

export function HomeFinalCta({ waLink }: { waLink: string }) {
  const { t } = useI18n();
  const site = useContactInfo();
  return (
    <section className={h.cta}>
      <Reveal className={h.ctaPanel}>
        <div className={h.heroGrid} aria-hidden="true" />
        <div className={h.ctaGlow} aria-hidden="true" />
        <span className="kf-label">{t("Start a project")}</span>
        <h2 className={h.ctaTitle}>
          {t("Have an idea?")} <span className="gradient-text">{t("Let's build it.")}</span>
        </h2>
        <p className={h.ctaLede}>{t("Tell us what you're trying to build and we'll help turn the idea into a real, working product.")}</p>
        <div className={h.ctaActions}>
          <Link to="/contact" className="btn btn-primary" data-track="home.final.start-project">
            {t("Start Your Project")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
          </Link>
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline" data-track="home.final.whatsapp">
            {t("WhatsApp Us")}
          </a>
        </div>
        <p className={h.ctaContact} dir="ltr">
          <a href={`mailto:${site.email}`}>{site.email}</a>
          <span aria-hidden="true">·</span>
          <a href={`tel:${site.phone.replace(/[^+\d]/g, "")}`}>{site.phone.replace(/-/g, " ")}</a>
        </p>
      </Reveal>
    </section>
  );
}
