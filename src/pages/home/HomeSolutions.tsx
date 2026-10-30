import { Link } from "react-router-dom";
import { useI18n } from "../../lib/i18n";
import { pick, pickPlain } from "../../lib/content-helpers";
import { FALLBACK_SOLUTIONS } from "../../lib/fallback-content";
import { Reveal } from "../../components/Reveal";
import { BalancedGrid } from "../../components/BalancedGrid";
import { Img } from "../../components/Img";
import s from "../../styles/sections.module.css";
import type { ContentItem } from "../../services/api-types";

/** Industry solutions from the CMS, or the built-in list. */
export function HomeSolutions({ solutions }: { solutions: ContentItem[] | null }) {
  const { t, lang } = useI18n();
  return (
    <section className={s.sectionAlt}>
      <div className={s.section}>
        <Reveal className={s.head}>
          <div style={{ maxWidth: 640 }}>
            <span className={s.eyebrowPink}>// {t("SOLUTIONS") || "SOLUTIONS"}</span>
            <h2 className={s.h2}>{t("Technology built around your business.")}</h2>
          </div>
          <Link to="/solutions" className={s.viewAll} style={{ color: "var(--brand-pink)" }}>
            {t("View all solutions")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
          </Link>
        </Reveal>
        <BalancedGrid preset="cards">
          {(solutions && solutions.length > 0
            ? solutions.map((item) => ({
                key: item.id,
                tag: (item.meta?.tag as string) || "",
                title: pick(item.title, lang),
                desc: pick(item.summary, lang),
                media: item.media?.[0],
              }))
            : FALLBACK_SOLUTIONS.map((f) => ({ key: f.key, tag: f.tag ?? "", title: t(f.title), desc: t(f.desc), media: f.img }))
          ).map((item) => (
            <Link key={item.key} to="/solutions" className={s.card}>
              <Reveal>
                <div className={s.cardMedia}>
                  {item.media ? <Img src={item.media} alt={item.title} width={420} sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 420px" /> : <div className={s.cardMediaFallback}>{item.title[0]}</div>}
                  {item.tag && (
                    <>
                      <div className={s.cardCaptionScrim} aria-hidden="true" />
                      <div className={s.cardCaption}>{pickPlain(item.tag, lang)}</div>
                    </>
                  )}
                </div>
                <div className={s.cardBody}>
                  <h3 className={s.cardTitle} style={{ fontSize: "var(--fs-section)" }}>{item.title}</h3>
                  <p className={s.cardDesc}>{item.desc}</p>
                </div>
              </Reveal>
            </Link>
          ))}
        </BalancedGrid>
      </div>
    </section>
  );
}
