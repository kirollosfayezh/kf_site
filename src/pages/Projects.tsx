import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { pick, metaString, metaPoints, pickPlain, isConcept } from "../lib/content-helpers";
import { useContentList } from "../hooks/useContent";
import { FALLBACK_PROJECTS } from "../lib/fallback-content";
import { Reveal } from "../components/Reveal";
import { BalancedGrid } from "../components/BalancedGrid";
import { ProjectGallery, galleryImages } from "../components/ProjectGallery";
import { useWhatsAppLink } from "../hooks/useWhatsAppLink";
import s from "../styles/sections.module.css";

const CASE_STEPS = [
  { n: "01", title: "The Challenge", body: "A growing restaurant chain juggled paper tickets, spreadsheets and disconnected tools across branches." },
  { n: "02", title: "The Solution", body: "One connected platform: POS, kitchen display, live inventory and a central dashboard for owners." },
  { n: "03", title: "The Technology", body: "React and Node.js with a PostgreSQL core, built for real-time sync across every branch." },
  { n: "04", title: "The Result", body: "A single source of truth — faster service, fewer errors and clear visibility for management." },
];

interface ProjectCardItem {
  key: string;
  slug?: string;
  title: string;
  desc: string;
  images: string[];
  tag?: string;
  tech: string[];
  result?: string;
  demoUrl?: string;
  concept: boolean;
}

