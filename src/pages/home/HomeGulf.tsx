import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../../lib/i18n";
import { marketLinks, type MarketLink } from "../../lib/seo";
import { useContentList } from "../../hooks/useContent";
import { Reveal } from "../../components/Reveal";
import s from "../../styles/sections.module.css";
import g from "./HomeGulf.module.css";
import { GULF_FACTS } from "./gulf";

/**
 * The published country pages, in this language where they are written.
 * Empty until the markets list arrives — the prerender carries it, so the
 * build and the first browser render agree — and empty for any page not
 * published, so no link ever points at a URL with no file.
 */
export function useMarketLinks(slugs?: readonly string[]): MarketLink[] {
  const { lang } = useI18n();
  const links = marketLinks(useContentList("markets").data, lang);
  return slugs ? links.filter((m) => slugs.includes(m.slug)) : links;
}

/**
 * A link to a country page. One that is not written in this language goes to
 * the English page by a plain href, as the footer's do: the router would put
 * it under this language's prefix, which has no file.
 */
export function MarketAnchor({ link, className, track, children }: { link: MarketLink; className?: string; track: string; children: ReactNode }) {
  return link.translated ? (
    <Link to={link.path} className={className} data-track={track}>
      {children}
    </Link>
  ) : (
    <a href={link.path} hrefLang="en" className={className} data-track={track}>
      {children}
    </a>
  );
}

/**
 * A slim band for buyers in Saudi Arabia and the UAE: three plain facts
 * (working week, hours, Arabic-first) and the country pages that exist. It
 * names no client, office or integration — only what is true of every project.
 */
export function HomeGulf() {
  const { t } = useI18n();
  const markets = useMarketLinks();
  return (
    <section className={g.wrap} id="gulf">
      <Reveal className={g.band}>
        <div className={g.head}>
          <span className="kf-label">{t("Saudi Arabia · UAE · Gulf")}</span>
          <h2 className={g.title}>{t("Working with Saudi Arabia and the UAE")}</h2>
          <p className={g.lede}>{t("Remote delivery from Cairo, in Arabic or English.")}</p>
          <div className={g.links}>
            {markets.map((m) => (
              <MarketAnchor key={m.slug} link={m} className={s.textLink} track={`home.gulf.${m.slug}`}>
                {t(m.name)} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
              </MarketAnchor>
            ))}
            {markets.length === 0 && (
              <Link to="/contact" className={s.textLink} data-track="home.gulf.contact">
                {t("Start a project")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
              </Link>
            )}
          </div>
        </div>
        <ul className={g.facts}>
          {GULF_FACTS.map((f) => (
            <li key={f.n} className={g.fact}>
              <span className={g.factNo}>{f.n}</span>
              <span>
                <b className={g.factTitle}>{t(f.title)}</b>
                <span className={g.factDesc}>{t(f.desc)}</span>
              </span>
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
