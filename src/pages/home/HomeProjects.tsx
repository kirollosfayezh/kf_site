import { Link } from "react-router-dom";
import { useI18n } from "../../lib/i18n";
import { pick, pickPlain, metaString } from "../../lib/content-helpers";
import { FALLBACK_PROJECTS } from "../../lib/fallback-content";
import { Reveal } from "../../components/Reveal";
import { BalancedGrid } from "../../components/BalancedGrid";
import { ProjectGallery, galleryImages } from "../../components/ProjectGallery";
import s from "../../styles/sections.module.css";
import type { ContentItem } from "../../services/api-types";

/** The four latest projects, linking to their case studies where they have one. */
export function HomeProjects({ projects }: { projects: ContentItem[] | null }) {
  const { t, lang } = useI18n();
  return (
    <section className={s.section}>
      <Reveal className={s.head}>
        <div style={{ maxWidth: 640 }}>
          <span className={s.eyebrow}>// {t("PROJECTS") || "PROJECTS"}</span>
          <h2 className={s.h2}>{t("From ideas to real products.")}</h2>
        </div>
        <Link to="/projects" className={s.viewAll} data-track="home.projects.view-all">
          {t("View all projects")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
        </Link>
      </Reveal>
      <BalancedGrid preset="wide">
        {(projects && projects.length > 0
          ? projects.slice(0, 4).map((item) => ({
              key: item.id,
              slug: item.slug || item.id,
              // `tag`, not `category` — the seeder writes `meta.tag`, so this
              // read was always empty and the project chips on the homepage
              // rendered blank against live CMS data (they only appeared in
              // the static fallback path).
              category: metaString(item.meta, "tag") ?? "",
              title: pick(item.title, lang),
              desc: pick(item.summary, lang),
              images: galleryImages(item.media),
            }))
          : FALLBACK_PROJECTS.map((f) => ({ key: f.key, slug: undefined as string | undefined, category: f.tag ?? "", title: t(f.title), desc: t(f.desc), images: f.img ? [f.img] : [] }))
        ).map((item, i) => (
          <Reveal key={item.key} as="article" className={s.card} style={{ borderRadius: 20 }}>
            <div className={s.cardMedia} style={{ aspectRatio: "16/10" }}>
              {item.images.length ? (
                <ProjectGallery images={item.images} alt={item.title} width={420} sizes="(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 420px" offset={(i % 2) * 400} />
              ) : (
                <div className={s.cardMediaFallback}>{item.title[0]}</div>
              )}
              {item.category && <span className={s.cardTag}>{pickPlain(item.category, lang)}</span>}
            </div>
            <div className={s.cardBody} style={{ padding: 24 }}>
              <h3 className={s.cardTitle} style={{ fontSize: "var(--fs-section)" }}>{item.title}</h3>
              <p className={s.cardDesc}>{item.desc}</p>
              {/* Straight to the case study when the project has one; the
                  static fallbacks have no page, so they keep pointing at the
                  gallery rather than at a URL that would 404. */}
              <Link to={item.slug ? `/projects/${item.slug}` : "/projects"} className={s.textLink} style={{ marginTop: 16 }}>
                {t("View project")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
              </Link>
            </div>
          </Reveal>
        ))}
      </BalancedGrid>
    </section>
  );
}
