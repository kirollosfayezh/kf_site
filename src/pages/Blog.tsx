import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { BLOG_REGIONS, listedIn, pick, metaString, pickPlain, postRegions, type BlogRegion } from "../lib/content-helpers";
import { cardMinutes } from "../lib/reading-time";
import { useContentList } from "../hooks/useContent";
import { Reveal } from "../components/Reveal";
import { Img } from "../components/Img";
import s from "../styles/sections.module.css";
import b from "./Blog.module.css";

const ALL = "All";

/**
 * Cards per step under the featured article. Twelve fills whole rows at every
 * width the grid has — one to four columns — so a page never ends ragged.
 */
const PAGE = 12;

/**
 * "POS SYSTEM · 12 AUG 2026 · 8 MIN" — the meta line the original cards show.
 *
 * Formatted in the reader's language rather than `en-GB`: an Arabic card was
 * printing an English month name next to Arabic copy. `readMinutes` comes from
 * the body, so a card and the article it links to can never disagree about how
 * long the piece is.
 */
function metaLine(
  iso: string | undefined,
  category: string | undefined,
  lang: string,
  minutes: number,
  minLabel: string,
): string {
  const bits: string[] = [];
  if (category) bits.push(category.toUpperCase());
  if (iso) {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) {
      bits.push(
        d
          .toLocaleDateString(lang === "ar" ? "ar-EG" : lang, {
            day: "2-digit",
            month: "short",
            year: "numeric",
            // The build machine and the visitor must print the same day.
            timeZone: "UTC",
          })
          .toUpperCase(),
      );
    }
  }
  if (minutes) bits.push(`${minutes} ${minLabel.toUpperCase()}`);
  return bits.join(" · ");
}

