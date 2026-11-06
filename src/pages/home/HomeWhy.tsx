import { Link } from "react-router-dom";
import { useI18n } from "../../lib/i18n";
import { Reveal } from "../../components/Reveal";
import s from "../../styles/sections.module.css";
import h from "../Home.module.css";
import { VALUES } from "./data";

/**
 * Who builds it, and what they hold to: the founder's real photo beside the
 * brand book's four values.
 */
export function HomeWhy({ waLink }: { waLink: string }) {
  const { t } = useI18n();
  return (
    <section className={s.section} id="why">
      <div className={h.why}>
        <Reveal className={h.founder}>
          <img
            className={h.founderImg}
            src="/founder.jpg"
            alt={t("Kirollos Fayez, founder of KF Tech Solutions")}
            width={1402}
            height={1122}
            loading="lazy"
            decoding="async"
          />
          <span className={h.founderCaption}>
            <b>{t("Kirollos Fayez")}</b>
            <span>{t("Founder & lead engineer")}</span>
          </span>
        </Reveal>
        <div>
          <Reveal>
            <span className="kf-label">{t("Why KF Tech")}</span>
            <h2 className={s.h2}>{t("We don't just write code. We build products.")}</h2>
            <p className={s.lede}>
              {t("An independent software studio in Cairo. You talk to the people who build your product — from the first call to support after launch.")}
            </p>
          </Reveal>
          <ul className={h.values}>
            {VALUES.map((v, i) => (
              <Reveal as="li" key={v.n} className={h.value} style={{ animationDelay: `${i * 80}ms` }}>
                <span className={h.valueNo}>{v.n}</span>
                <span>
                  <b className={h.valueTitle}>{t(v.title)}</b>
                  <span className={h.valueDesc}>{t(v.desc)}</span>
                </span>
              </Reveal>
            ))}
          </ul>
          <Reveal className={h.whyActions}>
            <Link to="/about" className="btn btn-outline">
              {t("More about us")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
            </Link>
            <a href={waLink} target="_blank" rel="noopener noreferrer" className={s.textLink} data-track="home.about.whatsapp">
              {t("Chat on WhatsApp")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
            </a>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
