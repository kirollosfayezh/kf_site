import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useSeo } from "../components/Seo";
import { PAGES, articlePageSeo, SITE, type PageSeo } from "../lib/seo";
import { pick, pickPlain, metaString, metaPoints, initials } from "../lib/content-helpers";
import { renderRichText, readingMinutes } from "../lib/rich-text";
import { useContentItem, useContentList } from "../hooks/useContent";
import { Reveal } from "../components/Reveal";
import { Img } from "../components/Img";
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
    })
    .toUpperCase();
}

/**
 * `meta.stats` — the design export's "THE ROUGH MATH" band. Stored as
 * `["40 min", "saved per night"]` pairs so an editor can add one without a
 * schema change; anything malformed is skipped rather than rendered half-empty.
 */
function readStats(meta: Record<string, unknown> | undefined): { value: string; label: string }[] {
  const raw = meta?.stats;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r): r is string[] => Array.isArray(r) && typeof r[0] === "string" && typeof r[1] === "string")
    .map(([value, label]) => ({ value, label }));
}

export function Article() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useI18n();
  const { data: post, loading, error } = useContentItem("blogPosts", id);
  const all = useContentList("blogPosts");

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

  const body = post ? pick(post.body, lang) : "";
  // Parsed once per body: the prose and the "on this page" list come from the
  // same pass, so the contents can never name a heading the article lacks.
  const { blocks, headings } = useMemo(() => renderRichText(body), [body]);
  const minutes = useMemo(() => readingMinutes(body), [body]);

  const tag = metaString(post?.meta, "tag");

  /** Same category first, newest otherwise — and never this post. */
  const related = useMemo(() => {
    const items = (all.data ?? []).filter((x) => x.id !== post?.id && x.slug !== post?.slug);
    const sameTag = items.filter((x) => metaString(x.meta, "tag") === tag);
    return (sameTag.length ? sameTag : items).slice(0, 3);
  }, [all.data, post?.id, post?.slug, tag]);

  if (loading) return <p className={s.state} style={{ paddingTop: 160 }}>{t("Loading…")}</p>;
  if (error || !post) {
    return (
      <div className={s.state} style={{ paddingTop: 160 }}>
        <p>{t("We couldn't load this article. It may have been unpublished, or the connection dropped.")}</p>
        <Link to="/blog" style={{ color: "var(--brand-orange)", display: "inline-block", marginTop: 14 }}>
          <span className="kf-arrow" aria-hidden="true">&larr;</span> {t("Insights")}
        </Link>
      </div>
    );
  }

  const title = pick(post.title, lang);
  const stats = readStats(post.meta);
  const tags = metaPoints(post.meta, "tags");
  const caption = metaString(post.meta, "caption");
  const date = formatDate(post.createdAt, lang);

  return (
    <article>
      <section className={s.pageHero}>
        <div className={s.pageHeroGlow} aria-hidden="true" />
        <div className={s.pageHeroInner} style={{ maxWidth: 800 }}>
          <Reveal>
            <nav aria-label="Breadcrumb" className={s.breadcrumb}>
              <Link to="/" style={{ color: "var(--text3)" }}>{t("Home")}</Link> /{" "}
              <Link to="/blog" style={{ color: "var(--text3)" }}>{t("Insights")}</Link>
            </nav>

            <div className={s.artMeta}>
              {tag && <span className={s.artCat}>{pickPlain(tag, lang)}</span>}
              {date && <span dir="auto">{date}</span>}
              <span className={s.artDot} aria-hidden="true">·</span>
              <span>{minutes} {t("min read")}</span>
            </div>

            <h1 className={s.pageTitle}>{title}</h1>
            {post.summary && <p className={s.pageLede}>{pick(post.summary, lang)}</p>}

            <div className={s.artAuthor}>
              <span className={s.artAvatar} aria-hidden="true">{initials(SITE.founder)}</span>
              <div>
                <div className={s.artAuthorName}>{SITE.founder}</div>
                <div className={s.artAuthorRole}>{t("Founder, KF Tech Solutions")}</div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {post.media?.[0] && (
        <figure className={s.artFigure}>
          <Img
            src={post.media[0]}
            alt={metaString(post.meta, "alt") || title}
            width={1200}
            sizes="(max-width: 1280px) 100vw, 1200px"
            priority
            style={{ width: "100%", borderRadius: 16, border: "1px solid var(--border)" }}
          />
          {caption && <figcaption className={s.artCaption}>{pickPlain(caption, lang)}</figcaption>}
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

          {stats.length > 0 && (
            <div className={s.artStats}>
              {stats.map((m) => (
                <div key={m.label}>
                  <div className={s.artStatValue} dir="auto">{pickPlain(m.value, lang)}</div>
                  <div className={s.artStatLabel}>{pickPlain(m.label, lang)}</div>
                </div>
              ))}
            </div>
          )}

          {tags.length > 0 && (
            <div className={s.artTags}>
              {tags.map((x) => (
                <span key={x} className={s.artTag}>{pickPlain(x, lang)}</span>
              ))}
            </div>
          )}

          <aside className={s.artCta}>
            <div className={s.artCtaTitle}>{t("Need a system like this?")}</div>
            <p className={s.artCtaBody}>
              {t("We build POS and business systems around how you actually work.")}
            </p>
            <Link to="/contact" className="btn btn-primary">
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
        </div>
      </div>
    </article>
  );
}