export function Blog() {
  const { t, lang } = useI18n();
  const posts = useContentList("blogPosts");
  // Both filters and the page start as "everything, first page" in the build
  // and in the browser alike, so the prerendered HTML hydrates as it is; only
  // a click changes them.
  const [region, setRegion] = useState<BlogRegion | typeof ALL>(ALL);
  const [cat, setCat] = useState(ALL);
  const [shown, setShown] = useState(PAGE);

  // Only posts written in this language: an English-only post on /de/blog
  // would be an English card leading to a page that is not in German.
  const all = useMemo(() => (posts.data ?? []).filter((p) => listedIn(p.meta, lang)), [posts.data, lang]);

  // Regions come from the posts' English tags. The row appears once two
  // regions have posts, and a region with none gets no chip, so no chip ever
  // leads to an empty list.
  const regionsOf = useMemo(() => new Map(all.map((p) => [p.id, postRegions(p.meta)])), [all]);
  const regions = useMemo(
    () => BLOG_REGIONS.map((r) => r.label).filter((r) => all.some((p) => regionsOf.get(p.id)?.includes(r))),
    [all, regionsOf],
  );
  const showRegions = regions.length > 1;
  const regionChips: (BlogRegion | typeof ALL)[] = [ALL, ...regions];
  const activeRegion = showRegions && region !== ALL && regions.includes(region) ? region : ALL;
  const inRegion = useMemo(
    () => (activeRegion === ALL ? all : all.filter((p) => regionsOf.get(p.id)?.includes(activeRegion))),
    [all, regionsOf, activeRegion],
  );

  // Categories come from the posts themselves (`meta.tag`), so publishing a new
  // category in the dashboard adds a filter here with no code change. Only the
  // chosen region's, for the same reason as above.
  const cats = useMemo(() => {
    const seen: string[] = [];
    for (const p of inRegion) {
      const tag = metaString(p.meta, "tag");
      if (tag && !seen.includes(tag)) seen.push(tag);
    }
    return [ALL, ...seen];
  }, [inRegion]);
  const activeCat = cats.includes(cat) ? cat : ALL;

  const filtered = activeCat === ALL ? inRegion : inRegion.filter((p) => metaString(p.meta, "tag") === activeCat);

  // The original export leads with a featured article above the grid. It is
  // taken from the published list rather than hardcoded, so the CMS stays the
  // source of truth; the grid then shows the rest.
  const featured = filtered[0];
  const rest = featured ? filtered.slice(1) : filtered;

  // "Show more" moves focus to the first card it revealed, so a keyboard or
  // screen-reader user continues from the new cards, not from the button.
  const gridRef = useRef<HTMLDivElement>(null);
  const focusFrom = useRef<number | null>(null);
  useEffect(() => {
    const i = focusFrom.current;
    if (i === null) return;
    focusFrom.current = null;
    (gridRef.current?.children[i] as HTMLElement | undefined)?.focus({ preventScroll: true });
  }, [shown]);

  const chooseRegion = (next: BlogRegion | typeof ALL) => {
    setRegion(next);
    setShown(PAGE);
  };
  const chooseCat = (next: string) => {
    setCat(next);
    setShown(PAGE);
  };
  const showMore = () => {
    focusFrom.current = shown;
    setShown(shown + PAGE);
  };

  return (
    <div>
      <section className={s.pageHero}>
        <div className={s.pageHeroGlow} aria-hidden="true" />
        <div className={s.pageHeroInner}>
          <Reveal>
            <span className={s.eyebrow}>{t("// INSIGHTS")}</span>
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

      {(showRegions || cats.length > 1) && (
        <section className={s.section} style={{ paddingTop: 0, paddingBottom: 32 }}>
          <div className={b.filters}>
            {/* Two rows that each start with "All" need saying which is which;
                with the topic row alone the page looks as it always did. */}
            {showRegions && (
              <div className={s.catRow} role="group" aria-labelledby="blog-filter-region">
                <span id="blog-filter-region" className={b.rowLabel}>{t("Region")}</span>
                {regionChips.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={r === activeRegion}
                    className={`${s.catBtn} ${r === activeRegion ? s.catBtnOn : ""}`}
                    onClick={() => chooseRegion(r)}
                  >
                    {t(r)}
                  </button>
                ))}
              </div>
            )}
            {cats.length > 1 && (
              <div
                className={s.catRow}
                role="group"
                {...(showRegions ? { "aria-labelledby": "blog-filter-topic" } : { "aria-label": t("Topic") })}
              >
                {showRegions && <span id="blog-filter-topic" className={b.rowLabel}>{t("Topic")}</span>}
                {cats.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={c === activeCat}
                    className={`${s.catBtn} ${c === activeCat ? s.catBtnOn : ""}`}
                    onClick={() => chooseCat(c)}
                  >
                    {pickPlain(c, lang)}
                  </button>
                ))}
              </div>
            )}
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
            <Link to={`/blog/${featured.slug || featured.id}`} className={s.featured}>
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
                <div className={s.featuredMeta} suppressHydrationWarning>{metaLine(featured.createdAt, pickPlain(metaString(featured.meta, "tag") ?? "", lang), lang, cardMinutes(featured, lang, (body) => pick(body, lang)), t("min read"))}</div>
                <h2 className={s.featuredTitle}>{pick(featured.title, lang)}</h2>
                <p className={s.featuredDesc}>{pick(featured.summary, lang)}</p>
                <div className={s.featuredByline}>
                  <span className={s.featuredAvatar} aria-hidden="true">KF</span>
                  <span className={s.projResult}>{t("Kirollos Fayez")}</span>
                </div>
              </div>
            </Link>
          </Reveal>
        )}

        {/* Every card is in the HTML, so a crawler finds every article from
            here; the ones past the current page are only out of the layout. */}
        <div className={s.grid} id="blog-cards" ref={gridRef}>
          {rest.map((post, i) => {
            const tag = metaString(post.meta, "tag");
            return (
              <Link key={post.id} to={`/blog/${post.slug || post.id}`} className={`${s.card} ${i >= shown ? b.later : ""}`}>
                <Reveal>
                  <div className={s.cardMedia}>
                    {post.media?.[0] ? (
                      <Img src={post.media?.[0]} alt={pick(post.title, lang)} width={420} sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 420px" />
                    ) : (
                      <div className={s.cardMediaFallback}>{pick(post.title, lang)[0]}</div>
                    )}
                    {tag && <span className={s.cardTag}>{pickPlain(tag, lang)}</span>}
                  </div>
                  <div className={s.cardBody}>
                    <div className={s.cardMetaLine} suppressHydrationWarning>{metaLine(post.createdAt, pickPlain(metaString(post.meta, "tag") ?? "", lang), lang, cardMinutes(post, lang, (body) => pick(body, lang)), t("min read"))}</div>
                    <h2 className={s.cardTitle} style={{ marginTop: 10 }}>{pick(post.title, lang)}</h2>
                    <p className={s.cardDesc}>{pick(post.summary, lang)}</p>
                    <span className={s.cardRead}>
                      {t("Read article")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
                    </span>
                  </div>
                </Reveal>
              </Link>
            );
          })}
        </div>

        {rest.length > shown && (
          <div className={b.moreRow}>
            <button type="button" className="btn btn-outline" aria-controls="blog-cards" onClick={showMore}>
              {t("Show more")}
            </button>
          </div>
        )}
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
                {t("Start a conversation")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
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
