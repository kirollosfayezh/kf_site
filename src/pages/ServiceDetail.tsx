import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { useSeo } from "../components/Seo";
import { PAGES, serviceHeadline, serviceLede, servicePageSeo, servicePath, type PageSeo } from "../lib/seo";
import { pick, pickPlain, metaString } from "../lib/content-helpers";
import { renderRichText, extractFaq } from "../lib/rich-text";
import { useContentItem, useContentList } from "../hooks/useContent";
import { Reveal } from "../components/Reveal";
import { BalancedGrid } from "../components/BalancedGrid";
import { Img } from "../components/Img";
import { ServiceIcon } from "../components/ServiceIcon";
import { ProjectGallery, galleryImages } from "../components/ProjectGallery";
import { useWhatsAppLink } from "../hooks/useWhatsAppLink";
import s from "../styles/sections.module.css";

/** Project slugs a body links to, in order — the write-up already names the
 *  work that proves the service, so that is what "related projects" shows. */
function linkedProjects(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(/\]\(\/projects\/([a-z0-9-]+)\)/g)) if (!out.includes(m[1])) out.push(m[1]);
  return out;
}

/**
 * One service's landing page, `/services/<slug>`.
 *
 * /services is a grid of eight cards, which gives Google one page to rank for
 * eight different searches. Each service here has its own URL, headline, long
 * write-up and FAQ in every language it is written in — all edited per
 * service in the dashboard (body) or its Markdown source.
 */
