import { LANGS, type Lang } from "../langs.ts";
import { projectSchema } from "./cms.ts";
import { PAGES } from "./pages.ts";
import { organisationSchema, websiteSchema } from "./schema/organisation.ts";
import { articleSchema, breadcrumbSchema, faqSchema } from "./schema/page.ts";
import { serviceCatalogSchema, serviceSchemas } from "./schema/services.ts";
import { servicePageSchema } from "./service-page.ts";
import { OG_IMAGE, OG_IMAGE_ALT, SITE } from "./site.ts";
import { fitDesc, fitTitle, resolveDesc, resolveTitle, tr } from "./text.ts";
import type { PageSeo } from "./types.ts";
import { LOCALES, absolute, languageAlternates, localePath } from "./urls.ts";

/**
 * The single source of truth for what a page's <head> contains.
 *
 * Both consumers derive from this list: `Seo.tsx` turns descriptors into DOM
 * nodes at runtime, and the `seo-prerender` Vite plugin turns the same
 * descriptors into static HTML at build time. Keeping one list means a crawler
 * that never runs JavaScript and a browser that does can't disagree about what
 * the page claims to be.
 */
export type SeoTag =
  | { kind: "title"; text: string }
  | { kind: "meta"; attr: "name" | "property"; key: string; content: string }
  | { kind: "link"; rel: string; href: string; hreflang?: string; type?: string; title?: string }
  | { kind: "jsonld"; data: unknown };

/** Site-wide inputs the tag builder needs beyond the page itself. */
export interface SeoOptions {
  /**
   * The languages the site currently serves, from the dashboard's language
   * list. hreflang, `og:locale:alternate` and the schema's language fields are
   * limited to these — advertising a German alternate while German is switched
   * off points crawlers at pages that render in English.
   */
  siteLangs?: readonly Lang[];
  /** The site's X handle (`@kftech`), for `twitter:site`. */
  twitterSite?: string;
}

/**
 * `origin` may be empty when `VITE_SITE_URL` was not set at build time. The
 * tags that need an absolute URL — canonical, hreflang, og:url and the JSON-LD
 * graph, which is keyed by absolute @id — are then omitted rather than emitted
 * with a guessed or relative origin: a canonical pointing at the wrong host is
 * far more damaging than a missing one. Everything origin-independent (title,
 * description, robots, the OG/Twitter card) still ships, and at runtime the
 * client re-applies the full set using the origin actually serving the page.
 */
