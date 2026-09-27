import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useFaqSchema } from "../components/Seo";
import { pick, pickPlain, metaString } from "../lib/content-helpers";
import { useContentList } from "../hooks/useContent";
import { FALLBACK_FAQS, FALLBACK_PROJECTS, FALLBACK_SERVICES, FALLBACK_SOLUTIONS } from "../lib/fallback-content";
import { Reveal } from "../components/Reveal";
import { BalancedGrid } from "../components/BalancedGrid";
import { Img } from "../components/Img";
import { ProjectGallery, galleryImages } from "../components/ProjectGallery";
import { HeroStage } from "../components/HeroStage";
import { Testimonials } from "../components/Testimonials";
import { useWhatsAppLink } from "../hooks/useWhatsAppLink";
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

/** Tokens, not literals: a brand change is then one edit in `index.css`, and
 *  these keep working when the light theme redefines them. */
const KIND_COLOR: Record<AiStep["kind"], string> = {
  TRIGGER: "var(--warning)",
  AI: "var(--brand-pink)",
  ACTION: "var(--success)",
  LOG: "var(--info)",
  ALERT: "var(--danger)",
};

/** Tinted chip for a step kind. `color-mix`, because the colours are `var()`
 *  tokens now: appending a hex alpha (`var(--warning)1f`) is invalid CSS, so
 *  the chip's fill and border were silently dropped. 12% / 30% are the
 *  0x1f / 0x4d alphas the literals used to carry. */
function kindChip(color: string): React.CSSProperties {
  return {
    color,
    background: `color-mix(in srgb, ${color} 12%, transparent)`,
    border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
  };
}

/**
 * One mark per workflow. These boxes held a literal `&bull;` — a single dot in
 * a square — so all five read as empty placeholders and gave no clue which
 * workflow was which. Inline stroke SVG, like every other icon on the site.
 */
const RECIPE_ICON: Record<string, React.ReactNode> = {
  inbox: <path d="M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />,
  stock: <><path d="M21 8 12 3 3 8v8l9 5 9-5V8z" /><path d="m3 8 9 5 9-5M12 13v8" /></>,
  quote: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h4" /></>,
  report: <><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></>,
  support: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
};

function RecipeIcon({ name }: { name: string }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {RECIPE_ICON[name] ?? <circle cx="12" cy="12" r="3" />}
    </svg>
  );
}

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

/**
 * The hero headline, translated.
 *
 * It used to be three hardcoded spans, which is also how the design export
 * wrote it — and why neither the export nor this rebuild ever translated it:
 * the sentence is split across elements, so no single text node matches a
 * dictionary key. An Arabic visitor read an English headline.
 *
 * The dictionary value carries the two things a flat string cannot: `\n` marks
 * the three staggered lines, and `*word*` marks the gradient word. Both differ
 * per language — Arabic and French break the sentence in different places and
 * emphasise a different word — so they belong in the translation, not the JSX.
 *
 * The last line keeps the dimmed treatment; the stagger delays come from the
 * `up` animation, one step per line, exactly as before.
 */
function heroHeadline(t: (key: string) => string) {
  // "Custom software" leads: the h1 is the strongest on-page ranking signal
  // and the old line carried no service keyword at all.
  const lines = t("Custom software built to run on, not to demo well.").split("\n");
  return lines.map((line, i) => (
    <span
      key={line}
      className={`up ${h.heroTitleLine} ${i === lines.length - 1 ? h.heroTitleDim : ""}`}
    >
      {line.split(/\*([^*]+)\*/).map((part, j) =>
        // Odd indices are what sat between the asterisks — the gradient word.
        j % 2 === 1 ? (
          <em key={j} style={{ fontStyle: "normal" }} className="gradient-text">
            {part}
          </em>
        ) : (
          part
        ),
      )}
    </span>
  ));
}

