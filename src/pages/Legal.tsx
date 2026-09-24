import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useSeo } from "../components/Seo";
import { PAGES, legalPageSeo, type PageSeo } from "../lib/seo";
import { pick } from "../lib/content-helpers";
import { renderRichText } from "../lib/rich-text";
import { useContentItem } from "../hooks/useContent";
import { Reveal } from "../components/Reveal";
import s from "../styles/sections.module.css";

/**
 * A legal document — privacy policy, terms — rendered from the CMS.
 *
 * These were two `href="#"` links in the footer for the life of the site. They
 * are CMS-backed rather than hardcoded so the text can be corrected without a
 * deploy, which matters for a document that has to track the law.
 */
export function Legal() {
  const { slug } = useParams<{ slug: string }>();
  const { t, lang } = useI18n();
  const { data: doc, loading, error } = useContentItem("legalPages", slug);

  const seo = useMemo<PageSeo>(
    () => (doc ? legalPageSeo(doc, lang) : error ? PAGES.notFound : PAGES.home),
    [doc, error, lang],
  );
  useSeo(seo);

  const body = doc ? pick(doc.body, lang) : "";
  const { blocks } = useMemo(() => renderRichText(body), [body]);

  if (loading) {
    return <p className={s.state} style={{ paddingTop: 160 }}>{t("Loading…")}</p>;
  }

  if (error || !doc) {
    return (
      <div className={s.state} style={{ paddingTop: 160 }}>
        {/* A heading, so a screen reader landing here hears what happened. */}
        <h1 className={s.stateTitle}>{t("This page isn't available")}</h1>
        <p>{t("We couldn't load this page. It may have been unpublished, or the connection dropped.")}</p>
        <Link to="/" className={s.textLink} style={{ marginTop: 14 }}>
          <span className="kf-arrow" aria-hidden="true">&larr;</span> {t("Home")}
        </Link>
      </div>
    );
  }

  return (
    <article>
      <section className={s.pageHero}>
        <div className={s.pageHeroGlow} aria-hidden="true" />
        <div className={s.pageHeroInner} style={{ maxWidth: 780 }}>
          <Reveal>
            <nav aria-label={t("Breadcrumb")} className={s.breadcrumb}>
              <Link to="/" style={{ color: "var(--text3)" }}>{t("Home")}</Link> / {t("Legal")}
            </nav>
            <h1 className={s.pageTitle}>{pick(doc.title, lang)}</h1>
            {doc.summary ? <p className={s.pageLede}>{pick(doc.summary, lang)}</p> : null}
          </Reveal>
        </div>
      </section>

      <section className={s.sectionNarrow} style={{ maxWidth: 760 }}>
        <Reveal className="kf-prose">{blocks}</Reveal>
      </section>
    </article>
  );
}
