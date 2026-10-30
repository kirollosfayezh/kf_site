/** sitemap.xml, with hreflang alternates and image entries. */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  absolute,
  articlePageSeo,
  legalPageSeo,
  languageAlternates,
  localePath,
  projectPageSeo,
  servicePageSeo,
  type ArticleLike,
  type Lang,
} from "../../src/lib/seo/index.ts";
import type { BuildContext } from "./context.ts";

/**
 * When each static page's copy last changed, bumped by hand when it does.
 *
 * `lastmod` used to be the build date, so every deploy told Google that all
 * 32 static pages had just changed — which teaches it to ignore the field.
 * The real date is the newer of this table and the newest CMS item the page
 * lists, so a new blog post updates /blog's date and nothing else's.
 */
export const PAGE_LASTMOD: Record<string, string> = {
  home: "2026-09-25",
  services: "2026-09-25",
  solutions: "2026-09-24",
  projects: "2026-09-25",
  about: "2026-09-24",
  contact: "2026-09-25",
  blog: "2026-09-24",
  campaign: "2026-09-24",
  book: "2026-09-24",
};

/** Which CMS collections feed each static page. */
export function itemsFor(ctx: BuildContext, key: string): ArticleLike[] {
  switch (key) {
    case "home":
      return [...ctx.services, ...ctx.solutions, ...ctx.projects, ...ctx.articles, ...ctx.faqs];
    case "services":
      return ctx.services;
    case "solutions":
      return ctx.solutions;
    case "projects":
      return ctx.projects;
    case "blog":
      return ctx.articles;
    case "contact":
      return ctx.faqs;
    default:
      return [];
  }
}

export const day = (iso: string | undefined) => (iso || "").slice(0, 10);

export function lastmodFor(ctx: BuildContext, key: string): string {
  const dates = [PAGE_LASTMOD[key] ?? "2026-09-01", ...itemsFor(ctx, key).map((i) => day(i.updatedAt || i.createdAt))];
  return dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().at(-1)!;
}

export const ESCAPE: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
export const esc = (v: string) => v.replace(/[&<>"]/g, (c) => ESCAPE[c]);

export async function writeSitemap(distDir: string, origin: string, ctx: BuildContext): Promise<number> {
  // Read `noindex` off the merged table, so a page an editor hides in the
  // dashboard leaves the sitemap in the same build.
  const indexable = Object.entries(ctx.pages).filter(([, p]) => !p.noindex && p.path !== "/404" && p.path !== "/q");

  // One <url> per language variant, each carrying the full alternate set — a
  // sitemap that lists only the English URLs leaves the translations
  // undiscoverable except by crawling.
  const entries = [
    ...indexable.flatMap(([key, p]) =>
      ctx.langs.map((lang) => ({
        loc: absolute(origin, localePath(lang, p.path)),
        lastmod: lastmodFor(ctx, key),
        priority: p.path === "/" ? "1.0" : "0.8",
        path: p.path,
        alternates: ctx.langs.length > 1,
        langs: ctx.langs,
        image: undefined as string | undefined,
      })),
    ),
    // One <url> per language the item genuinely exists in — never four URLs
    // that all resolve to the same English document.
    ...[
      ...ctx.services.map((item) => ({ item, seo: servicePageSeo(item, "en", ctx.langs), priority: "0.8" })),
      ...ctx.projects.map((item) => ({ item, seo: projectPageSeo(item, "en", ctx.langs), priority: "0.7" })),
      ...ctx.articles.map((item) => ({ item, seo: articlePageSeo(item, "en", ctx.langs), priority: "0.6" })),
      ...ctx.legal.map((item) => ({ item, seo: legalPageSeo(item, "en", ctx.langs), priority: "0.3" })),
    ].flatMap(({ item, seo, priority }) => {
      const langs = seo.langs ?? (["en"] as Lang[]);
      return langs.map((lang) => ({
        loc: absolute(origin, localePath(lang, seo.path)),
        // Never "now": a date that changes every deploy is a date Google
        // learns to ignore.
        lastmod: day(item.updatedAt || item.createdAt) || PAGE_LASTMOD.home,
        priority,
        path: seo.path,
        alternates: langs.length > 1,
        langs,
        image: seo.image ? absolute(origin, seo.image) : undefined,
      }));
    }),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${entries
  .map(
    (e) => `  <url>
    <loc>${esc(e.loc)}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <priority>${e.priority}</priority>${
      e.alternates
        ? `\n${languageAlternates(origin, e.path, e.langs)
            .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${esc(a.href)}" />`)
            .join("\n")}`
        : ""
    }${e.image ? `\n    <image:image>\n      <image:loc>${esc(e.image)}</image:loc>\n    </image:image>` : ""}
  </url>`,
  )
  .join("\n")}
</urlset>
`;

  await writeFile(join(distDir, "sitemap.xml"), xml, "utf8");
  return entries.length;
}