export function Home() {
  const { t, lang } = useI18n();
  const waLink = useWhatsAppLink();
  const [openFaq, setOpenFaq] = useState(-1);
  const [aiKey, setAiKey] = useState("inbox");

  const services = useContentList("services");
  const solutions = useContentList("solutions");
  const projects = useContentList("projects");
  const faqs = useContentList("faqs");

  const activeRecipe = AI_RECIPES.find((r) => r.key === aiKey) ?? AI_RECIPES[0];

  const faqItems = useMemo(
    () =>
      faqs.data && faqs.data.length > 0
        ? faqs.data.map((f) => ({ q: pick(f.title, lang), a: pick(f.body ?? f.summary, lang) }))
        : FALLBACK_FAQS.map((f) => ({ q: t(f.q), a: t(f.a) })),
    [faqs.data, lang, t],
  );
  // The FAQPage schema comes from the same list the accordion renders.
  useFaqSchema(faqItems);

  return (
    <div>
      {/* HERO */}
      <section className={h.hero} data-hero>
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
            <span>{t("CAIRO, EG")}</span>
          </div>

          <h1 className={h.heroTitle}>{heroHeadline(t)}</h1>

          <div className={h.heroRow}>
            <p className={`up ${h.heroLede}`}>
              {t(
                "Custom platforms, POS systems, dashboards and AI automation — engineered around how your business actually operates, then supported long after launch.",
              )}
            </p>
            <div className={`up ${h.heroActions}`}>
              <Link to="/contact" data-track="hero.start-project" className="btn btn-primary">
                {t("Start a project")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
              </Link>
              <Link to="/projects" data-track="hero.see-the-work" className={h.heroOutline}>
                {t("See the work")}
              </Link>
            </div>
            <dl className={`up ${h.heroStats}`}>
              {HERO_STATS.map((stat) => (
                <div key={stat.l}>
                  <dt className={h.heroStatLabel}>{t(stat.l)}</dt>
                  <dd className={h.heroStatValue}>{stat.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={h.heroMarquee}>
            {HERO_MARQUEE.map((m) => (
              <span key={m}>{t(m)}</span>
            ))}
          </div>
        </div>
      </section>

      {/* TRUST STRIP */}
      <section className={s.sectionAlt}>
        <div className={`container ${h.valueStrip}`}>
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
            {t("View all services")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
          </Link>
        </Reveal>
        <BalancedGrid preset="cards">
          {(services.data && services.data.length > 0
            ? services.data.slice(0, 8).map((item) => ({
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
                    <span className={`${h.aiRecipeIcon} ${on ? h.aiRecipeIconOn : ""}`}>
                      <RecipeIcon name={r.key} />
                    </span>
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
                    <span className={h.aiStepBadge} style={kindChip(KIND_COLOR[step.kind])}>
                      {t(step.kind)}
                    </span>
                    <div className={h.aiStepTitle}>{t(step.title)}</div>
                    <p className={h.aiStepDetail}>{t(step.detail)}</p>
                  </div>
                ))}
              </div>
              <div className={h.aiOutcomes}>
                {activeRecipe.outcome.map((o) => (
                  <div key={o.l}>
                    <div className={h.aiOutcomeValue}>{t(o.v)}</div>
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
              {t("View all solutions")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
            </Link>
          </Reveal>
          <BalancedGrid preset="cards">
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

      {/* PROJECTS PREVIEW */}
      <section className={s.section}>
        <Reveal className={s.head}>
          <div style={{ maxWidth: 640 }}>
            <span className={s.eyebrow}>// {t("PROJECTS") || "PROJECTS"}</span>
            <h2 className={s.h2}>{t("From ideas to real products.")}</h2>
          </div>
          <Link to="/projects" className={s.viewAll} data-track="home.projects.view-all">
            {t("View all projects")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
          </Link>
        </Reveal>
        <BalancedGrid preset="wide">
          {(projects.data && projects.data.length > 0
            ? projects.data.slice(0, 4).map((item) => ({
                key: item.id,
                slug: item.slug || item.id,
                // `tag`, not `category` — the seeder writes `meta.tag`, so this
                // read was always empty and the project chips on the homepage
                // rendered blank against live CMS data (they only appeared in
                // the static fallback path).
                category: metaString(item.meta, "tag") ?? "",
                title: pick(item.title, lang),
                desc: pick(item.summary, lang),
                images: galleryImages(item.media),
              }))
            : FALLBACK_PROJECTS.map((f) => ({ key: f.key, slug: undefined as string | undefined, category: f.tag ?? "", title: t(f.title), desc: t(f.desc), images: f.img ? [f.img] : [] }))
          ).map((item, i) => (
            <Reveal key={item.key} as="article" className={s.card} style={{ borderRadius: 20 }}>
              <div className={s.cardMedia} style={{ aspectRatio: "16/10" }}>
                {item.images.length ? (
                  <ProjectGallery images={item.images} alt={item.title} width={420} sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 420px" offset={(i % 2) * 400} />
                ) : (
                  <div className={s.cardMediaFallback}>{item.title[0]}</div>
                )}
                {item.category && <span className={s.cardTag}>{pickPlain(item.category, lang)}</span>}
              </div>
              <div className={s.cardBody} style={{ padding: 24 }}>
                <h3 className={s.cardTitle} style={{ fontSize: "var(--fs-section)" }}>{item.title}</h3>
                <p className={s.cardDesc}>{item.desc}</p>
                {/* Straight to the case study when the project has one; the
                    static fallbacks have no page, so they keep pointing at the
                    gallery rather than at a URL that would 404. */}
                <Link to={item.slug ? `/projects/${item.slug}` : "/projects"} className={s.textLink} style={{ marginTop: 16 }}>
                  {t("View project")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
                </Link>
              </div>
            </Reveal>
          ))}
        </BalancedGrid>
      </section>

      {/* PROCESS */}
      <section className={s.sectionAlt}>
        <div className={s.section}>
          <Reveal style={{ maxWidth: 640 }}>
            <span className={s.eyebrowPink}>{t("// PROCESS")}</span>
            <h2 className={s.h2}>{t("From idea to launch.")}</h2>
          </Reveal>
          <BalancedGrid preset="steps">
            {STEPS.map((st) => (
              <Reveal key={st.n}>
                <div className={s.stepBar} />
                <div className={s.stepNum}>{st.n}</div>
                <h3 className={s.stepTitle}>{t(st.title)}</h3>
                <p className={s.stepDesc}>{t(st.desc)}</p>
              </Reveal>
            ))}
          </BalancedGrid>
        </div>
      </section>

      {/* WHY */}
      <section className={s.section}>
        <Reveal style={{ maxWidth: 640 }}>
          <span className={s.eyebrow}>{t("// WHY KF TECH")}</span>
          <h2 className={s.h2sm}>{t("A partner, not just a developer.")}</h2>
        </Reveal>
        <BalancedGrid preset="cards">
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
        </BalancedGrid>
      </section>

      {/* ABOUT TEASER */}
      <section className={s.sectionAlt}>
        <div className={h.aboutTeaser}>
          <Reveal className={h.aboutImgWrap}>
            <div className={h.aboutImgGlow} aria-hidden="true" />
            <img
              className={h.aboutImg}
              src="/founder.jpg"
              alt={t("Kirollos Fayez, founder of KF Tech Solutions")}
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
                {t("More about us")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
              </Link>
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline" data-track="home.about.whatsapp">
                {t("Chat on WhatsApp")}
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* CLIENTS — from the dashboard's Testimonials collection; renders
          nothing until at least one is published. */}
      <Testimonials limit={6} />

      {/* FAQ */}
      <section className={s.sectionNarrow}>
        <Reveal className={s.headCenter}>
          <span className={s.eyebrow}>{t("// FAQ")}</span>
          <h2 className={s.h2sm}>{t("Questions, answered.")}</h2>
        </Reveal>
        <div className={s.faqList}>
          {faqItems.map((f, i) => (
            <Reveal key={f.q} className={s.faqItem}>
              {/* Every answer is in the DOM, hidden until opened: text that
                  only exists while a visitor clicks is text a crawler never
                  reads, and the FAQPage schema (useFaqSchema) is built from the
                  same list, so the two can never disagree. */}
              <button
                type="button"
                className={s.faqQ}
                aria-expanded={openFaq === i}
                aria-controls={`faq-${i}`}
                onClick={() => setOpenFaq((cur) => (cur === i ? -1 : i))}
              >
                <span>{f.q}</span>
                <span className={`${s.faqChevron} ${openFaq === i ? s.faqChevronOpen : ""}`} aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--brand-orange)" strokeWidth="2" strokeLinecap="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </button>
              <p id={`faq-${i}`} className={s.faqA} hidden={openFaq !== i}>{f.a}</p>
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
            <Link to="/contact" className="btn btn-primary" data-track="home.final.start-project">
              {t("Start Your Project")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
            </Link>
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline" data-track="home.final.whatsapp">
              {t("WhatsApp Us")}
            </a>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
