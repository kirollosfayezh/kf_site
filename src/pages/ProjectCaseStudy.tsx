import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useSeo } from "../components/Seo";
import { PAGES, projectPageSeo, type PageSeo } from "../lib/seo";
import { pick, pickPlain, metaString, metaPoints } from "../lib/content-helpers";
import { useContentItem } from "../hooks/useContent";
import { Reveal } from "../components/Reveal";
import { Img } from "../components/Img";
import { WA_LINK } from "../components/Footer";
import s from "../styles/sections.module.css";

/* Inline rather than from an icon package: the site ships no icon library on
   purpose, and two 24px glyphs are not a reason to add one. */
function ExternalLinkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M12 .5a12 12 0 0 0-3.79 23.4c.6.11.82-.26.82-.58v-2.2c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.96 0-1.32.47-2.39 1.24-3.23-.13-.3-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.25 2.88.12 3.18.77.84 1.23 1.91 1.23 3.23 0 4.63-2.8 5.65-5.48 5.95.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5z" />
    </svg>
  );
}

/**
 * A project's own page.
 *
 * Until now `/projects` was the end of the road: every card ended in a `View →`
 * that was a plain `<span>` — styled like a link, wired to nothing, and no such
 * route existed to wire it to. Everything shown here (the write-up, the live
 * demo and repository links, client, year, duration) is editable per project in
 * the dashboard, so publishing a case study is publishing the project.
 */
export function ProjectCaseStudy() {
  const { slug } = useParams<{ slug: string }>();
  const { t, lang } = useI18n();
  const { data: item, loading, error } = useContentItem("projects", slug);

  // Same contract as the Article page: hold the generic /projects metadata
  // until the item arrives, and fall back to a noindex entry if it never does,
  // so a dead project URL cannot be indexed as a soft 404.
  const seo = useMemo<PageSeo>(
    () => (item ? projectPageSeo(item, lang) : error ? PAGES.notFound : PAGES.projects),
    [item, error, lang],
  );
  useSeo(seo);

  if (loading) {
    return (
      <p className={s.state} style={{ paddingTop: 160 }}>
        {t("Loading…")}
      </p>
    );
  }

  if (error || !item) {
    return (
      <div className={s.state} style={{ paddingTop: 160 }}>
        <p>{t("We couldn't load this project. It may have been unpublished, or the connection dropped.")}</p>
        <Link to="/projects" style={{ color: "var(--brand-orange)", display: "inline-block", marginTop: 14 }}>
          &larr; {t("Our Work")}
        </Link>
      </div>
    );
  }

  const title = pick(item.title, lang);
  const summary = pick(item.summary, lang);
  const body = pick(item.body, lang);
  const tag = metaString(item.meta, "tag");
  const tech = metaPoints(item.meta);
  const result = metaString(item.meta, "result");
  const demoUrl = metaString(item.meta, "demoUrl");
  const repoUrl = metaString(item.meta, "repoUrl");

  // Only the facts that were actually filled in — an empty "Client —" row reads
  // as a gap in the work rather than as a detail withheld.
  const facts = [
    { label: t("Client"), value: metaString(item.meta, "client") },
    { label: t("Year"), value: metaString(item.meta, "year") },
    { label: t("Duration"), value: metaString(item.meta, "duration") },
  ].filter((f): f is { label: string; value: string } => !!f.value);

  return (
    <article>
      <section className={s.pageHero}>
        <div className={s.pageHeroGlow} aria-hidden="true" />
        <div className={s.pageHeroInner} style={{ maxWidth: 820 }}>
          <Reveal>
            <nav aria-label="Breadcrumb" className={s.breadcrumb}>
              <Link to="/" style={{ color: "var(--text3)" }}>
                {t("Home")}
              </Link>{" "}
              /{" "}
              <Link to="/projects" style={{ color: "var(--text3)" }}>
                {t("Our Work")}
              </Link>
            </nav>
            {tag && <span className={s.eyebrow}>{pickPlain(tag, lang)}</span>}
            <h1 className={s.pageTitle}>{title}</h1>
            {summary && <p className={s.pageLede}>{summary}</p>}

            {facts.length > 0 && (
              <dl className={s.caseFacts}>
                {facts.map((f) => (
                  <div key={f.label} className={s.caseFact}>
                    <dt className={s.caseFactLabel}>{f.label}</dt>
                    {/* `dir="auto"` because these are free text an editor typed:
                        a Latin value like "10 weeks" inside an RTL page is
                        reordered to "weeks 10" without it. */}
                    <dd className={s.caseFactValue} dir="auto">
                      {pickPlain(f.value, lang)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {(demoUrl || repoUrl) && (
              <div className={s.caseActions}>
                {demoUrl && (
                  // `noopener` matters on both: these point at URLs an editor
                  // typed, which are by definition outside our control.
                  <a href={demoUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
                    <ExternalLinkIcon />
                    {t("Live demo")}
                  </a>
                )}
                {repoUrl && (
                  <a href={repoUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
                    <GithubIcon />
                    {t("Source code")}
                  </a>
                )}
              </div>
            )}
          </Reveal>
        </div>
      </section>

      {item.media?.[0] && (
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 24px" }}>
          <Img
            src={item.media[0]}
            alt={title}
            width={1200}
            sizes="(max-width: 1280px) 100vw, 1200px"
            priority
            style={{ width: "100%", borderRadius: 16, border: "1px solid var(--border)" }}
          />
        </div>
      )}

      <section className={s.sectionNarrow} style={{ maxWidth: 760 }}>
        <Reveal
          style={{
            color: "var(--text2)",
            fontSize: 16.5,
            lineHeight: 1.75,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {body || summary || t("This project doesn't have a write-up yet.")}
        </Reveal>

        {result && <Reveal className={s.caseResult}>{pickPlain(result, lang)}</Reveal>}

        {tech.length > 0 && (
          <Reveal>
            <h2 className={s.caseFactLabel} style={{ marginTop: 34, display: "block" }}>
              {t("Built with")}
            </h2>
            <div className={s.projChips}>
              {tech.map((x) => (
                <span key={x} className={s.projChip}>
                  {x}
                </span>
              ))}
            </div>
          </Reveal>
        )}
      </section>

      {/* The rest of the gallery, so a case study is an entry point to the work
          rather than a dead end. */}
      <section className={s.sectionNarrow} style={{ paddingTop: 0 }}>
        <Link to="/projects" style={{ color: "var(--brand-orange)", fontWeight: 600 }}>
          &larr; {t("See more work")}
        </Link>
      </section>

      <section className={s.finalCta}>
        <div className={s.finalCtaGlow} aria-hidden="true" />
        <Reveal className={s.finalCtaInner}>
          <h2 className={s.finalCtaTitle}>{t("Want something like this?")}</h2>
          <p className={s.finalCtaLede}>
            {t("Tell us what you're building and we'll turn it into a real, working product.")}
          </p>
          <div className={s.finalCtaActions}>
            <Link to="/contact" className="btn btn-primary">
              {t("Start Your Project")} <span aria-hidden="true">&rarr;</span>
            </Link>
            <a href={WA_LINK} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
              {t("WhatsApp us")}
            </a>
          </div>
        </Reveal>
      </section>
    </article>
  );
}
