import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useSeo } from "../components/Seo";
import { PAGES, articlePageSeo, type PageSeo } from "../lib/seo";
import { pick } from "../lib/content-helpers";
import { useContentItem } from "../hooks/useContent";
import { Reveal } from "../components/Reveal";
import { Img } from "../components/Img";
import s from "../styles/sections.module.css";

export function Article() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useI18n();
  const { data: post, loading, error } = useContentItem("blogPosts", id);

  /**
   * The Layout's RouteSeo deliberately skips `/blog/:id`, so the article owns
   * its own tags. Until the post arrives there is nothing truthful to say about
   * it, so hold the generic blog metadata rather than publishing a title built
   * from an empty object; a missing post falls back to a noindex entry so a
   * dead article URL can't be indexed as a soft 404.
   */
  const seo = useMemo<PageSeo>(
    () => (post ? articlePageSeo(post, lang) : error ? PAGES.notFound : PAGES.blog),
    [post, error, lang],
  );

  useSeo(seo);

  if (loading) return <p className={s.state} style={{ paddingTop: 160 }}>Loading article…</p>;
  if (error || !post) {
    return (
      <div className={s.state} style={{ paddingTop: 160 }}>
        <p>{t("We couldn't load this article. It may have been unpublished, or the connection dropped.")}</p>
        <Link to="/blog" style={{ color: "var(--brand-orange)", display: "inline-block", marginTop: 14 }}>
          &larr; {t("Insights")}
        </Link>
      </div>
    );
  }

  return (
    <article>
      <section className={s.pageHero}>
        <div className={s.pageHeroGlow} aria-hidden="true" />
        <div className={s.pageHeroInner} style={{ maxWidth: 760 }}>
          <Reveal>
            <nav aria-label="Breadcrumb" className={s.breadcrumb}>
              <Link to="/" style={{ color: "var(--text3)" }}>{t("Home")}</Link> /{" "}
              <Link to="/blog" style={{ color: "var(--text3)" }}>{t("Insights")}</Link>
            </nav>
            <h1 className={s.pageTitle}>{pick(post.title, lang)}</h1>
            {post.summary && <p className={s.pageLede}>{pick(post.summary, lang)}</p>}
          </Reveal>
        </div>
      </section>

      {post.media?.[0] && (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 24px" }}>
          <Img
            src={post.media?.[0]}
            alt={pick(post.title, lang)}
            width={1200}
            sizes="(max-width: 1280px) 100vw, 1200px"
            priority
            style={{ width: "100%", borderRadius: 16, border: "1px solid var(--border)" }}
          />
        </div>
      )}

      <section className={s.sectionNarrow} style={{ maxWidth: 720 }}>
        <Reveal style={{ color: "var(--text2)", fontSize: 16.5, lineHeight: 1.75, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {pick(post.body, lang) || "This article doesn't have body content yet."}
        </Reveal>
      </section>

      <section className={s.sectionNarrow} style={{ paddingTop: 0 }}>
        <Link to="/blog" style={{ color: "var(--brand-orange)", fontWeight: 600 }}>&larr; {t("Keep reading")}</Link>
      </section>
    </article>
  );
}
