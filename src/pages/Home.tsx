import { useMemo } from "react";
import { useI18n } from "../lib/i18n";
import { useFaqSchema } from "../components/Seo";
import { pick } from "../lib/content-helpers";
import { useContentList } from "../hooks/useContent";
import { FALLBACK_FAQS } from "../lib/fallback-content";
import { Testimonials } from "../components/Testimonials";
import { useWhatsAppLink } from "../hooks/useWhatsAppLink";
import { HomeHero } from "./home/HomeHero";
import { HomeValues } from "./home/HomeValues";
import { HomeServices } from "./home/HomeServices";
import { HomeAiAutomation } from "./home/HomeAiAutomation";
import { HomeSolutions } from "./home/HomeSolutions";
import { HomeProjects } from "./home/HomeProjects";
import { HomeProcess } from "./home/HomeProcess";
import { HomeWhy } from "./home/HomeWhy";
import { HomeAbout } from "./home/HomeAbout";
import { HomeFaq } from "./home/HomeFaq";
import { HomeFinalCta } from "./home/HomeFinalCta";

/**
 * The homepage: a sequence of sections, each in `./home/`. The CMS reads stay
 * here, so every list is requested in the same order as before and the FAQ
 * schema is built from the same items the accordion renders.
 */
export function Home() {
  const { t, lang } = useI18n();
  const waLink = useWhatsAppLink();

  const services = useContentList("services");
  const solutions = useContentList("solutions");
  const projects = useContentList("projects");
  const faqs = useContentList("faqs");

  const faqItems = useMemo(
    () =>
      faqs.data && faqs.data.length > 0
        ? faqs.data.map((f) => ({ q: pick(f.title, lang), a: pick(f.body ?? f.summary, lang) }))
        : FALLBACK_FAQS.map((f) => ({ q: t(f.q), a: t(f.a) })),
    [faqs.data, lang, t],
  );
  // The FAQPage schema comes from the same list the accordion renders.
  useFaqSchema(faqItems);

  return (
    <div>
      <HomeHero />
      <HomeValues />
      <HomeServices services={services.data} />
      <HomeAiAutomation />
      <HomeSolutions solutions={solutions.data} />
      <HomeProjects projects={projects.data} />
      <HomeProcess />
      <HomeWhy />
      <HomeAbout waLink={waLink} />

      {/* CLIENTS — from the dashboard's Testimonials collection; renders
          nothing until at least one is published. */}
      <Testimonials limit={6} />

      <HomeFaq items={faqItems} />
      <HomeFinalCta waLink={waLink} />
    </div>
  );
}