export function ServiceDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { t, lang, available } = useI18n();
  const { data: item, loading, error } = useContentItem("services", slug);
  const services = useContentList("services");
  const projects = useContentList("projects");
  const waLink = useWhatsAppLink(item ? pick(item.title, lang) : undefined);

  const body = item ? pick(item.body, lang) : "";
  const { blocks, headings } = useMemo(() => renderRichText(body), [body]);
  const faq = useMemo(() => extractFaq(body), [body]);

  // Same contract as the case-study page: keep the prerendered tags until the
  // item lands, and a noindex entry if it never does.
  const seo = useMemo<PageSeo | null>(
    () => (item ? servicePageSeo(item, lang, available, faq) : error ? PAGES.notFound : null),
    [item, error, lang, available, faq],
  );
  useSeo(seo);

  const related = useMemo(() => {
    const all = projects.data ?? [];
    const named = linkedProjects(body)
      .map((sl) => all.find((p) => p.slug === sl))
      .filter((p): p is NonNullable<typeof p> => !!p);
    return named.slice(0, 3);
  }, [projects.data, body]);

  const others = useMemo(
    () => (services.data ?? []).filter((x) => x.slug !== item?.slug && x.id !== item?.id),
    [services.data, item?.slug, item?.id],
  );

  if (loading) {
    return (
      <p className={s.state} style={{ paddingTop: 160 }}>
        {t("Loading…")}
      </p>
    );
  }

  if (error || !item) {
    return (
      <div className={s.state} style={{ paddingTop: 160 }}>
        <p>{t("We couldn't load this service. It may have been unpublished, or the connection dropped.")}</p>
        <Link to="/services" style={{ color: "var(--brand-orange)", display: "inline-block", marginTop: 14 }}>
          <span className="kf-arrow" aria-hidden="true">&larr;</span> {t("View all services")}
        </Link>
      </div>
    );
  }

  const headline = serviceHeadline(item, lang);
  const lede = serviceLede(item, lang);
  const photo = item.media?.[0];
  const hasBody = body.trim().length > 0 && body.trim() !== lede;

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
              /{" "}
              <Link to="/services" style={{ color: "var(--text3)" }}>
                {t("Services")}
              </Link>
            </nav>
            <span className={s.eyebrow} style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <ServiceIcon slug={item.slug} />
              {pick(item.title, lang)}
            </span>
            <h1 className={s.pageTitle}>{headline}</h1>
            {lede && <p className={s.pageLede}>{lede}</p>}
            <div className={s.caseActions}>
              <Link to="/contact" className="btn btn-primary" data-track="service.hero.quote">
                {t("Get a quote")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
              </Link>
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline" data-track="service.hero.whatsapp">
                {t("WhatsApp us")}
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {photo && (
        <figure className={s.artFigure}>
          <Img
            src={photo}
            alt={metaString(item.meta, "alt") || headline}
            width={1200}
            sizes="(max-width: 1280px) 100vw, 1200px"
            priority
            style={{ width: "100%", aspectRatio: "21 / 9", objectFit: "cover", borderRadius: 16, border: "1px solid var(--border)" }}
          />
        </figure>
      )}

      <div className={s.artLayout}>
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
          {hasBody ? (
            <Reveal className="kf-prose">{blocks}</Reveal>
          ) : (
            <Reveal className="kf-prose">
              <ul>
                {(Array.isArray(item.meta?.points) ? (item.meta.points as string[]) : []).map((pt) => (
                  <li key={pt}>{pickPlain(pt, lang)}</li>
                ))}
              </ul>
            </Reveal>
          )}

          <aside className={s.artCta}>
            <div className={s.artCtaTitle}>{t("Not sure which service you need?")}</div>
            <p className={s.artCtaBody}>
              {t("Tell us the problem you're trying to solve and we'll recommend the right approach.")}
            </p>
            <Link to="/contact" className="btn btn-primary" data-track="service.cta.quote">
              {t("Get a quote")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
            </Link>
          </aside>
        </div>
      </div>

      {related.length > 0 && (
        <section className={s.section} style={{ paddingTop: 20 }}>
          <Reveal className={s.head}>
            <div style={{ maxWidth: 640 }}>
              <span className={s.eyebrow}>{t("// PROJECTS")}</span>
              <h2 className={s.h2}>{t("Work we've delivered")}</h2>
            </div>
            <Link to="/projects" className={s.viewAll}>
              {t("See more work")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
            </Link>
          </Reveal>
          <BalancedGrid preset="wide">
            {related.map((p, i) => {
              const title = pick(p.title, lang);
              const images = galleryImages(p.media);
              return (
                <Link key={p.id} to={`/projects/${p.slug || p.id}`} className={s.card} style={{ borderRadius: 20 }}>
                  <div className={s.cardMedia} style={{ aspectRatio: "16/10" }}>
                    {images.length ? (
                      <ProjectGallery
                        images={images}
                        alt={title}
                        width={420}
                        sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 420px"
                        offset={i * 350}
                      />
                    ) : (
                      <div className={s.cardMediaFallback}>{title[0]}</div>
                    )}
                  </div>
                  <div className={s.cardBody} style={{ padding: 24 }}>
                    <h3 className={s.cardTitle}>{title}</h3>
                    <p className={s.cardDesc}>{pick(p.summary, lang)}</p>
                  </div>
                </Link>
              );
            })}
          </BalancedGrid>
        </section>
      )}

      {others.length > 0 && (
        <section className={s.section} style={{ paddingTop: 20 }}>
          <Reveal className={s.head}>
            <div style={{ maxWidth: 640 }}>
              <span className={s.eyebrow}>{t("// SERVICES")}</span>
              <h2 className={s.h2}>{t("Other services")}</h2>
            </div>
            <Link to="/services" className={s.viewAll}>
              {t("View all services")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
            </Link>
          </Reveal>
          <BalancedGrid preset="cards">
            {others.map((o) => (
              <Link key={o.id} to={servicePath(o.slug || o.id)} className={s.card} data-track="service.other">
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
            <Link to="/contact" className="btn btn-primary" data-track="service.final.start-project">
              {t("Start Your Project")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
            </Link>
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-outline" data-track="service.final.whatsapp">
              {t("WhatsApp us")}
            </a>
          </div>
        </Reveal>
      </section>
    </article>
  );
}
