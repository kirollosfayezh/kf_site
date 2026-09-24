import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { pick, metaString, metaPoints, pickPlain } from "../lib/content-helpers";
import { useContentList } from "../hooks/useContent";
import { FALLBACK_PROJECTS } from "../lib/fallback-content";
import { Reveal } from "../components/Reveal";
import { BalancedGrid } from "../components/BalancedGrid";
import { Img } from "../components/Img";
import { WA_LINK } from "../components/Footer";
import s from "../styles/sections.module.css";

const CASE_STEPS = [
  { n: "01", title: "The Challenge", body: "A growing restaurant chain juggled paper tickets, spreadsheets and disconnected tools across branches." },
  { n: "02", title: "The Solution", body: "One connected platform: POS, kitchen display, live inventory and a central dashboard for owners." },
  { n: "03", title: "The Technology", body: "React and Node.js with a PostgreSQL core, built for real-time sync across every branch." },
  { n: "04", title: "The Result", body: "A single source of truth — faster service, fewer errors and clear visibility for management." },
];

export function Projects() {
  const { t, lang } = useI18n();
  const projects = useContentList("projects");

  // Empty *and* failed responses both fall back to static copy.
  const items =
    projects.data && projects.data.length > 0
      ? projects.data.map((item) => ({
          key: item.id,
          // The CMS slug is what /projects/:slug resolves by; the fallback
          // items are static copy with no page of their own.
          slug: item.slug || item.id,
          title: pick(item.title, lang),
          desc: pick(item.summary ?? item.body, lang),
          media: item.media?.[0],
          tag: metaString(item.meta, "tag"),
          tech: metaPoints(item.meta),
          result: metaString(item.meta, "result"),
        }))
      : FALLBACK_PROJECTS.map((f) => ({
          key: f.key,
          slug: undefined as string | undefined,
          title: t(f.title),
          desc: t(f.desc),
          media: f.img,
          tag: f.tag,
          tech: f.points ?? [],
          result: f.result,
        }));

  return (
    <div>
      <section className={s.pageHero}>
        <div className={s.pageHeroGlow} aria-hidden="true" />
        <div className={s.pageHeroInner}>
          <Reveal>
            <span className={s.eyebrow}>{t("// PROJECTS")}</span>
            <div className={s.titleRow}>
              <h1 className={`${s.pageTitle} ${s.pageTitleLg}`} style={{ maxWidth: 800 }}>{t("From ideas to real products.")}</h1>
              <span className={s.titleNote}>{t("Sample layouts · real screenshots drop in later")}</span>
            </div>
            <p className={s.pageLedeLg}>
              {t("The layouts below show how we present delivered work. Each slot is ready for a real project's screenshots, results and technologies.")}
            </p>
          </Reveal>
        </div>
      </section>

      <section className={s.section} style={{ paddingTop: 70, paddingBottom: 40 }}>
        <BalancedGrid preset="wide" style={{ marginTop: 0 }}>
          {items.map((item, i) => (
            <Reveal key={item.key} as="article" className={s.card} style={{ borderRadius: 20 }}>
              <div className={s.cardMedia} style={{ aspectRatio: "16/10" }}>
                {item.media ? (
                  <Img src={item.media} alt={item.title} width={420} sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 420px" priority={i < 3} />
                ) : (
                  <div className={s.cardMediaFallback}>{item.title[0]}</div>
                )}
                {item.tag && <span className={s.cardTag}>{pickPlain(item.tag, lang)}</span>}
              </div>
              <div className={s.cardBody} style={{ padding: 24 }}>
                <h2 className={s.cardTitle} style={{ fontSize: "var(--fs-section)" }}>{item.title}</h2>
                <p className={s.cardDesc}>{item.desc}</p>
                {item.tech.length > 0 && (
                  <div className={s.projChips}>
                    {item.tech.map((tech) => (
                      <span key={tech} className={s.projChip}>{tech}</span>
                    ))}
                  </div>
                )}
                <div className={s.projFooter}>
                  <span className={s.projResult}>{pickPlain(item.result ?? "", lang)}</span>
                  {/* Only a link when a case study actually exists. The static
                      fallback projects are illustrative layouts with nothing
                      behind them, and a "View" that 404s is worse than none. */}
                  {item.slug ? (
                    <Link to={`/projects/${item.slug}`} className={s.projView}>
                      {t("View")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
                    </Link>
                  ) : null}
                </div>
              </div>
            </Reveal>
          ))}
        </BalancedGrid>
      </section>

      {/* FEATURED CASE STUDY — static in the original export, restored here. */}
      <section className={s.sectionAlt}>
        <div className={s.section}>
          <Reveal>
            <span className={s.eyebrowPink}>{t("// FEATURED CASE STUDY")}</span>
            <h2 className={s.caseTitle}>{t("A restaurant chain, from paper tickets to one connected system.")}</h2>
          </Reveal>
          <div className={s.caseGrid}>
            {CASE_STEPS.map((c) => (
              <Reveal key={c.n} className={s.caseCell}>
                <div className={s.caseHead}>
                  <span className={s.caseNum}>{c.n}</span>
                  <span className={s.caseStepTitle}>{t(c.title)}</span>
                </div>
                <p className={s.caseBody}>{t(c.body)}</p>
              </Reveal>
            ))}
          </div>
          <p className={s.caseNote}>
            {t("Illustrative example. We publish metrics only from real, delivered projects.")}
          </p>
        </div>
      </section>

      <section className={s.finalCta}>
        <div className={s.finalCtaGlow} aria-hidden="true" />
        <Reveal className={s.finalCtaInner}>
          <h2 className={s.finalCtaTitle}>{t("Your project could be next.")}</h2>
          <p className={s.finalCtaLede}>{t("Tell us what you're building and we'll turn it into a real, working product.")}</p>
          <div className={s.finalCtaActions}>
            <Link to="/contact" className="btn btn-primary">
              {t("Start Your Project")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
            </Link>
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
              {t("WhatsApp us")}
            </a>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
