import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { pick, pickPlain } from "../lib/content-helpers";
import { useContentList } from "../hooks/useContent";
import { FALLBACK_FAQS, FALLBACK_PROJECTS, FALLBACK_SERVICES, FALLBACK_SOLUTIONS } from "../lib/fallback-content";
import { Reveal } from "../components/Reveal";
import { Img } from "../components/Img";
import { HeroStage } from "../components/HeroStage";
import { WA_LINK } from "../components/Footer";
import s from "../styles/sections.module.css";
import h from "./Home.module.css";

const HERO_STATS = [
  { l: "PROJECTS", v: "40+" },
  { l: "YEARS", v: "6" },
  { l: "LANGUAGES", v: "4" },
];
const HERO_MARQUEE = ["CUSTOM SOFTWARE", "POS SYSTEMS", "WEB PLATFORMS", "MOBILE APPS", "AI AUTOMATION", "DASHBOARDS"];

const VALUES = [
  { title: "Custom Built", desc: "No unnecessary templates — every system fits your business." },
  { title: "Business Focused", desc: "Technology designed around your actual workflow." },
  { title: "Scalable", desc: "Built to grow with your business, not against it." },
  { title: "Modern Technology", desc: "Reliable and maintainable architecture." },
];

const STEPS = [
  { n: "01", title: "Discover", desc: "Understand the business, users and requirements." },
  { n: "02", title: "Plan", desc: "Define architecture, features and user experience." },
  { n: "03", title: "Design", desc: "Create the interface and the product experience." },
  { n: "04", title: "Build", desc: "Develop, integrate and thoroughly test the product." },
  { n: "05", title: "Launch", desc: "Deploy, monitor and continuously improve." },
];

const WHY = [
  { title: "Built For Your Business", desc: "Every solution is customized around your workflow." },
  { title: "Clean & Maintainable", desc: "Code structured for long-term development." },
  { title: "Performance First", desc: "Fast websites and efficient applications." },
  { title: "Scalable Architecture", desc: "Systems designed to grow with you." },
  { title: "Clear Communication", desc: "You always know what is being built and why." },
  { title: "Long-Term Partnership", desc: "Support does not stop when the project launches." },
];

interface AiStep {
  kind: "TRIGGER" | "AI" | "ACTION" | "LOG" | "ALERT";
  title: string;
  detail: string;
}
interface AiRecipe {
  key: string;
  title: string;
  tag: string;
  steps: AiStep[];
  outcome: { v: string; l: string }[];
}

const KIND_COLOR: Record<AiStep["kind"], string> = {
  TRIGGER: "#FF9A4D",
  AI: "#FF0080",
  ACTION: "#4ADE80",
  LOG: "#7B9BFF",
  ALERT: "#FF6A9E",
};

