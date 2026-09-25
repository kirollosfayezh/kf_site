import { useI18n } from "../lib/i18n";
import { pick, metaString, initials } from "../lib/content-helpers";
import { useContentList } from "../hooks/useContent";
import { Reveal } from "./Reveal";
import { BalancedGrid } from "./BalancedGrid";
import { Img } from "./Img";
import s from "../styles/sections.module.css";
import css from "./Testimonials.module.css";

/**
 * Client quotes from the dashboard's Testimonials collection.
 *
 * The collection existed and the dashboard promised it was "shown on the
 * homepage", but nothing ever rendered it; the only quotes on the site were
 * three hardcoded names on the campaign page. Now: title = the client's name,
 * summary/body = the quote, `meta.authorRole` / `meta.company` / `meta.rating`
 * / `meta.sourceUrl` the details, `media[0]` the portrait.
 *
 * Nothing renders until something is published — no placeholder quotes. And
 * deliberately no `Review` or `AggregateRating` markup: reviews a business
 * publishes about itself are "self-serving" in Google's terms and are not
 * eligible for stars; marking them up invites a manual action, not a rich
 * result. The quotes are plain `<figure>`/`<blockquote>` prose.
 */
export function Testimonials({ limit }: { limit?: number }) {
  const { t, lang } = useI18n();
  const { data } = useContentList("testimonials");
  const items = (data ?? []).filter((x) => x.published !== false).slice(0, limit);
  if (!items.length) return null;

  return (
    <section className={s.section}>
      <Reveal className={s.headCenter}>
        <span className={s.eyebrow}>{t("// CLIENTS")}</span>
        <h2 className={s.h2sm}>{t("What clients say")}</h2>
      </Reveal>
      <BalancedGrid preset="cards">
        {items.map((item) => {
          const name = pick(item.title, lang);
          const quote = pick(item.body, lang) || pick(item.summary, lang);
          // Rows seeded before the dedicated fields existed keep "Role, Company"
          // in the tag; split it so they read the same as new rows.
          const legacy = (metaString(item.meta, "tag") ?? "").split(/,\s*/);
          const role = metaString(item.meta, "authorRole") ?? legacy[0] ?? "";
          const company = metaString(item.meta, "company") ?? legacy.slice(1).join(", ");
          const rawRating = Number(item.meta?.rating);
          const rating = Number.isInteger(rawRating) && rawRating >= 1 && rawRating <= 5 ? rawRating : 0;
          const sourceUrl = metaString(item.meta, "sourceUrl");
          const source = sourceUrl && /^https?:\/\//.test(sourceUrl) ? sourceUrl : undefined;
          const portrait = item.media?.[0];
          const who = [role, company].filter(Boolean).join(", ");

          return (
            <Reveal key={item.id} as="figure" className={s.quoteCard}>
              <blockquote className={s.quoteText}>&ldquo;{quote}&rdquo;</blockquote>
              <figcaption className={s.quoteWho}>
                {portrait ? (
                  <Img src={portrait} alt="" width={56} sizes="56px" className={css.portrait} />
                ) : (
                  <span className={s.quoteAvatar} aria-hidden="true">{initials(name)}</span>
                )}
                <span>
                  <span className={s.quoteName} style={{ display: "block" }}>{name}</span>
                  {who ? <span className={s.quoteRole}>{who}</span> : null}
                  {rating ? (
                    <span className={css.stars} role="img" aria-label={`${t("Rating")}: ${rating}/5`}>
                      {"★".repeat(rating)}
                      {"☆".repeat(5 - rating)}
                    </span>
                  ) : null}
                  {source ? (
                    <a href={source} target="_blank" rel="noopener noreferrer nofollow" className={css.source} data-track="testimonial.source">
                      {t("View review")}
                    </a>
                  ) : null}
                </span>
              </figcaption>
            </Reveal>
          );
        })}
      </BalancedGrid>
    </section>
  );
}
