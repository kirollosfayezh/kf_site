import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { pick, metaString } from "../lib/content-helpers";
import { useContentList } from "../hooks/useContent";
import { Reveal } from "../components/Reveal";
import { Img } from "../components/Img";
import s from "../styles/sections.module.css";

const ALL = "All";

/** "12 Aug 2026 · 8 min" style meta line, as the original cards show. */
function metaLine(iso: string | undefined, category: string | undefined): string {
  const bits: string[] = [];
  if (category) bits.push(category.toUpperCase());
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      bits.push(d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase());
    }
  }
  return bits.join(" · ");
}

export function Blog() {
  const { t, lang } = useI18n();
  const posts = useContentList("blogPosts");
  const [cat, setCat] = useState(ALL);

  const all = useMemo(() => posts.data ?? [], [posts.data]);

  // Categories come from the posts themselves (`meta.tag`), so publishing a new
  // category in the dashboard adds a filter here with no code change.
  const cats = useMemo(() => {
    const seen: string[] = [];
    for (const p of all) {
      const tag = metaString(p.meta, "tag");
      if (tag && !seen.includes(tag)) seen.push(tag);
    }
    return [ALL, ...seen];
  }, [all]);

  const filtered = cat === ALL ? all : all.filter((p) => metaString(p.meta, "tag") === cat);

  // The original export leads with a featured article above the grid. It is
  // taken from the published list rather than hardcoded, so the CMS stays the
  // source of truth; the grid then shows the rest.
  const featured = filtered[0];
  const rest = featured ? filtered.slice(1) : filtered;

  return (
    <div>
      <section className={s.pageHero}>
        <div className={s.pageHeroGlow} aria-hidden="true" />
        <div className={s.pageHeroInner}>
          <Reveal>
            <span className={s.eyebrow}>// INSIGHTS</span>
            <h1 className={s.pageTitle} style={{ maxWidth: 800 }}>
              {t("Practical notes on software, automation and running a better business.")}
            </h1>
            <p className={s.pageLede}>
              {t(
                "What we learn building systems for restaurants, retailers, clinics and agencies — written for owners, not engineers.",
              )}
            </p>
          </Reveal>
        </div>
      </section>

      {cats.length > 1 && (
        <section className={s.section} style={{ paddingTop: 0, paddingBottom: 32 }}>
          <div className={s.catRow}>
            {cats.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={c === cat}
                className={`${s.catBtn} ${c === cat ? s.catBtnOn : ""}`}
                onClick={() => setCat(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className={s.section} style={{ paddingTop: 0 }}>
        {/* There is no static stand-in for articles, so a failed fetch shows the
            same neutral note as an empty collection rather than a red error. */}
        {filtered.length === 0 && (
          <p className={s.state}>
            {t("No articles yet — new posts will appear here as soon as they're published.")}
          </p>
        )}

        {featured && (
          <Reveal>
            <Link to={`/blog/${featured.id}`} className={s.featured}>
              <div className={s.featuredMedia}>
                {featured.media?.[0] ? (
                  /* Top of the page once loaded — the LCP candidate, so eager. */
                  <Img src={featured.media?.[0]} alt={pick(featured.title, lang)} width={1000} sizes="(max-width: 1000px) 100vw, 1000px" priority />
                ) : (
                  <div className={s.cardMediaFallback}>{pick(featured.title, lang)[0]}</div>
                )}
                <span className={s.featuredBadge}>{t("FEATURED")}</span>
              </div>
              <div className={s.featuredBody}>
                <div className={s.featuredMeta}>{metaLine(featured.createdAt, metaString(featured.meta, "tag"))}</div>
                <h2 className={s.featuredTitle}>{pick(featured.title, lang)}</h2>
                <p className={s.featuredDesc}>{pick(featured.summary, lang)}</p>
                <div className={s.featuredByline}>
                  <span className={s.featuredAvatar} aria-hidden="true">KF</span>
                  <span className={s.projResult}>Kirollos Fayez</span>
                </div>
              </div>
            </Link>
          </Reveal>
        )}

        <div className={s.grid}>
          {rest.map((post) => {
            const tag = metaString(post.meta, "tag");
            return (
              <Link key={post.id} to={`/blog/${post.id}`} className={s.card}>
                <Reveal>
                  <div className={s.cardMedia}>
                    {post.media?.[0] ? (
                      <Img src={post.media?.[0]} alt={pick(post.title, lang)} width={420} sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 420px" />
                    ) : (
                      <div className={s.cardMediaFallback}>{pick(post.title, lang)[0]}</div>
                    )}
                    {tag && <span className={s.cardTag}>{tag}</span>}
                  </div>
                  <div className={s.cardBody}>
                    <div className={s.cardMetaLine}>{metaLine(post.createdAt, undefined)}</div>
                    <h2 className={s.cardTitle} style={{ marginTop: 10 }}>{pick(post.title, lang)}</h2>
                    <p className={s.cardDesc}>{pick(post.summary, lang)}</p>
                    <span className={s.cardRead}>
                      {t("Read article")} <span aria-hidden="true">&rarr;</span>
                    </span>
                  </div>
                </Reveal>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Closing CTA band from the original export. */}
      <section className={s.ctaPanelWrap}>
        <Reveal className={s.ctaPanel}>
          <div className={s.ctaPanelGlow} aria-hidden="true" />
          <div className={s.ctaPanelInner}>
            <h2 className={s.ctaPanelTitle}>{t("Have a project in mind?")}</h2>
            <p className={s.ctaPanelLede}>
              {t("Tell us what you are trying to fix. We will tell you honestly whether software is the right answer.")}
            </p>
            <div className={s.ctaPanelActions}>
              <Link to="/contact" className="btn btn-primary">
                {t("Start a conversation")} <span aria-hidden="true">&rarr;</span>
              </Link>
              <Link to="/services" className="btn btn-outline">
                {t("See what we build")}
              </Link>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
