import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { dirOf, type Lang } from "../lib/langs";
import { useSeo } from "../components/Seo";
import { MARKETS, PAGES, marketLangs, marketPageSeo, servicePath, type PageSeo } from "../lib/seo";
import { pick } from "../lib/content-helpers";
import { renderRichText, extractFaq } from "../lib/rich-text";
import { useContentItem, useContentList } from "../hooks/useContent";
import { Reveal } from "../components/Reveal";
import { BalancedGrid } from "../components/BalancedGrid";
import { ServiceIcon } from "../components/ServiceIcon";
import { useWhatsAppLink } from "../hooks/useWhatsAppLink";
import { NotFound } from "./NotFound";
import s from "../styles/sections.module.css";

/**
 * A country page: `/saudi-arabia`, `/uae`, and `/gulf` for Kuwait, Qatar,
 * Bahrain and Oman. Laid out like a service landing page (`ServiceDetail`):
 * heading and intro, the long Markdown write-up with its contents list and
 * FAQ, then the services it leads to.
 *
 * The copy is the "markets" CMS item of the same slug, in English and Arabic
 * only (`marketLangs`). Any other language shows the English page under the
 * translated interface, and its SEO entry points the canonical at the English
 * URL. With no published item the route is a 404 — the build prerenders a
 * country page only once its item exists, so until then the URL has no file.
 */
export function MarketDetail({ slug }: { slug: string }) {
  const { t, lang, available } = useI18n();
  const { data: item, loading, error } = useContentItem("markets", slug);
  const services = useContentList("services");

  // The language the copy is shown in: this one when the page is written in
  // it, else English. Never a German or French text typed into the dashboard.
  const copyLang: Lang = item && marketLangs(item, available).includes(lang) ? lang : "en";
  const waLink = useWhatsAppLink(item ? pick(item.title, copyLang) : undefined);
  const body = item ? pick(item.body, copyLang) : "";
  const { blocks, headings } = useMemo(() => renderRichText(body), [body]);
  const faq = useMemo(() => extractFaq(body), [body]);

  // Same contract as the service page: keep the prerendered tags until the
  // item lands, and the noindex not-found entry if it never does.
  const seo = useMemo<PageSeo | null>(
    () => (item ? marketPageSeo(item, lang, available, faq) : error ? PAGES.notFound : null),
    [item, error, lang, available, faq],
  );
  useSeo(seo);

  if (loading) {
    return (
      <p className={s.state} style={{ paddingTop: 160 }}>
        {t("Loading…")}
      </p>
    );
  }

  if (error || !item) return <NotFound />;

  const name = MARKETS.find((m) => m.slug === slug)?.name;
  const title = pick(item.title, copyLang);
  const lede = pick(item.summary, copyLang);
  // English copy under a translated interface says so, for screen readers and
  // for the browser's own text direction.
  const copyAttrs = copyLang === lang ? {} : { lang: copyLang, dir: dirOf(copyLang) };

  return (
    <article>
      <section className={s.pageHero}>
        <div className={s.pageHeroGlow} aria-hidden="true" />
        <div className={s.pageHeroInner} style={{ maxWidth: 820 }}>
          <Reveal>
            <nav aria-label={t("Breadcrumb")} className={s.breadcrumb}>
              <Link to="/" style={{ color: "var(--text3)" }}>
                {t("Home")}
              </Link>{" "}
              / {name ? t(name) : title}
            </nav>
            <h1 className={s.pageTitle} {...copyAttrs}>
              {title}
            </h1>
            {lede && (
              <p className={s.pageLede} {...copyAttrs}>
                {lede}
              </p>
            )}
            <div className={s.caseActions}>
              <Link to="/contact" className="btn btn-primary" data-track="market.hero.quote">
                {t("Get a quote")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
              </Link>
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline" data-track="market.hero.whatsapp">
                {t("WhatsApp us")}
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      <div className={s.artLayout}>
        {headings.length >= 3 && (
          <nav className={s.artToc} aria-label={t("On this page")}>
            <div className={s.artTocLabel}>{t("On this page")}</div>
            <ul className={s.artTocList} {...copyAttrs}>
              {headings.map((h) => (
                <li key={h.id} className={h.level === 3 ? s.artTocSub : undefined}>
                  <a href={`#${h.id}`}>{h.text}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}

        <div className={s.artMain}>
          <Reveal className="kf-prose" {...copyAttrs}>
            {blocks}
          </Reveal>

          <aside className={s.artCta}>
            <div className={s.artCtaTitle}>{t("Not sure which service you need?")}</div>
            <p className={s.artCtaBody}>
              {t("Tell us the problem you're trying to solve and we'll recommend the right approach.")}
            </p>
            <Link to="/book" className="btn btn-primary" data-track="market.cta.book">
              {t("Book a call")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
            </Link>
          </aside>
        </div>
      </div>

      {(services.data ?? []).length > 0 && (
        <section className={s.section} style={{ paddingTop: 20 }}>
          <Reveal className={s.head}>
            <div style={{ maxWidth: 640 }}>
              <span className={s.eyebrow}>{t("// SERVICES")}</span>
              <h2 className={s.h2}>{t("What we build")}</h2>
            </div>
            <Link to="/services" className={s.viewAll}>
              {t("View all services")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
            </Link>
          </Reveal>
          <BalancedGrid preset="cards">
            {(services.data ?? []).map((o) => (
              <Link key={o.id} to={servicePath(o.slug || o.id)} className={s.card} data-track="market.service">
                <div className={s.cardBody} style={{ padding: 22 }}>
                  <div className={s.svcIconBadge} style={{ position: "static", marginBottom: 14 }}>
                    <ServiceIcon slug={o.slug} />
                  </div>
                  <h3 className={s.cardTitle}>{pick(o.title, lang)}</h3>
                  <p className={s.cardDesc}>{pick(o.summary, lang)}</p>
                </div>
              </Link>
            ))}
          </BalancedGrid>
        </section>
      )}

      <section className={s.finalCta}>
        <div className={s.finalCtaGlow} aria-hidden="true" />
        <Reveal className={s.finalCtaInner}>
          <h2 className={s.finalCtaTitle}>{t("Want something like this?")}</h2>
          <p className={s.finalCtaLede}>
            {t("Tell us what you're building and we'll turn it into a real, working product.")}
          </p>
          <div className={s.finalCtaActions}>
            <Link to="/contact" className="btn btn-primary" data-track="market.final.start-project">
              {t("Start Your Project")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
            </Link>
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline" data-track="market.final.whatsapp">
              {t("WhatsApp us")}
            </a>
          </div>
        </Reveal>
      </section>
    </article>
  );
}