function ProjectCard({ item, i, Heading = "h2" }: { item: ProjectCardItem; i: number; Heading?: "h2" | "h3" }) {
  const { t, lang } = useI18n();
  return (
    // A concept card is the anchor its demo's "Back" button returns to.
    <Reveal as="article" id={item.concept ? item.slug : undefined} className={s.card} style={{ borderRadius: 20, scrollMarginTop: 88 }}>
      <div className={s.cardMedia} style={{ aspectRatio: "16/10" }}>
        {item.images.length ? (
          <ProjectGallery
            images={item.images}
            alt={item.title}
            width={420}
            sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 420px"
            priority={i < 3}
            offset={(i % 3) * 350}
          />
        ) : (
          <div className={s.cardMediaFallback}>{item.title[0]}</div>
        )}
        {item.concept ? (
          <span className={s.cardTag}>{t("Concept demo")}</span>
        ) : (
          item.tag && <span className={s.cardTag}>{pickPlain(item.tag, lang)}</span>
        )}
      </div>
      <div className={s.cardBody} style={{ padding: 24 }}>
        <Heading className={s.cardTitle} style={{ fontSize: "var(--fs-section)" }}>
          {/* The whole card opens the case study; see .stretchLink. */}
          {item.slug ? (
            <Link to={`/projects/${item.slug}`} className={s.stretchLink} data-track="projects.card">
              {item.title}
            </Link>
          ) : (
            item.title
          )}
        </Heading>
        <p className={s.cardDesc}>{item.desc}</p>
        {item.tech.length > 0 && (
          <div className={s.projChips}>
            {item.tech.map((tech) => (
              <span key={tech} className={s.projChip}>{pickPlain(tech, lang)}</span>
            ))}
          </div>
        )}
        <div className={s.projFooter}>
          {/* A concept's demo is the point of the card, so it takes the slot
              a client project uses for its result. */}
          {item.concept && item.demoUrl ? (
            <a href={item.demoUrl} className={s.projView} data-track="projects.concept.demo">
              {t("Try the live demo")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
            </a>
          ) : (
            <span className={s.projResult}>{pickPlain(item.result ?? "", lang)}</span>
          )}
          {/* Only a link when a case study actually exists. The static
              fallback projects are illustrative layouts with nothing
              behind them, and a "View" that 404s is worse than none. */}
          {item.slug ? (
            <Link to={`/projects/${item.slug}`} className={item.concept ? s.textLink : s.projView}>
              {t(item.concept ? "Details" : "View")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
            </Link>
          ) : null}
        </div>
      </div>
    </Reveal>
  );
}

export function Projects() {
  const { t, lang } = useI18n();
  const projects = useContentList("projects");
  const waLink = useWhatsAppLink(t("a similar project"));

  // The illustrative case study only belongs next to illustrative projects:
  // the static fallback set, or CMS rows an editor flagged as samples. Once
  // real projects replace them the section — and its disclaimer — go away.
  const showSample =
    !projects.data || projects.data.length === 0 || projects.data.some((p) => p.meta?.sample === true);

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
          images: galleryImages(item.media),
          tag: metaString(item.meta, "tag"),
          tech: metaPoints(item.meta),
          result: metaString(item.meta, "result"),
          demoUrl: metaString(item.meta, "demoUrl"),
          concept: isConcept(item.meta),
        }))
      : FALLBACK_PROJECTS.map((f) => ({
          key: f.key,
          slug: undefined as string | undefined,
          title: t(f.title),
          desc: t(f.desc),
          images: f.img ? [f.img] : [],
          tag: f.tag,
          tech: f.points ?? [],
          result: f.result,
          demoUrl: undefined as string | undefined,
          concept: false,
        }));
  // Client work first and on its own: the concepts are made-up businesses and
  // must never read as delivered projects.
  const work = items.filter((p) => !p.concept);
  const concepts = items.filter((p) => p.concept);

  return (
    <div>
      <section className={s.pageHero}>
        <div className={s.pageHeroGlow} aria-hidden="true" />
        <div className={s.pageHeroInner}>
          <Reveal>
            <span className={s.eyebrow}>{t("// PROJECTS")}</span>
            <h1 className={`${s.pageTitle} ${s.pageTitleLg}`} style={{ maxWidth: 800 }}>{t("From ideas to real products.")}</h1>
            <p className={s.pageLedeLg}>
              {t("Delivered platforms, dashboards and mobile apps, with the problem, the approach and the technology behind each build.")}
            </p>
          </Reveal>
        </div>
      </section>

      <section className={s.section} style={{ paddingTop: 70, paddingBottom: 40 }}>
        {concepts.length > 0 && (
          <Reveal className={s.head}>
            <h2 className={s.h2}>{t("Client work")}</h2>
            {/* A router link, not a bare #hash: useSmoothScroll scrolls to the
                section when the location's hash changes. */}
            <Link to={{ hash: "concepts" }} className={s.viewAll} data-track="projects.jump.concepts">
              {t("Try our concept demos")} <span aria-hidden="true">&darr;</span>
            </Link>
          </Reveal>
        )}
        <BalancedGrid preset="wide" mobile="two" style={concepts.length > 0 ? undefined : { marginTop: 0 }}>
          {work.map((item, i) => (
            <ProjectCard key={item.key} item={item} i={i} Heading={concepts.length > 0 ? "h3" : "h2"} />
          ))}
        </BalancedGrid>
      </section>

      {concepts.length > 0 && (
        <section id="concepts" className={s.section} style={{ paddingTop: 40, paddingBottom: 40, scrollMarginTop: 88 }}>
          <Reveal>
            <span className={s.eyebrowPink}>{t("// CONCEPT DEMOS")}</span>
            <h2 className={s.h2}>{t("Try a demo yourself.")}</h2>
            <p className={s.lede}>
              {t("Websites we designed for made-up businesses, to show what we can build for yours. Open one and click around: book, order, pay.")}
            </p>
          </Reveal>
          <BalancedGrid preset="wide" mobile="two">
            {concepts.map((item, i) => (
              <ProjectCard key={item.key} item={item} i={i} Heading="h3" />
            ))}
          </BalancedGrid>
        </section>
      )}

      {/* FEATURED CASE STUDY — static in the original export, restored here. */}
      {showSample && (
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
      )}

      <section className={s.finalCta}>
        <div className={s.finalCtaGlow} aria-hidden="true" />
        <Reveal className={s.finalCtaInner}>
          <h2 className={s.finalCtaTitle}>{t("Your project could be next.")}</h2>
          <p className={s.finalCtaLede}>{t("Tell us what you're building and we'll turn it into a real, working product.")}</p>
          <div className={s.finalCtaActions}>
            <Link to="/contact" className="btn btn-primary" data-track="projects.final.start-project">
              {t("Start Your Project")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
            </Link>
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline" data-track="projects.final.whatsapp">
              {t("WhatsApp us")}
            </a>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
