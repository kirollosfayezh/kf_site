/** The per-run snapshot every writer shares. */
import { type ArticleLike, type Lang, type PageSeo } from "../../src/lib/seo/index.ts";
import type { SiteSettings } from "../../src/services/api-types.ts";

/** Everything one build run needs, fetched once and shared by every writer —
 *  so the sitemap and the prerendered pages can never list different sets. */
export interface BuildContext {
  pages: Record<string, PageSeo>;
  settings: SiteSettings | null;
  articles: ArticleLike[];
  projects: ArticleLike[];
  legal: ArticleLike[];
  services: ArticleLike[];
  solutions: ArticleLike[];
  faqs: ArticleLike[];
  testimonials: ArticleLike[];
  aboutSections: ArticleLike[];
  promos: ArticleLike[];
  translations: Partial<Record<Lang, Record<string, string>>>;
  langs: Lang[];
  twitterSite?: string;
  overrides: number;
}
