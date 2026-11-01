import { Link } from "react-router-dom";
import { useI18n } from "../../lib/i18n";
import { pick } from "../../lib/content-helpers";
import { FALLBACK_SERVICES } from "../../lib/fallback-content";
import { Reveal } from "../../components/Reveal";
import { BalancedGrid } from "../../components/BalancedGrid";
import { Img } from "../../components/Img";
import s from "../../styles/sections.module.css";
import type { ContentItem } from "../../services/api-types";

/** First eight CMS services, or the built-in list until the CMS has any. */
export function HomeServices({ services }: { services: ContentItem[] | null }) {
  const { t, lang } = useI18n();
  return (
    <section className={s.section}>
      <Reveal className={s.head}>
        <div style={{ maxWidth: 640 }}>
          <span className={s.eyebrow}>// {t("SERVICES") || "SERVICES"}</span>
          <h2 className={s.h2}>{t("Everything you need to build digital.")}</h2>
        </div>
        <Link to="/services" className={s.viewAll}>
          {t("View all services")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
        </Link>
      </Reveal>
      <BalancedGrid preset="cards">
        {(services && services.length > 0
          ? services.slice(0, 8).map((item) => ({
              key: item.id,
              title: pick(item.title, lang),
              desc: pick(item.summary, lang),
              media: item.media?.[0],
              href: `/services/${item.slug || item.id}`,
            }))
          : FALLBACK_SERVICES.map((f) => ({ key: f.key, title: t(f.title), desc: t(f.desc), media: f.img, href: `/services/${f.slug ?? f.key}` }))
        ).map((item) => (
          <Link key={item.key} to={item.href} className={s.card}>
            <Reveal>
              <div className={s.cardMedia}>
                {item.media ? <Img src={item.media} alt={item.title} width={420} sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 420px" /> : <div className={s.cardMediaFallback}>{item.title[0]}</div>}
              </div>
              <div className={s.cardBody}>
                <h3 className={s.cardTitle}>{item.title}</h3>
                <p className={s.cardDesc}>{item.desc}</p>
              </div>
            </Reveal>
          </Link>
        ))}
      </BalancedGrid>
    </section>
  );
}
