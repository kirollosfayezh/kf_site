import { Link } from "react-router-dom";
import { useI18n } from "../../lib/i18n";
import { pick, isConcept } from "../../lib/content-helpers";
import h from "../Home.module.css";
import type { ContentItem } from "../../services/api-types";
import { HERO_MARQUEE } from "./data";

/**
 * Two ribbons in the brand's colours crossing in an X under the hero: what we
 * build on the gradient one, who we built it for on the orange one, moving in
 * opposite directions. Every item is a link — services to their pages,
 * clients to their case studies (delivered projects only, never the concept
 * demos). Each list is repeated once so the loop is seamless; the copy is
 * hidden from screen readers and the tab order. Hovering a ribbon stops it.
 */
export function HomeRibbons({ projects }: { projects: ContentItem[] | null }) {
  const { t, lang } = useI18n();
  const seen = new Set<string>();
  const clients = (projects ?? [])
    .filter((p) => !isConcept(p.meta))
    .map((p) => ({ name: pick(p.title, lang).split(/[:—–|]/)[0].trim(), slug: p.slug || p.id }))
    .filter((c) => c.name && !seen.has(c.name) && seen.add(c.name));

  return (
    <section className={h.ribbons} aria-label={t("Clients")}>
      {clients.length >= 3 && (
        <div className={`${h.ribbon} ${h.ribbonBack}`}>
          <ul className={`${h.ribbonTrack} ${h.ribbonTrackReverse}`}>
            {[...clients, ...clients].map((c, i) => {
              const copy = i >= clients.length;
              return (
                <li key={i} aria-hidden={copy || undefined}>
                  <Link to={`/projects/${c.slug}`} className={h.ribbonClient} data-track="home.clients" tabIndex={copy ? -1 : undefined}>
                    {c.name}
                    <span className="kf-arrow" aria-hidden="true">&rarr;</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <nav className={`${h.ribbon} ${h.ribbonFront}`} aria-label={t("Services")}>
        <div className={h.ribbonTrack}>
          {[...HERO_MARQUEE, ...HERO_MARQUEE].map((m, i) => {
            const copy = i >= HERO_MARQUEE.length;
            return (
              <Link key={i} to={`/services/${m.slug}`} className={h.ribbonService} data-track="hero.marquee" aria-hidden={copy || undefined} tabIndex={copy ? -1 : undefined}>
                {t(m.label)}
                <span className={h.ribbonStar} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      </nav>
    </section>
  );
}
