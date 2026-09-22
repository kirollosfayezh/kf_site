import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { pick, metaString, metaPoints, pickPlain } from "../lib/content-helpers";
import { useContentList } from "../hooks/useContent";
import { FALLBACK_SOLUTIONS } from "../lib/fallback-content";
import { Reveal } from "../components/Reveal";
import { Img } from "../components/Img";
import { CheckIcon } from "../components/CheckIcon";
import s from "../styles/sections.module.css";

interface Row {
  key: string;
  tag?: string;
  title: string;
  desc: string;
  img?: string;
  alt: string;
  points: string[];
}

export function Solutions() {
  const { t, lang } = useI18n();
  const solutions = useContentList("solutions");

  // Empty *and* failed responses both fall back to static copy.
  const items: Row[] =
    solutions.data && solutions.data.length > 0
      ? solutions.data.map((item) => ({
          key: item.id,
          tag: metaString(item.meta, "tag"),
          title: pick(item.title, lang),
          desc: pick(item.summary ?? item.body, lang),
          img: item.media?.[0],
          alt: metaString(item.meta, "alt") ?? pick(item.title, lang),
          points: metaPoints(item.meta),
        }))
      : FALLBACK_SOLUTIONS.map((f) => ({
          key: f.key,
          tag: f.solutionTag ?? f.tag,
          title: t(f.title),
          desc: t(f.longDesc ?? f.desc),
          img: f.img,
          alt: f.alt ?? f.title,
          points: f.points ?? [],
        }));

  return (
    <div>
      <section className={s.pageHero}>
        <div className={s.pageHeroGlow} aria-hidden="true" />
        <div className={s.pageHeroInner}>
          <Reveal>
            <span className={s.eyebrowPink}>{t("// SOLUTIONS")}</span>
            <h1 className={`${s.pageTitle} ${s.pageTitleLg}`} style={{ maxWidth: 820 }}>{t("Technology built around your business.")}</h1>
            <p className={s.pageLedeLg}>
              {t(
                "We start with your workflow and the outcome you need, then build software to match. Here's how that looks across the industries we work with.",
              )}
            </p>
          </Reveal>
        </div>
      </section>

      {/* One full-width panel per industry: banner photo, copy, and the
          "WHAT WE BUILD" checklist — the layout from Solutions.dc.html. */}
      <section className={s.solutionList}>
        {
          items.map((item, i) => (
            <Reveal key={item.key} as="article" className={s.solutionRow}>
              {item.img && (
                <div className={s.solutionBanner}>
                  <Img
                    src={item.img}
                    alt={item.alt}
                    width={1200}
                    sizes="(max-width: 1280px) 100vw, 1200px"
                    /* The first banner is the page's LCP candidate, as in the original. */
                    priority={i === 0}
                  />
                  <div className={s.solutionScrim} aria-hidden="true" />
                </div>
              )}
              <div>
                {item.tag && <span className={s.solutionTag}>{pickPlain(item.tag, lang)}</span>}
                <h2 className={s.solutionTitle}>{item.title}</h2>
                <p className={s.solutionDesc}>{item.desc}</p>
              </div>
              {item.points.length > 0 && (
                <div className={s.checkList}>
                  <div className={s.checkListLabel}>{t("WHAT WE BUILD")}</div>
                  {item.points.map((pt) => (
                    <div key={pt} className={s.checkItem}>
                      <CheckIcon />
                      {pickPlain(pt, lang)}
                    </div>
                  ))}
                </div>
              )}
            </Reveal>
          ))}
      </section>

      <section className={s.finalCta}>
        <div className={s.finalCtaGlow} aria-hidden="true" />
        <Reveal className={s.finalCtaInner}>
          <h2 className={s.finalCtaTitle}>{t("Don't see your industry?")}</h2>
          <p className={s.finalCtaLede}>
            {t("The approach is the same for any business: understand the workflow, build the right system. Let's talk about yours.")}
          </p>
          <div className={s.finalCtaActions}>
            <Link to="/contact" className="btn btn-primary">
              {t("Start Your Project")} <span aria-hidden="true">&rarr;</span>
            </Link>
            <Link to="/projects" className="btn btn-outline">
              {t("See our work")}
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
