import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { pick, metaString } from "../lib/content-helpers";
import { useContentList } from "../hooks/useContent";
import { Reveal } from "../components/Reveal";
import { BalancedGrid } from "../components/BalancedGrid";
import { Testimonials } from "../components/Testimonials";
import { useWhatsAppLink } from "../hooks/useWhatsAppLink";
import { FALLBACK_STEPS as STEPS, FALLBACK_WHY as WHY } from "../lib/fallback-content";
import { useSettings } from "../lib/settings";
import { resolveSocial } from "../lib/contact";
import { ABOUT_IDENTITY as ID } from "../lib/brand-copy";
import { SITE } from "../lib/seo";
import { SOCIAL_NAME } from "../components/Footer";
import s from "../styles/sections.module.css";


/**
 * The brand never breaks across lines: in the Arabic heading the browser
 * split it as "KF / Tech Solutions" at phone width. `dir="ltr"` keeps the
 * Latin name's own order inside the right-to-left line.
 */
function keepBrandTogether(text: string) {
  const at = text.indexOf("KF Tech Solutions");
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <span dir="ltr" style={{ whiteSpace: "nowrap" }}>KF Tech Solutions</span>
      {text.slice(at + "KF Tech Solutions".length)}
    </>
  );
}

export function About() {
  const { t, lang } = useI18n();
  const waLink = useWhatsAppLink();
  const sections = useContentList("aboutSections");
  // Settings are primed into the prerender, so the build and the browser list
  // the same profiles.
  const social = resolveSocial(useSettings()?.social);

  // `aboutSections` is the source for both blocks below, grouped by `meta.tag`.
  // It used to be rendered as a third, standalone list of prose blocks, which
  // duplicated every card on the page and added ~1800px the original has not.
  const cms = sections.data ?? [];
  const why = cms.filter((x) => metaString(x.meta, "tag") === "why");
  const steps = cms.filter((x) => metaString(x.meta, "tag") === "process");

  const whyItems = why.length > 0
    ? why.map((x) => ({ key: x.id, title: pick(x.title, lang), desc: pick(x.body ?? x.summary, lang) }))
    : WHY.map((w) => ({ key: w.title, title: t(w.title), desc: t(w.desc) }));

  const stepItems = steps.length > 0
    ? steps.map((x, i) => ({ key: x.id, n: String(i + 1).padStart(2, "0"), title: pick(x.title, lang), desc: pick(x.body ?? x.summary, lang) }))
    : STEPS.map((st) => ({ key: st.n, n: st.n, title: t(st.title), desc: t(st.desc) }));

  return (
    <div>
      <section className={s.pageHero}>
        <div className={s.pageHeroGlow} aria-hidden="true" />
        <div className={`${s.pageHeroInner} ${s.heroSplit}`}>
          <Reveal>
            <span className={s.eyebrowPink}>{t("// ABOUT")}</span>
            <h1 className={`${s.pageTitle} ${s.pageTitleMd}`}>{t("We don't just write code. We build products.")}</h1>
            <p className={s.pageLede}>
              {t(
                "KF Tech Solutions is a software studio based in Cairo, partnering with businesses to turn ideas into working products — from understanding the problem to engineering the system and supporting it after launch.",
              )}
            </p>
          </Reveal>
          {/* The founder portrait and workspace strip from the original export. */}
          {/* `#founder` is the Person node's @id: the article bylines and the
              structured data land on the face it describes. */}
          <Reveal className={s.portraitCol} id="founder">
            <div className={s.portraitGlow} aria-hidden="true" />
            <img
              className={s.portrait}
              src="/founder.jpg"
              alt={t("Kirollos Fayez, founder of KF Tech Solutions")}
              width={1402}
              height={1122}
              loading="lazy"
              decoding="async"
            />
            <div className={s.portraitCaption}>{t("Kirollos Fayez \u00B7 Founder")}</div>
          </Reveal>
        </div>
      </section>

      {/* Which "KF Tech" this is, in words a reader and an assistant can both
          quote: assistants were answering the brand with a same-named company.
          Every Latin-only value gets its own direction, or an Arabic page
          reorders "KF Tech · KFTech" and the domain's dots. */}
      <section className={s.sectionAlt}>
        <div className={s.section}>
          <Reveal style={{ maxWidth: 760 }}>
            <span className={s.eyebrow}>{t(ID.eyebrow)}</span>
            <h2 className={s.h2sm}>{keepBrandTogether(t(ID.heading))}</h2>
            <p className={s.lede}>{t(ID.intro)}</p>
            <p className={s.lede}>{t(ID.notAffiliated)}</p>
            <dl className={s.caseFacts}>
              <div className={s.caseFact}>
                <dt className={s.caseFactLabel}>{t(ID.fullName)}</dt>
                <dd className={s.caseFactValue} dir="ltr">{SITE.name}</dd>
              </div>
              <div className={s.caseFact}>
                <dt className={s.caseFactLabel}>{t(ID.alsoKnownAs)}</dt>
                <dd className={s.caseFactValue} dir="auto">{t(ID.aliases)}</dd>
              </div>
              <div className={s.caseFact}>
                <dt className={s.caseFactLabel}>{t(ID.founded)}</dt>
                <dd className={s.caseFactValue}>2020</dd>
              </div>
              <div className={s.caseFact}>
                <dt className={s.caseFactLabel}>{t(ID.founder)}</dt>
                <dd className={s.caseFactValue}>
                  {t(ID.founderName)} · {t(ID.founderRole)} ·{" "}
                  <a href={SITE.founderSameAs[0]} target="_blank" rel="me noopener noreferrer" data-track="about.identity.founder-github">
                    GitHub
                  </a>
                </dd>
              </div>
              <div className={s.caseFact}>
                <dt className={s.caseFactLabel}>{t(ID.basedIn)}</dt>
                <dd className={s.caseFactValue}>{t(ID.city)}</dd>
              </div>
              <div className={s.caseFact}>
                <dt className={s.caseFactLabel}>{t(ID.website)}</dt>
                <dd className={s.caseFactValue} dir="ltr">
                  <Link to="/">kftechsolutions.dev</Link>
                </dd>
              </div>
              <div className={s.caseFact}>
                <dt className={s.caseFactLabel}>{t(ID.profiles)}</dt>
                <dd className={s.caseFactValue}>
                  {social.map((p, i) => (
                    <span key={p.key}>
                      {i > 0 && " · "}
                      <a href={p.href} target="_blank" rel="noopener noreferrer" data-track={`about.identity.${p.key}`}>
                        {SOCIAL_NAME[p.key]}
                      </a>
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          </Reveal>
        </div>
      </section>

      <section className={s.sectionAlt}>
        <div className={s.section}>
          <Reveal style={{ maxWidth: 640 }}>
            <span className={s.eyebrow}>{t("// WHY KF TECH")}</span>
            <h2 className={s.h2sm}>{t("A partner, not just a developer.")}</h2>
          </Reveal>
          <BalancedGrid preset="cards">
            {whyItems.map((w) => (
              <Reveal key={w.key} className={s.whyCard}>
                <span className={s.whyIcon}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-text)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </span>
                <div>
                  <h3 className={s.whyTitle}>{w.title}</h3>
                  <p className={s.whyDesc}>{w.desc}</p>
                </div>
              </Reveal>
            ))}
          </BalancedGrid>
        </div>
      </section>

      <section className={s.section}>
        <Reveal style={{ maxWidth: 640 }}>
          <span className={s.eyebrowPink}>{t("// PROCESS")}</span>
          <h2 className={s.h2sm}>{t("From idea to launch.")}</h2>
        </Reveal>
        <BalancedGrid preset="steps">
          {stepItems.map((st) => (
            <Reveal key={st.key}>
              <div className={s.stepBar} />
              <div className={s.stepNum}>{st.n}</div>
              <h3 className={s.stepTitle}>{st.title}</h3>
              <p className={s.stepDesc}>{st.desc}</p>
            </Reveal>
          ))}
        </BalancedGrid>
      </section>

      <Testimonials limit={6} />

      <section className={s.finalCta}>
        <div className={s.finalCtaGlow} aria-hidden="true" />
        <Reveal className={s.finalCtaInner}>
          <h2 className={s.finalCtaTitle}>{t("Let's build something real.")}</h2>
          <div className={s.finalCtaActions}>
            <Link to="/contact" className="btn btn-primary" data-track="about.final.start-project">
              {t("Start a project")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
            </Link>
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline" data-track="about.final.whatsapp">
              {t("WhatsApp us")}
            </a>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
