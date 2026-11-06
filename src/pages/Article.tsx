import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useFaqSchema, useSeo } from "../components/Seo";
import { PAGES, SITE_ORIGIN, absolute, articlePageSeo, localePath, type PageSeo } from "../lib/seo";
import { articleExtras, listedIn, pick, pickPlain, metaString } from "../lib/content-helpers";
import { renderRichText, readingMinutes, extractFaq } from "../lib/rich-text";
import { useContentItem, useContentList } from "../hooks/useContent";
import { Reveal } from "../components/Reveal";
import { Img } from "../components/Img";
import { ShareBar } from "../components/ShareBar";
import { NewsletterForm } from "../components/NewsletterForm";
import s from "../styles/sections.module.css";

/** "12 AUG 2026", as the design export prints it. Falls back to the raw string
 *  rather than rendering "Invalid Date" if the CMS ever holds something odd. */
function formatDate(iso: string | undefined, lang: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d
    .toLocaleDateString(lang === "ar" ? "ar-EG" : lang, {
      day: "numeric",
      month: "short",
      year: "numeric",
      // The build machine and the visitor must print the same day.
      timeZone: "UTC",
    })
    .toUpperCase();
}

export function Article() {
  const { id } = useParams<{ id: string }>();
  const { t, lang, available } = useI18n();
  const { data: post, loading, error } = useContentItem("blogPosts", id);
  const all = useContentList("blogPosts");

  /**
   * The Layout's RouteSeo deliberately skips `/blog/:id`, so the article owns
   * its own tags. Until the post arrives there is nothing truthful to say about
   * it, so apply nothing — the prerendered tags stay in place — rather than
   * publishing a title built from an empty object; a missing post falls back to
   * a noindex entry so a dead article URL can't be indexed as a soft 404.
   */
  const seo = useMemo<PageSeo | null>(
    () => (post ? articlePageSeo(post, lang, available) : error ? PAGES.notFound : null),
    [post, error, lang, available],
  );
  useSeo(seo);

  const body = post ? pick(post.body, lang) : "";
  // Parsed once per body: the prose and the "on this page" list come from the
  // same pass, so the contents can never name a heading the article lacks.
  const { blocks, headings } = useMemo(() => renderRichText(body), [body]);
  const minutes = useMemo(() => readingMinutes(body), [body]);
  // A "Common questions" section in the body becomes FAQPage schema.
  useFaqSchema(useMemo(() => extractFaq(body), [body]));

  const tag = metaString(post?.meta, "tag");

  /** Same category first, newest otherwise — never this post, and never one
   *  that is not written in this language (its link would serve English). */
  const related = useMemo(() => {
    const items = (all.data ?? []).filter((x) => x.id !== post?.id && x.slug !== post?.slug && listedIn(x.meta, lang));
    const sameTag = items.filter((x) => metaString(x.meta, "tag") === tag);
    return (sameTag.length ? sameTag : items).slice(0, 3);
  }, [all.data, post?.id, post?.slug, tag, lang]);

  if (loading) return <p className={s.state} style={{ paddingTop: 160 }}>{t("Loading…")}</p>;
  if (error || !post) {
    return (
      <div className={s.state} style={{ paddingTop: 160 }}>
        <p>{t("We couldn't load this article. It may have been unpublished, or the connection dropped.")}</p>
        <Link to="/blog" style={{ color: "var(--brand-text)", display: "inline-block", marginTop: 14 }}>
          <span className="kf-arrow" aria-hidden="true">&larr;</span> {t("Insights")}
        </Link>
      </div>
    );
  }

  const title = pick(post.title, lang);
  // Caption, alt text, stats and tags: the translation's own where it wrote
  // them, otherwise the English through the dictionary.
  const { caption, alt, stats, tags } = articleExtras(post.meta, lang);
  const date = formatDate(post.createdAt, lang);

  return (
    <article>
      <section className={s.pageHero}>
        <div className={s.pageHeroGlow} aria-hidden="true" />
        <div className={s.pageHeroInner} style={{ maxWidth: 800 }}>
          <Reveal>
            <nav aria-label={t("Breadcrumb")} className={s.breadcrumb}>
              <Link to="/" style={{ color: "var(--text3)" }}>{t("Home")}</Link> /{" "}
              <Link to="/blog" style={{ color: "var(--text3)" }}>{t("Insights")}</Link>
            </nav>

            <div className={s.artMeta}>
              {tag && <span className={s.artCat}>{pickPlain(tag, lang)}</span>}
              {/* ICU month abbreviations can differ between Node and the
                  browser; the server's text is kept rather than mismatched. */}
              {date && <span dir="auto" suppressHydrationWarning>{date}</span>}
              <span className={s.artDot} aria-hidden="true">·</span>
              <span>{minutes} {t("min read")}</span>
            </div>

            <h1 className={s.pageTitle}>{title}</h1>
            {post.summary && <p className={s.pageLede}>{pick(post.summary, lang)}</p>}

            {/* A face and a link, not initials: an author a reader can look
                up is part of what makes an article worth trusting.
                `#founder` is the Person node's @id, so the byline and the
                structured data point at the same visible portrait. */}
            <Link to="/about#founder" className={s.artAuthor} data-track="article.author">
              <img src="/founder.jpg" alt="" width={56} height={56} loading="lazy" decoding="async" className={s.artAvatarImg} />
              <div>
                <div className={s.artAuthorName}>{t("Kirollos Fayez")}</div>
                <div className={s.artAuthorRole}>{t("Founder, KF Tech Solutions")}</div>
                <div className={s.artAuthorBio}>{t("Builds POS, web and automation systems for businesses in Egypt and abroad.")}</div>
              </div>
            </Link>
          </Reveal>
        </div>
      </section>

      {post.media?.[0] && (
        <figure className={s.artFigure}>
          <Img
            src={post.media[0]}
            alt={alt || title}
            width={1200}
            sizes="(max-width: 1280px) 100vw, 1200px"
            priority
            style={{ width: "100%", borderRadius: 16, border: "1px solid var(--border)" }}
          />
          {caption && <figcaption className={s.artCaption}>{caption}</figcaption>}
        </figure>
      )}

      <div className={s.artLayout}>
        {/* Only worth a contents list once there is something to navigate. */}
        {headings.length >= 3 && (
          <nav className={s.artToc} aria-label={t("On this page")}>
            <div className={s.artTocLabel}>{t("On this page")}</div>
            <ul className={s.artTocList}>
              {headings.map((h) => (
                <li key={h.id} className={h.level === 3 ? s.artTocSub : undefined}>
                  <a href={`#${h.id}`}>{h.text}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className={s.artMain}>
          <Reveal className="kf-prose">
            {blocks.length ? blocks : <p>{t("This article doesn't have body content yet.")}</p>}
          </Reveal>

          <ShareBar url={absolute(SITE_ORIGIN, localePath(lang, `/blog/${post.slug || post.id}`))} title={title} />

          {stats.length > 0 && (
            <div className={s.artStats}>
              {stats.map((m) => (
                <div key={m.label}>
                  <div className={s.artStatValue} dir="auto">{m.value}</div>
                  <div className={s.artStatLabel}>{m.label}</div>
                </div>
              ))}
            </div>
          )}

          {tags.length > 0 && (
            <div className={s.artTags}>
              {tags.map((x) => (
                <span key={x} className={s.artTag}>{x}</span>
              ))}
            </div>
          )}

          <aside className={s.artCta}>
            <div className={s.artCtaTitle}>{t("Need a system like this?")}</div>
            <p className={s.artCtaBody}>
              {t("We build POS and business systems around how you actually work.")}
            </p>
            <Link to="/contact" className="btn btn-primary" data-track="article.cta.quote">
              {t("Get a quote")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
            </Link>
          </aside>

          {related.length > 0 && (
            <section style={{ marginTop: 46 }}>
              <h2 className={s.artCtaTitle}>{t("Keep reading")}</h2>
              <div className={s.artRelated}>
                {related.map((p) => (
                  <Link key={p.id} to={`/blog/${p.slug || p.id}`} className={s.artRelCard}>
                    <div className={s.artRelMeta}>
                      {pickPlain(metaString(p.meta, "tag") ?? "", lang)}
                    </div>
                    <div className={s.artRelTitle}>{pick(p.title, lang)}</div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section style={{ marginTop: 46 }}>
            <h2 className={s.artCtaTitle}>{t("Newsletter")}</h2>
            <p className={s.artCtaBody}>
              {t("Occasional notes on software, automation and running a better business. No spam.")}
            </p>
            <NewsletterForm source="article" />
          </section>
        </div>
      </div>
    </article>
  );
}
