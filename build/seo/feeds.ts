/** One RSS 2.0 feed per enabled language. */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  PAGES,
  LOCALES,
  absolute,
  articlePageSeo,
  availableLangs,
  localePath,
  resolveDesc,
  resolveTitle,
} from "../../src/lib/seo/index.ts";
import type { BuildContext } from "./context.ts";
import { esc } from "./sitemap.ts";

/**
 * One RSS 2.0 feed per enabled language: `/feed.xml` for English and
 * `/<lang>/feed.xml` for the rest, each listing the posts written in that
 * language. A feed with no items is still a valid feed — better than a
 * language whose feed link 404s.
 */
export async function writeFeeds(distDir: string, origin: string, ctx: BuildContext): Promise<number> {
  const rfc822 = (iso: string | undefined) => {
    const d = new Date(iso || 0);
    return Number.isNaN(d.getTime()) ? new Date(0).toUTCString() : d.toUTCString();
  };
  let count = 0;
  for (const lang of ctx.langs) {
    const posts = ctx.articles
      .filter((p) => availableLangs(p, ctx.langs).includes(lang))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    const self = absolute(origin, localePath(lang, "/feed.xml"));
    const blog = ctx.pages.blog ?? PAGES.blog;
    const newest = posts.map((p) => p.updatedAt || p.createdAt).sort().at(-1);
    const items = posts
      .map((post) => {
        const page = articlePageSeo(post, lang, ctx.langs);
        const link = absolute(origin, localePath(lang, page.path));
        const category = typeof post.meta?.tag === "string" ? post.meta.tag : "";
        return `    <item>
      <title>${esc(resolveTitle(page, lang).split(" | ")[0])}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="true">${esc(link)}</guid>
      <pubDate>${rfc822(post.createdAt)}</pubDate>
      <description>${esc(resolveDesc(page, lang))}</description>${
        category ? `\n      <category>${esc(category)}</category>` : ""
      }
    </item>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(resolveTitle(blog, lang).split(" | ")[0])}</title>
    <link>${esc(absolute(origin, localePath(lang, blog.path)))}</link>
    <description>${esc(resolveDesc(blog, lang))}</description>
    <language>${LOCALES[lang].hreflang}</language>
    <lastBuildDate>${rfc822(newest)}</lastBuildDate>
    <atom:link href="${esc(self)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
    const target = join(distDir, localePath(lang, "/feed.xml").replace(/^\//, ""));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, xml, "utf8");
    count++;
  }
  return count;
}
