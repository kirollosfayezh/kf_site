import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { pick, metaString } from "../lib/content-helpers";
import { useContentList } from "../hooks/useContent";
import { Reveal } from "../components/Reveal";
import { BalancedGrid } from "../components/BalancedGrid";
import { Img } from "../components/Img";
import { WA_LINK } from "../components/Footer";
import s from "../styles/sections.module.css";

/** The three workspace shots the original About page shows under the portrait. */
const WORKSPACE = [
  { src: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1000&q=80&auto=format&fit=crop", alt: "Code on a developer workstation" },
  { src: "https://images.unsplash.com/photo-1531973576160-7125cd663d86?w=1000&q=80&auto=format&fit=crop", alt: "Two developers reviewing work together" },
  { src: "https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=1000&q=80&auto=format&fit=crop", alt: "Team planning session around a table" },
];

const WHY = [
  { title: "Built For Your Business", desc: "Every solution is customized around your workflow." },
  { title: "Clean & Maintainable", desc: "Code structured for long-term development." },
  { title: "Performance First", desc: "Fast websites and efficient applications." },
  { title: "Scalable Architecture", desc: "Systems designed to grow with you." },
  { title: "Clear Communication", desc: "You always know what is being built and why." },
  { title: "Long-Term Partnership", desc: "Support does not stop when the project launches." },
];

const STEPS = [
  { n: "01", title: "Discover", desc: "Understand the business, users and requirements." },
  { n: "02", title: "Plan", desc: "Define architecture, features and user experience." },
  { n: "03", title: "Design", desc: "Create the interface and the product experience." },
  { n: "04", title: "Build", desc: "Develop, integrate and thoroughly test the product." },
  { n: "05", title: "Launch", desc: "Deploy, monitor and continuously improve." },
];

export function About() {
  const { t, lang } = useI18n();
  const sections = useContentList("aboutSections");

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
          <Reveal className={s.portraitCol}>
            <div className={s.portraitGlow} aria-hidden="true" />
            <img
              className={s.portrait}
              src="/founder.jpg"
              alt="Kirollos Fayez, founder of KF Tech Solutions"
              width={1402}
              height={1122}
              loading="lazy"
              decoding="async"
            />
            <div className={s.portraitCaption}>{t("Kirollos Fayez \u00B7 Founder")}</div>
            <div className={s.workspaceGrid}>
              {WORKSPACE.map((w) => (
                <div key={w.src} className={s.workspaceCell}>
                  <Img src={w.src} alt={w.alt} width={320} sizes="(max-width: 700px) 45vw, 320px" />
                </div>
              ))}
            </div>
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
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-orange)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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

      <section className={s.finalCta}>
        <div className={s.finalCtaGlow} aria-hidden="true" />
        <Reveal className={s.finalCtaInner}>
          <h2 className={s.finalCtaTitle}>{t("Let's build something real.")}</h2>
          <div className={s.finalCtaActions}>
            <Link to="/contact" className="btn btn-primary">
              {t("Start a project")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
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