export function seoTags(page: PageSeo, lang: Lang, origin: string, opts: SeoOptions = {}): SeoTag[] {
  const siteLangs = opts.siteLangs ?? LANGS;
  // The canonical is the URL *for this language*. Pointing every translation at
  // the English path is what invalidated the hreflang cluster before.
  // Only prefix the path for a language the page actually exists in — and the
  // site currently serves; anything else canonicalises to the English URL
  // rather than to a page that is not there.
  const available = (page.langs ?? siteLangs).filter((l) => siteLangs.includes(l));
  const url = absolute(origin, available.includes(lang) ? localePath(lang, page.path) : page.path);
  const image = page.image || OG_IMAGE;
  // Dimensions are claimed for the branded default and for CMS photos that
  // went through `ogImageUrl`; a wrong claim makes the card get dropped.
  const imageSized = !page.image || page.imageSized === true;
  const title = fitTitle(resolveTitle(page, lang));
  const desc = fitDesc(resolveDesc(page, lang));
  const tags: SeoTag[] = [{ kind: "title", text: title }];

  const m = (attr: "name" | "property", key: string, content?: string) => {
    if (content) tags.push({ kind: "meta", attr, key, content });
  };

  m("name", "description", desc);
  m("name", "keywords", tr(page.keywords, lang));
  m("name", "author", SITE.founder);
  m(
    "name",
    "robots",
    page.noindex ? "noindex,follow" : "index,follow,max-image-preview:large,max-snippet:-1",
  );
  m("name", "theme-color", "#0A0A0D");
  m("name", "geo.region", "EG-C");
  m("name", "geo.placename", SITE.city);

  if (origin) tags.push({ kind: "link", rel: "canonical", href: url });
  // A single-language page advertises nothing: a cluster of one is noise, and
  // `x-default` on its own says less than the canonical already does.
  if (origin && !page.noindex && available.length > 1) {
    languageAlternates(origin, page.path, available).forEach((a) =>
      tags.push({ kind: "link", rel: "alternate", href: a.href, hreflang: a.hreflang }),
    );
  }

  // The feed for this language, on the blog index and every article — the
  // link is how readers and aggregators discover it.
  if (origin && (page.path === PAGES.blog.path || page.kind === "article")) {
    const feedTitle = resolveTitle(PAGES.blog, lang).split(" | ")[0];
    const feedFor = (l: Lang) =>
      tags.push({
        kind: "link",
        rel: "alternate",
        type: "application/rss+xml",
        title: feedTitle,
        href: absolute(origin, localePath(l, "/feed.xml")),
      });
    feedFor(available.includes(lang) ? lang : "en");
    if (lang !== "en" && available.includes(lang)) feedFor("en");
  }

  m("property", "og:type", page.type || "website");
  m("property", "og:site_name", SITE.name);
  m("property", "og:title", title);
  m("property", "og:description", desc);
  if (origin) m("property", "og:url", url);
  m("property", "og:image", absolute(origin, image));
  if (imageSized) {
    m("property", "og:image:width", "1200");
    m("property", "og:image:height", "630");
  }
  m("property", "og:image:alt", tr(page.imageAlt || OG_IMAGE_ALT, lang));
  m("property", "og:locale", LOCALES[lang].og);
  siteLangs
    .filter((l) => l !== lang)
    .forEach((l) =>
      tags.push({ kind: "meta", attr: "property", key: "og:locale:alternate", content: LOCALES[l].og }),
    );

  m("name", "twitter:card", "summary_large_image");
  m("name", "twitter:site", opts.twitterSite?.trim() || undefined);
  m("name", "twitter:title", title);
  m("name", "twitter:description", desc);
  m("name", "twitter:image", absolute(origin, image));
  m("name", "twitter:image:alt", tr(page.imageAlt || OG_IMAGE_ALT, lang));

  if (!origin) return tags;

  tags.push({ kind: "jsonld", data: organisationSchema(origin, siteLangs) });
  tags.push({ kind: "jsonld", data: websiteSchema(origin, siteLangs) });
  // No trail on the homepage: a single "Home" crumb is noise.
  if (page.path !== PAGES.home.path && !page.noindex) {
    tags.push({ kind: "jsonld", data: breadcrumbSchema(origin, page, lang, available) });
  }
  if (page.path === PAGES.home.path) {
    tags.push({ kind: "jsonld", data: serviceCatalogSchema(origin, lang, { inline: true }) });
  }
  // The `Service` entities themselves live on /services; the catalogue there
  // references them by id, while the homepage inlines its own copies.
  if (page.path === PAGES.services.path) {
    tags.push({ kind: "jsonld", data: serviceCatalogSchema(origin, lang) });
    serviceSchemas(origin, lang).forEach((data) => tags.push({ kind: "jsonld", data }));
  }
  if (page.kind === "article" || page.type === "article") {
    tags.push({ kind: "jsonld", data: articleSchema(origin, page, lang) });
  }
  if (page.kind === "project" && page.item) {
    tags.push({ kind: "jsonld", data: projectSchema(origin, page.item, lang, url) });
  }
  if (page.kind === "service" && page.item) {
    tags.push({ kind: "jsonld", data: servicePageSchema(origin, page, lang, url) });
  }
  const faq = page.faq?.length ? faqSchema(page.faq) : null;
  if (faq) tags.push({ kind: "jsonld", data: faq });

  return tags;
}

const ESCAPE: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

function esc(v: string): string {
  return v.replace(/[&<>"]/g, (c) => ESCAPE[c]);
}

/** Renders descriptors as static HTML for the build-time prerender. */
export function tagsToHtml(tags: SeoTag[]): string {
  return tags
    .map((t) => {
      switch (t.kind) {
        case "title":
          return `<title data-kf-seo="1">${esc(t.text)}</title>`;
        case "meta":
          return `<meta ${t.attr}="${esc(t.key)}" content="${esc(t.content)}" data-kf-seo="1" />`;
        case "link":
          return `<link rel="${esc(t.rel)}" href="${esc(t.href)}"${
            t.hreflang ? ` hreflang="${esc(t.hreflang)}"` : ""
          }${t.type ? ` type="${esc(t.type)}"` : ""}${
            t.title ? ` title="${esc(t.title)}"` : ""
          } data-kf-seo="1" />`;
        case "jsonld":
          // `</script>` inside JSON would close the tag early; escaping the
          // slash keeps the JSON valid while making that impossible.
          return `<script type="application/ld+json" data-kf-seo="1">${JSON.stringify(
            t.data,
          ).replace(/</g, "\\u003c")}</script>`;
      }
    })
    .join("\n    ");
}