const AI_RECIPES: AiRecipe[] = [
  {
    key: "inbox",
    title: "Customer enquiry triage",
    tag: "WhatsApp, email and forms in one queue",
    steps: [
      { kind: "TRIGGER", title: "A message arrives", detail: "WhatsApp, the website form or your inbox — all land in one queue." },
      { kind: "AI", title: "Read and classify", detail: "The agent works out what they want, how urgent it is and which service it maps to." },
      { kind: "ACTION", title: "Reply or escalate", detail: "Common questions get an instant answer. Real leads are flagged and assigned to you." },
      { kind: "LOG", title: "Record the lead", detail: "Contact details, source and summary written straight into your CRM or sheet." },
    ],
    outcome: [{ v: "< 1 min", l: "first response time" }, { v: "70%", l: "handled without you" }, { v: "0", l: "enquiries lost" }],
  },
  {
    key: "stock",
    title: "Stock & reorder agent",
    tag: "Watches consumption, drafts the order",
    steps: [
      { kind: "TRIGGER", title: "Nightly sales sync", detail: "Every sale is matched against its recipe or bill of materials." },
      { kind: "AI", title: "Forecast demand", detail: "The agent compares real consumption to the week ahead, allowing for your busy days." },
      { kind: "ACTION", title: "Draft the purchase order", detail: "A ready-to-send order per supplier, waiting for a one-tap approval." },
      { kind: "ALERT", title: "Flag the outliers", detail: "Unusual waste or a line running short gets pushed to you immediately." },
    ],
    outcome: [{ v: "~30%", l: "less stock waste" }, { v: "6 hrs", l: "saved per month" }, { v: "Daily", l: "reorder accuracy" }],
  },
  {
    key: "quote",
    title: "Quote & proposal drafting",
    tag: "Brief in, priced proposal out",
    steps: [
      { kind: "TRIGGER", title: "Enquiry marked as qualified", detail: "You tag a lead as worth quoting — nothing goes out unreviewed." },
      { kind: "AI", title: "Scope the work", detail: "The brief is matched to your past projects and rate card to build a line-item estimate." },
      { kind: "ACTION", title: "Generate the document", detail: "A branded PDF with scope, timeline and price, ready in your drafts." },
      { kind: "LOG", title: "Track the outcome", detail: "Sent, viewed, accepted or lost — recorded against the lead automatically." },
    ],
    outcome: [{ v: "20 min", l: "to a first draft" }, { v: "3x", l: "more quotes sent" }, { v: "100%", l: "you approve first" }],
  },
  {
    key: "report",
    title: "Owner briefing bot",
    tag: "One clear summary every morning",
    steps: [
      { kind: "TRIGGER", title: "Every morning at 7am", detail: "Pulls the previous day from your POS, site analytics and ad accounts." },
      { kind: "AI", title: "Find what changed", detail: "Not a wall of numbers — the three things that actually moved and why." },
      { kind: "ACTION", title: "Send the briefing", detail: "A short WhatsApp or email summary you can read before you open the shop." },
      { kind: "ALERT", title: "Escalate anomalies", detail: "A sudden drop in sales or a spike in ad cost is called out, not buried." },
    ],
    outcome: [{ v: "7am", l: "daily briefing" }, { v: "3", l: "things that matter" }, { v: "No", l: "dashboard hunting" }],
  },
  {
    key: "support",
    title: "Website chat agent",
    tag: "Answers instantly, hands over cleanly",
    steps: [
      { kind: "TRIGGER", title: "Visitor opens the chat", detail: "Captures who they are and which page they came from." },
      { kind: "AI", title: "Answer from your content", detail: "Grounded in your real services, pricing bands and FAQ — it does not invent answers." },
      { kind: "ACTION", title: "Book or hand over", detail: "Offers a call slot, or pulls you in live the moment intent looks serious." },
      { kind: "LOG", title: "Save the transcript", detail: "Full conversation and contact details stored against the lead." },
    ],
    outcome: [{ v: "24/7", l: "coverage" }, { v: "Instant", l: "first reply" }, { v: "Live", l: "human handover" }],
  },
];

