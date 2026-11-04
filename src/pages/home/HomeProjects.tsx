import { Link } from "react-router-dom";
import { useI18n } from "../../lib/i18n";
import { pick, pickPlain, metaString, isConcept } from "../../lib/content-helpers";
import { FALLBACK_PROJECTS } from "../../lib/fallback-content";
import { Reveal } from "../../components/Reveal";
import { Img } from "../../components/Img";
import { galleryImages } from "../../components/ProjectGallery";
import s from "../../styles/sections.module.css";
import h from "../Home.module.css";
import type { ContentItem } from "../../services/api-types";

/**
 * Client work, shown as the product itself: each project's real screen in a
 * browser frame, scrolling down the page on hover. Concept demos have their
 * own section on /projects.
 */
export function HomeProjects({ projects }: { projects: ContentItem[] | null }) {
  const { t, lang } = useI18n();
  const items =
    projects && projects.some((p) => !isConcept(p.meta))
      ? projects
          .filter((p) => !isConcept(p.meta))
          .slice(0, 4)
          .map((item) => ({
            key: item.id,
            slug: item.slug || item.id,
            tag: metaString(item.meta, "tag") ?? "",
            title: pick(item.title, lang),
            desc: pick(item.summary, lang),
            image: galleryImages(item.media)[0],
          }))
      : FALLBACK_PROJECTS.map((f) => ({ key: f.key, slug: undefined as string | undefined, tag: f.tag ?? "", title: t(f.title), desc: t(f.desc), image: f.img }));
  return (
    <section className={s.section} id="work">
      <Reveal className={s.head}>
        <div className={s.headText}>
          <span className="kf-label">{t("Selected work")}</span>
          <h2 className={s.h2}>{t("From ideas to real products.")}</h2>
        </div>
        <Link to="/projects" className={s.viewAll} data-track="home.projects.view-all">
          {t("View all projects")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
        </Link>
      </Reveal>
      <div className={h.workGrid}>
        {items.map((item, i) => (
          <Reveal key={item.key} as={Link} to={item.slug ? `/projects/${item.slug}` : "/projects"} className={h.workCard} style={{ animationDelay: `${(i % 2) * 90}ms` }}>
            <span className={h.browser}>
              <span className={h.browserBar} aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className={h.browserScreen}>
                {item.image ? (
                  <Img src={item.image} alt={item.title} width={640} sizes="(max-width: 800px) 100vw, 640px" className={h.browserImg} />
                ) : (
                  <span className={h.browserEmpty}>{item.title[0]}</span>
                )}
              </span>
            </span>
            <span className={h.workMeta}>
              {item.tag && <span className={h.workTag}>{pickPlain(item.tag, lang)}</span>}
              <h3 className={h.workTitle}>{item.title}</h3>
              <span className={h.workDesc}>{item.desc}</span>
              <span className={h.svcMore}>
                {t("View project")} <span className="kf-arrow" aria-hidden="true">&rarr;</span>
              </span>
            </span>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
