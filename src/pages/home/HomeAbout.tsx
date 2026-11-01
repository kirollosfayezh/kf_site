import { Link } from "react-router-dom";
import { useI18n } from "../../lib/i18n";
import { Reveal } from "../../components/Reveal";
import s from "../../styles/sections.module.css";
import h from "../Home.module.css";

/** About teaser with the WhatsApp call to action. */
export function HomeAbout({ waLink }: { waLink: string }) {
  const { t } = useI18n();
  return (
    <section className={s.sectionAlt}>
      <div className={h.aboutTeaser}>
        <Reveal className={h.aboutImgWrap}>
          <div className={h.aboutImgGlow} aria-hidden="true" />
          <img
            className={h.aboutImg}
            src="/founder.jpg"
            alt={t("Kirollos Fayez, founder of KF Tech Solutions")}
            width={1402}
            height={1122}
            loading="lazy"
            decoding="async"
          />
        </Reveal>
        <Reveal>
          <span className={s.eyebrowPink}>{t("// ABOUT")}</span>
          <h2 className={s.h2sm}>{t("We don't just write code. We build products.")}</h2>
          <p className={s.lede} style={{ maxWidth: "none" }}>
            {t(
              "KF Tech Solutions is a software studio that partners with businesses to turn ideas into working products — from understanding the problem to engineering the system and supporting it after launch.",
            )}
          </p>
          <div style={{ display: "flex", gap: 14, marginTop: 28, flexWrap: "wrap" }}>
            <Link to="/about" className="btn btn-primary">
              {t("More about us")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
            </Link>
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline" data-track="home.about.whatsapp">
              {t("Chat on WhatsApp")}
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
