import { Link } from "react-router-dom";
import { useI18n } from "../../lib/i18n";
import { pick } from "../../lib/content-helpers";
import { FALLBACK_SERVICES } from "../../lib/fallback-content";
import { Reveal } from "../../components/Reveal";
import { ServiceIcon } from "../../components/ServiceIcon";
import s from "../../styles/sections.module.css";
import h from "../Home.module.css";
import type { ContentItem } from "../../services/api-types";

/**
 * What the studio builds: the services from the dashboard, as plain cards —
 * an icon, the name, one line, and the way in. No stock photos: a picture of
 * a robot hand says nothing about a POS system.
 */
export function HomeServices({ services }: { services: ContentItem[] | null }) {
  const { t, lang } = useI18n();
  const items =
    services && services.length > 0
      ? services.slice(0, 8).map((item) => ({
          key: item.id,
          slug: item.slug || item.id,
          title: pick(item.title, lang),
          desc: pick(item.summary, lang),
        }))
      : FALLBACK_SERVICES.map((f) => ({ key: f.key, slug: f.slug ?? f.key, title: t(f.title), desc: t(f.desc) }));
  return (
    <section className={s.section} id="services">
      <Reveal className={s.head}>
        <div className={s.headText}>
          <span className="kf-label">{t("What we build")}</span>
          <h2 className={s.h2}>{t("Software for how your business actually runs.")}</h2>
        </div>
        <Link to="/services" className={s.viewAll}>
          {t("View all services")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
        </Link>
      </Reveal>
      <div className={h.svcGrid}>
        {items.map((item, i) => (
          <Reveal key={item.key} as={Link} to={`/services/${item.slug}`} className={h.svcCard} style={{ animationDelay: `${(i % 4) * 70}ms` }}>
            <span className={h.svcTop}>
              <span className={h.svcIcon}>
                <ServiceIcon slug={item.slug} />
              </span>
              <span className={h.svcNo}>{String(i + 1).padStart(2, "0")}</span>
            </span>
            <h3 className={h.svcTitle}>{item.title}</h3>
            <p className={h.svcDesc}>{item.desc}</p>
            <span className={h.svcMore}>
              {t("Learn more")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
            </span>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