export function Home() {
  const { t, lang } = useI18n();
  const [openFaq, setOpenFaq] = useState(-1);
  const [aiKey, setAiKey] = useState("inbox");

  const services = useContentList("services");
  const solutions = useContentList("solutions");
  const projects = useContentList("projects");
  const faqs = useContentList("faqs");

  const activeRecipe = AI_RECIPES.find((r) => r.key === aiKey) ?? AI_RECIPES[0];

  const faqItems = faqs.data && faqs.data.length > 0
    ? faqs.data.map((f) => ({ q: pick(f.title, lang), a: pick(f.body ?? f.summary, lang) }))
    : FALLBACK_FAQS;

  return (
    <div>
      {/* HERO */}
      <section className={h.hero}>
        <HeroStage className={h.heroStage} />
        <div className={h.heroVignette1} aria-hidden="true" />
        <div className={h.heroVignette2} aria-hidden="true" />
        <div className={h.heroScanWrap} aria-hidden="true">
          <span className={h.heroScan} />
        </div>
        <div className={h.heroGrain} aria-hidden="true" />
        <div className={h.heroContent}>
          <div className={`fade ${h.heroKicker}`}>
            <span className={h.heroOpen}>
              <span className={h.heroOpenDot} />
              {t("OPEN FOR WORK")}
            </span>
            <span className={h.heroRule} aria-hidden="true" />
            <span>CAIRO, EG</span>
          </div>

          <h1 className={h.heroTitle}>
            <span className={`up ${h.heroTitleLine}`}>Software</span>
            <span className={`up ${h.heroTitleLine}`}>
              built to <em style={{ fontStyle: "normal" }} className="gradient-text">run</em> on,
            </span>
            <span className={`up ${h.heroTitleLine} ${h.heroTitleDim}`}>not to demo well.</span>
          </h1>

          <div className={h.heroRow}>
            <p className={`up ${h.heroLede}`}>
              {t(
                "Custom platforms, POS systems, dashboards and AI automation — engineered around how your business actually operates, then supported long after launch.",
              )}
            </p>
            <div className={`up ${h.heroActions}`}>
              <Link to="/contact" data-track="hero.start-project" className="btn btn-primary">
                {t("Start a project")} <span aria-hidden="true">&rarr;</span>
              </Link>
              <Link to="/projects" data-track="hero.see-the-work" className={h.heroOutline}>
                {t("See the work")}
              </Link>
            </div>
            <dl className={`up ${h.heroStats}`}>
              {HERO_STATS.map((stat) => (
                <div key={stat.l}>
                  <dt className={h.heroStatLabel}>{stat.l}</dt>
                  <dd className={h.heroStatValue}>{stat.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={h.heroMarquee}>
            {HERO_MARQUEE.map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className={s.sectionAlt}>
        <div className="container" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))" }}>
          {VALUES.map((v) => (
            <Reveal key={v.title} className={s.valueCard}>
              <div className={`${s.valueTitle} gradient-text`}>{t(v.title)}</div>
              <p className={s.cardDesc}>{t(v.desc)}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* SERVICES PREVIEW */}
      <section className={s.section}>
        <Reveal className={s.head}>
          <div style={{ maxWidth: 640 }}>
            <span className={s.eyebrow}>// {t("SERVICES") || "SERVICES"}</span>
            <h2 className={s.h2}>{t("Everything you need to build digital.")}</h2>
          </div>
          <Link to="/services" className={s.viewAll}>
            {t("View all services")} &rarr;
          </Link>
        </Reveal>
        <div className={s.grid}>
          {(services.data && services.data.length > 0
            ? services.data.slice(0, 8).map((item) => ({
                key: item.id,
                title: pick(item.title, lang),
                desc: pick(item.summary, lang),
                media: item.media?.[0],
                href: "/services",
              }))
            : FALLBACK_SERVICES.map((f) => ({ key: f.key, title: t(f.title), desc: t(f.desc), media: f.img, href: "/services" }))
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
        </div>
      </section>

      {/* AI AUTOMATION */}
      <section className={`${h.aiSection} ${s.sectionAlt}`}>
        <div className={h.aiGlow} aria-hidden="true" />
        <div className={h.aiGrid} aria-hidden="true" />
        <div className={h.aiInner}>
          <Reveal style={{ maxWidth: 720 }}>
            <div className={h.aiBadge}>
              <span className={h.aiBadgeDot} />// {t("AI AUTOMATION")}
            </div>
            <h2 className={s.h2}>{t("Put the repetitive work on autopilot.")}</h2>
            <p className={s.lede}>
              {t(
                "We build AI agents that sit inside your real operations — reading messages, updating records, answering customers and flagging what needs a human. Pick a workflow to see how it runs.",
              )}
            </p>
          </Reveal>

          <div className={h.aiBody}>
            <Reveal className={h.aiList}>
              {AI_RECIPES.map((r) => {
                const on = r.key === activeRecipe.key;
                return (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => setAiKey(r.key)}
                    aria-pressed={on}
                    className={`${h.aiRecipe} ${on ? h.aiRecipeOn : ""}`}
                  >
                    <span className={`${h.aiRecipeIcon} ${on ? h.aiRecipeIconOn : ""}`}>&bull;</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className={h.aiRecipeTitle}>{t(r.title)}</span>
                      <div className={h.aiRecipeTag}>{t(r.tag)}</div>
                    </span>
                  </button>
                );
              })}
            </Reveal>

            <Reveal className={h.aiFlow}>
              <h3 className={h.aiFlowTitle}>{t(activeRecipe.title)}</h3>
              <div style={{ marginTop: 20 }}>
                {activeRecipe.steps.map((step, i) => (
                  <div key={step.title} className={h.aiStep}>
                    {i !== activeRecipe.steps.length - 1 && <span className={h.aiStepRail} />}
                    <span className={h.aiStepDot} />
                    <span className={h.aiStepBadge} style={{ background: KIND_COLOR[step.kind] + "1f", color: KIND_COLOR[step.kind], border: `1px solid ${KIND_COLOR[step.kind]}4d` }}>
                      {step.kind}
                    </span>
                    <div className={h.aiStepTitle}>{t(step.title)}</div>
                    <p className={h.aiStepDetail}>{t(step.detail)}</p>
                  </div>
                ))}
              </div>
              <div className={h.aiOutcomes}>
                {activeRecipe.outcome.map((o) => (
                  <div key={o.l}>
                    <div className={h.aiOutcomeValue}>{o.v}</div>
                    <div className={h.aiOutcomeLabel}>{t(o.l)}</div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* SOLUTIONS PREVIEW */}
      <section className={s.sectionAlt}>
        <div className={s.section}>
          <Reveal className={s.head}>
            <div style={{ maxWidth: 640 }}>
              <span className={s.eyebrowPink}>// {t("SOLUTIONS") || "SOLUTIONS"}</span>
              <h2 className={s.h2}>{t("Technology built around your business.")}</h2>
            </div>
            <Link to="/solutions" className={s.viewAll} style={{ color: "var(--brand-pink)" }}>
              {t("View all solutions")} &rarr;
            </Link>
          </Reveal>
          <div className={s.grid2}>
            {(solutions.data && solutions.data.length > 0
              ? solutions.data.map((item) => ({
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
                    {item.tag && <div className={s.cardTag} style={{ position: "absolute", insetInlineStart: 16, bottom: 12, top: "auto", background: "none", border: "none", padding: 0 }}>{pickPlain(item.tag, lang)}</div>}
                  </div>
                  <div className={s.cardBody}>
                    <h3 className={s.cardTitle} style={{ fontSize: 21 }}>{item.title}</h3>
                    <p className={s.cardDesc}>{item.desc}</p>
                  </div>
                </Reveal>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* PROJECTS PREVIEW */}
      <section className={s.section}>
        <Reveal className={s.head}>
          <div style={{ maxWidth: 640 }}>
            <span className={s.eyebrow}>// {t("PROJECTS") || "PROJECTS"}</span>
            <h2 className={s.h2}>{t("From ideas to real products.")}</h2>
          </div>
          <Link to="/projects" className={s.viewAll}>
            {t("View all projects")} &rarr;
          </Link>
        </Reveal>
        <div className={s.grid3}>
          {(projects.data && projects.data.length > 0
            ? projects.data.slice(0, 4).map((item) => ({
                key: item.id,
                category: (item.meta?.category as string) || "",
                title: pick(item.title, lang),
                desc: pick(item.summary, lang),
                media: item.media?.[0],
              }))
            : FALLBACK_PROJECTS.map((f) => ({ key: f.key, category: f.tag ?? "", title: t(f.title), desc: t(f.desc), media: f.img }))
          ).map((item) => (
            <Reveal key={item.key} as="article" className={s.card} style={{ borderRadius: 20 }}>
              <div className={s.cardMedia} style={{ aspectRatio: "16/10" }}>
                {item.media ? <Img src={item.media} alt={item.title} width={420} sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 420px" /> : <div className={s.cardMediaFallback}>{item.title[0]}</div>}
                {item.category && <span className={s.cardTag}>{pickPlain(item.category, lang)}</span>}
              </div>
              <div className={s.cardBody} style={{ padding: 24 }}>
                <h3 className={s.cardTitle} style={{ fontSize: 20 }}>{item.title}</h3>
                <p className={s.cardDesc}>{item.desc}</p>
                <Link to="/projects" style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 16, fontSize: 14, fontWeight: 600, color: "var(--brand-orange)" }}>
                  {t("View project")} <span>&rarr;</span>
                </Link>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* PROCESS */}
      <section className={s.sectionAlt}>
        <div className={s.section}>
          <Reveal style={{ maxWidth: 640 }}>
            <span className={s.eyebrowPink}>{t("// PROCESS")}</span>
            <h2 className={s.h2}>{t("From idea to launch.")}</h2>
          </Reveal>
          <div className={s.gridSteps}>
            {STEPS.map((st) => (
              <Reveal key={st.n}>
                <div className={s.stepBar} />
                <div className={s.stepNum}>{st.n}</div>
                <h3 className={s.stepTitle}>{t(st.title)}</h3>
                <p className={s.stepDesc}>{t(st.desc)}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* WHY */}
      <section className={s.section}>
        <Reveal style={{ maxWidth: 640 }}>
          <span className={s.eyebrow}>{t("// WHY KF TECH")}</span>
          <h2 className={s.h2sm}>{t("A partner, not just a developer.")}</h2>
        </Reveal>
        <div className={s.grid2}>
          {WHY.map((w) => (
            <Reveal key={w.title} className={s.whyCard}>
              <span className={s.whyIcon}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand-orange)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
              <div>
                <h3 className={s.whyTitle}>{t(w.title)}</h3>
                <p className={s.whyDesc}>{t(w.desc)}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ABOUT TEASER */}
      <section className={s.sectionAlt}>
        <div className={h.aboutTeaser}>
          <Reveal className={h.aboutImgWrap}>
            <div className={h.aboutImgGlow} aria-hidden="true" />
            <img
              className={h.aboutImg}
              src="/founder.jpg"
              alt="Kirollos Fayez, founder of KF Tech Solutions"
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
                {t("More about us")} <span>&rarr;</span>
              </Link>
              <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                {t("Chat on WhatsApp")}
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className={s.sectionNarrow}>
        <Reveal className={s.headCenter}>
          <span className={s.eyebrow}>{t("// FAQ")}</span>
          <h2 className={s.h2sm}>{t("Questions, answered.")}</h2>
        </Reveal>
        <div className={s.faqList}>
          {faqItems.map((f, i) => (
            <Reveal key={f.q} className={s.faqItem}>
              {/* The answer is only in the DOM while the item is open, so the
                  SEO layer reads both halves from these attributes instead —
                  the same contract kf-seo.js used in the design export. This
                  keeps the FAQPage schema and the visible accordion in step. */}
              <button
                type="button"
                className={s.faqQ}
                aria-expanded={openFaq === i}
                data-kf-faq-q={f.q}
                data-kf-faq-a={f.a}
                onClick={() => setOpenFaq((cur) => (cur === i ? -1 : i))}
              >
                <span>{f.q}</span>
                <span className={`${s.faqChevron} ${openFaq === i ? s.faqChevronOpen : ""}`} aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand-orange)" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </button>
              {openFaq === i && <p className={s.faqA}>{f.a}</p>}
            </Reveal>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className={s.finalCta}>
        <div className={s.finalCtaGlow} aria-hidden="true" />
        <Reveal className={s.finalCtaInner}>
          <h2 className={s.finalCtaTitle}>
            {t("Have an idea?")}
            <br />
            <span className="gradient-text">{t("Let's build it.")}</span>
          </h2>
          <p className={s.finalCtaLede}>{t("Tell us what you're trying to build and we'll help turn the idea into a real, working product.")}</p>
          <div className={s.finalCtaActions}>
            <Link to="/contact" className="btn btn-primary">
              {t("Start Your Project")} <span>&rarr;</span>
            </Link>
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
              {t("WhatsApp Us")}
            </a>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
