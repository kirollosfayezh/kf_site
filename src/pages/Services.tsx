import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { pick, metaPoints, pickPlain } from "../lib/content-helpers";
import { useContentList } from "../hooks/useContent";
import { FALLBACK_SERVICES } from "../lib/fallback-content";
import { Reveal } from "../components/Reveal";
import { Img } from "../components/Img";
import { CheckIcon } from "../components/CheckIcon";
import { ServiceIcon } from "../components/ServiceIcon";
import s from "../styles/sections.module.css";

export function Services() {
  const { t, lang } = useI18n();
  const services = useContentList("services");

  // Empty *and* failed responses both fall back to static copy, so a cold
  // backend never leaves this page blank.
  const items =
    services.data && services.data.length > 0
      ? services.data.map((item) => ({
          key: item.id,
          slug: item.slug,
          title: pick(item.title, lang),
          desc: pick(item.summary ?? item.body, lang),
          media: item.media?.[0],
          points: metaPoints(item.meta),
        }))
      : FALLBACK_SERVICES.map((f) => ({
          key: f.key,
          slug: f.slug ?? f.key,
          title: t(f.title),
          desc: t(f.desc),
          media: f.img,
          points: (f.points ?? []).map((p) => t(p)),
        }));

  return (
    <div>
      <section className={s.pageHero}>
        <div className={s.pageHeroGlow} aria-hidden="true" />
        <div className={s.pageHeroInner}>
          <Reveal>
            <span className={s.eyebrow}>{t("// SERVICES")}</span>
            <h1 className={`${s.pageTitle} ${s.pageTitleLg}`} style={{ maxWidth: 800 }}>
              {t("Software development services that ship real products.")}
            </h1>
            <p className={s.pageLedeLg}>
              {t(
                "From a single web app to a full business platform, we cover the whole stack — so you get one accountable partner from idea to launch and beyond.",
              )}
            </p>
          </Reveal>
        </div>
      </section>

      <section className={s.section} style={{ paddingTop: 70, paddingBottom: 40 }}>
        <div className={s.svcGrid}>
          {items.map((item, i) => (
            <Reveal key={item.key} as="article" className={s.svcCard}>
              <div className={s.svcMedia}>
                {item.media ? (
                  <Img
                    src={item.media}
                    alt={item.title}
                    width={420}
                    sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 420px"
                    /* The first row is above the fold on a desktop viewport. */
                    priority={i < 3}
                  />
                ) : (
                  <div className={s.cardMediaFallback}>{item.title[0]}</div>
                )}
                <div className={s.svcScrim} aria-hidden="true" />
                <div className={s.svcIconBadge}>
                  <ServiceIcon slug={item.slug} />
                </div>
              </div>
              <div className={s.svcBody}>
                <h2 className={s.svcTitle}>{item.title}</h2>
                <p className={s.svcDesc}>{item.desc}</p>
                {item.points.length > 0 && (
                  <ul className={s.svcPoints}>
                    {item.points.map((pt) => (
                      <li key={pt} className={s.svcPoint}>
                        <CheckIcon size={15} />
                        {pickPlain(pt, lang)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className={s.finalCta}>
        <div className={s.finalCtaGlow} aria-hidden="true" />
        <Reveal className={s.finalCtaInner}>
          <h2 className={s.finalCtaTitle}>{t("Not sure which service you need?")}</h2>
          <p className={s.finalCtaLede}>
            {t("Tell us the problem you're trying to solve and we'll recommend the right approach.")}
          </p>
          <div className={s.finalCtaActions}>
            <Link to="/contact" className="btn btn-primary">
              {t("Start Your Project")} <span aria-hidden="true">&rarr;</span>
            </Link>
            <Link to="/solutions" className="btn btn-outline">
              {t("See solutions by industry")}
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
