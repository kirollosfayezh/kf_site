import type { Lang } from "../langs.ts";

export interface PageSeo {
  path: string;
  title: string;
  desc: string;
  keywords?: string;
  type?: "website" | "article";
  /** What kind of page this is, for the JSON-LD that goes with it. */
  kind?: "page" | "article" | "project" | "legal" | "service";
  /** The CMS item behind an article/project/legal page, for its schema. */
  item?: ArticleLike;
  image?: string;
  /** Plain-language description of the share image, for `og:image:alt`. */
  imageAlt?: string;
  /** True only when `image` really is 1200×630 — the dimensions are claimed
   *  only then, because a wrong claim makes Facebook and LinkedIn drop the card. */
  imageSized?: boolean;
  noindex?: boolean;
  /** The breadcrumb's last crumb, when the page title is not a good one (an
   *  SEO title like "X Company in Egypt" reads badly as a trail). */
  crumb?: string;
  published?: string;
  modified?: string;
  section?: string;
  /** FAQ items rendered on the page, emitted as `FAQPage` alongside the rest
   *  of the graph. Set per language by the build; the runtime uses `useFaqSchema`. */
  faq?: { q: string; a: string }[];
  /**
   * Dashboard overrides per language. `title`/`desc` hold the English text
   * (built-in or overridden); these hold an editor's explicit translations,
   * which win over the dictionary lookup `tr()` would otherwise do.
   */
  titleByLang?: Partial<Record<Lang, string>>;
  descByLang?: Partial<Record<Lang, string>>;
  /**
   * The languages this page genuinely exists in. Omitted means all of them,
   * which is true of every static page — their copy is in the dictionary.
   *
   * CMS content is different: an article translated into Arabic but not German
   * should be indexable at `/ar/blog/x` and absent from `/de/blog/x`. Claiming
   * a language whose page serves English is the misconfiguration hreflang
   * exists to prevent — Google checks the target really is in the language
   * claimed and drops the whole cluster when it is not — but refusing to
   * advertise a translation that *does* exist throws away the page.
   *
   * So the set is per item, and canonical, hreflang, the prerender and the
   * sitemap all read from this one list.
   */
  langs?: Lang[];
}

/** The subset of a blogPosts ContentItem the SEO layer needs. Declared
 *  structurally so the build script can use it without importing the app's
 *  API types (and the DOM typings they drag along). */
export interface ArticleLike {
  id?: string;
  slug?: string;
  title?: Partial<Record<Lang, string>>;
  summary?: Partial<Record<Lang, string>>;
  body?: Partial<Record<Lang, string>>;
  media?: string[];
  meta?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  published?: boolean;
}
