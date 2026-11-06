/**
 * Markdown twins: every indexable page again as plain Markdown at its own URL
 * plus `.md` (llmstxt.org's convention), linked from the page's head.
 *
 * Assistants that fetch a page while answering someone (ChatGPT-User,
 * Claude-User, Perplexity-User) get a React bundle and a prerendered body full
 * of layout; the twin is the same facts with nothing to strip. Twins are served
 * `noindex` (vercel.json) and never listed in the sitemap — they exist to be
 * read on demand, not to become a second copy of the site in the index.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  SITE,
  absolute,
  articlePageSeo,
  availableLangs,
  disambiguation,
  fitDesc,
  fitTitle,
  legalPageSeo,
  localePath,
  markdownPath,
  marketLangs,
  marketPageSeo,
  projectPageSeo,
  resolveDesc,
  resolveTitle,
  serviceHeadline,
  serviceLangs,
  serviceLede,
  servicePageSeo,
  servicePath,
  siteIdentity,
  type ArticleLike,
  type Lang,
  type PageSeo,
} from "../../src/lib/seo/index.ts";
import { translate } from "../../src/lib/dict/index.ts";
import { ABOUT_IDENTITY as ID } from "../../src/lib/brand-copy.ts";
import {
  FALLBACK_SERVICES,
  FALLBACK_SOLUTIONS,
  FALLBACK_STEPS,
  FALLBACK_WHY,
} from "../../src/lib/fallback-content.ts";
import { extractFaq } from "../../src/lib/faq.ts";
import type { BuildContext } from "./context.ts";
import { faqItems, localized, pageFor } from "./prerender.ts";
import { day } from "./sitemap.ts";

/** Which page a twin belongs to, for `llms-full.txt` to choose from. */
export type TwinKind = "page" | "article" | "project" | "service" | "market" | "legal";

export interface Twin {
  lang: Lang;
  kind: TwinKind;
  /** The PAGES key for a static page. */
  key?: string;
  /** Where it is served: `/about.md`, `/ar/index.md`. */
  path: string;
  /** `key: value` lines of the front block. */
  front: string[];
  /** `# heading` and the page's content. */
  body: string;
}

/** The front block, the content and the one-line disambiguation, as served. */
export function twinText(twin: Twin, origin: string): string {
  return `---\n${twin.front.join("\n")}\n---\n\n${twin.body.trim()}\n\n---\n\n${disambiguation(origin)}\n`;
}

/**
 * Root-relative links in CMS Markdown made absolute: a twin is read out of
 * context (pasted into a chat, inlined into llms-full.txt), where `/contact`
 * points nowhere.
 */
export function absoluteLinks(md: string, origin: string): string {
  return md
    .replace(/(\]\(\s*<?)\/(?!\/)/g, `$1${origin}/`)
    .replace(/^(\s*\[[^\]]+\]:\s*<?)\/(?!\/)/gm, `$1${origin}/`)
    .replace(/(\b(?:href|src)=["'])\/(?!\/)/g, `$1${origin}/`);
}

const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/** The heading: the page's title without the trailing brand the <title> carries. */
const heading = (title: string) => title.replace(/\s+[|—–]\s+KF Tech[^|—–]*$/, "");

/** A list line, linked when there is a page to link to. */
const bullet = (title: string, href: string | undefined, desc: string) => {
  const name = href ? `[${oneLine(title)}](${href})` : `**${oneLine(title)}**`;
  const text = oneLine(desc);
  return `- ${name}${text ? `: ${text}` : ""}`;
};

const faqBlock = (lang: Lang, items: { q: string; a: string }[]) =>
  items.length
    ? `## ${translate("Questions, answered.", lang)}\n\n${items.map((f) => `### ${oneLine(f.q)}\n\n${f.a.trim()}`).join("\n\n")}`
    : "";

const tagOf = (item: ArticleLike) => (typeof item.meta?.tag === "string" ? item.meta.tag : "");

/**
 * The content of a static page, from the same sources the page renders: the
 * CMS lists when the dashboard has them, else the same built-in fallbacks, all
 * through the dictionary.
 */
function staticBody(key: string, lang: Lang, origin: string, ctx: BuildContext): string {
  const t = (s: string) => translate(s, lang);
  // A list item links to its page in this language when that page exists,
  // else to the English one — never to a URL the build did not write.
  const href = (path: string, langs: readonly Lang[]) =>
    absolute(origin, localePath(langs.includes(lang) ? lang : "en", path));

  const services = () =>
    ctx.services.length
      ? ctx.services.map((s) =>
          bullet(
            localized(s.title, lang),
            href(servicePath(s.slug || s.id || ""), serviceLangs(s, ctx.langs)),
            localized(s.summary ?? s.body, lang),
          ),
        )
      : FALLBACK_SERVICES.map((f) => bullet(t(f.title), undefined, t(f.desc)));
  const listed = (items: ArticleLike[], seo: (i: ArticleLike) => PageSeo) =>
    items.map((i) => bullet(localized(i.title, lang), href(seo(i).path, availableLangs(i, ctx.langs)), localized(i.summary, lang)));
  const contactFacts = () => {
    const { email, phone } = siteIdentity();
    return [
      `- ${t("Email")}: ${email}`,
      `- ${t("WhatsApp")}: ${phone}`,
      `- ${t(ID.basedIn)}: ${t(ID.city)}`,
      `- [${t("Book a call")}](${href("/book", ctx.langs)}): ${t("Pick a time — we call you on WhatsApp")}`,
    ].join("\n");
  };

  switch (key) {
    case "home":
      return [`## ${t("What we build")}`, services().join("\n"), faqBlock(lang, faqItems(ctx, lang))].join("\n\n");
    case "services":
      return services().join("\n");
    case "solutions":
      return (
        ctx.solutions.length
          ? ctx.solutions.map((s) => bullet(localized(s.title, lang), undefined, localized(s.summary ?? s.body, lang)))
          : FALLBACK_SOLUTIONS.map((f) => bullet(t(f.title), undefined, t(f.longDesc ?? f.desc)))
      ).join("\n");
    case "projects":
      return listed(ctx.projects, (i) => projectPageSeo(i, "en", ctx.langs)).join("\n");
    case "blog":
      return listed(ctx.articles, (i) => articlePageSeo(i, "en", ctx.langs)).join("\n");
    case "contact":
    case "book":
      return [contactFacts(), faqBlock(lang, faqItems(ctx, lang))].join("\n\n");
    case "about": {
      const id = siteIdentity();
      const tagged = (tag: string) => ctx.aboutSections.filter((x) => tagOf(x) === tag);
      const card = (x: ArticleLike) => bullet(localized(x.title, lang), undefined, localized(x.body ?? x.summary, lang));
      const why = tagged("why");
      const steps = tagged("process");
      return [
        t(
          "KF Tech Solutions is a software studio based in Cairo, partnering with businesses to turn ideas into working products — from understanding the problem to engineering the system and supporting it after launch.",
        ),
        `## ${t(ID.heading)}`,
        t(ID.intro),
        t(ID.notAffiliated),
        [
          `- ${t(ID.fullName)}: ${SITE.name}`,
          `- ${t(ID.alsoKnownAs)}: ${t(ID.aliases)}`,
          `- ${t(ID.founded)}: ${id.foundingDate}`,
          `- ${t(ID.founder)}: ${t(ID.founderName)} · ${t(ID.founderRole)}${id.founderSameAs.length ? ` · ${id.founderSameAs.join(", ")}` : ""}`,
          `- ${t(ID.basedIn)}: ${t(ID.city)}`,
          `- ${t(ID.website)}: ${origin}`,
          `- ${t(ID.profiles)}: ${id.sameAs.join(", ")}`,
        ].join("\n"),
        `## ${t("A partner, not just a developer.")}`,
        (why.length ? why.map(card) : FALLBACK_WHY.map((w) => bullet(t(w.title), undefined, t(w.desc)))).join("\n"),
        `## ${t("From idea to launch.")}`,
        (steps.length
          ? steps.map((x, i) => `${i + 1}. ${card(x).slice(2)}`)
          : FALLBACK_STEPS.map((s, i) => `${i + 1}. **${t(s.title)}**: ${t(s.desc)}`)
        ).join("\n"),
      ].join("\n\n");
    }
    default:
      return "";
  }
}

/** A CMS page's content: its lede, then the Markdown body the page renders. */
function itemBody(page: PageSeo, lang: Lang, origin: string): string {
  const item = page.item as ArticleLike;
  const lede = page.kind === "service" ? serviceLede(item, lang) : localized(item.summary, lang);
  const body = localized(item.body, lang).trim();
  // A case study's facts and stack, as its page lists them.
  const project = page.kind === "project";
  const metaText = (k: string) => (typeof item.meta?.[k] === "string" ? (item.meta[k] as string).trim() : "");
  const facts = project
    ? ["Client", "Year", "Duration"].flatMap((label) => {
        const value = metaText(label.toLowerCase());
        return value ? [`- ${translate(label, lang)}: ${value}`] : [];
      })
    : [];
  const tech =
    project && Array.isArray(item.meta?.points)
      ? (item.meta.points as unknown[]).filter((x): x is string => typeof x === "string").map((x) => translate(x, lang))
      : [];
  return [
    // A summary that only repeats the body's opening adds nothing.
    lede && !body.startsWith(lede.trim()) ? oneLine(lede) : "",
    facts.join("\n"),
    absoluteLinks(body, origin),
    tech.length ? `${translate("Built with", lang)}: ${tech.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

function twin(origin: string, page: PageSeo, lang: Lang, kind: TwinKind, body: string, key?: string): Twin {
  // The same title and description as the HTML head, so a reader of either
  // sees one page.
  const title = fitTitle(resolveTitle(page, lang));
  const front = [
    `title: ${JSON.stringify(title)}`,
    `description: ${JSON.stringify(fitDesc(resolveDesc(page, lang)))}`,
    `url: ${absolute(origin, localePath(lang, page.path))}`,
    `language: ${lang}`,
    ...(page.published && day(page.published) ? [`published: ${day(page.published)}`] : []),
    ...(page.modified && day(page.modified) ? [`modified: ${day(page.modified)}`] : []),
    ...(kind === "article" ? [`author: ${SITE.founder}`] : []),
    `site: ${JSON.stringify(`${SITE.name} — ${origin}`)}`,
  ];
  const name = page.kind === "service" ? serviceHeadline(page.item as ArticleLike, lang) : page.item ? localized(page.item.title, lang) : heading(title);
  return { lang, kind, key, path: markdownPath(lang, page.path), front, body: `# ${oneLine(name)}\n\n${body}` };
}

/**
 * Every twin of this build, on the prerender's terms: one per indexable page
 * per language it exists in. noindex pages, `/404` and `/q` get none.
 */
export function markdownTwins(origin: string, ctx: BuildContext): Twin[] {
  const out: Twin[] = [];
  for (const lang of ctx.langs) {
    for (const [key, page] of Object.entries(ctx.pages)) {
      if (page.noindex || page.path === "/404" || page.path === "/q") continue;
      if (page.langs && !page.langs.includes(lang)) continue;
      const full = pageFor(ctx, page, lang, key);
      // Static pages open with their description, the page's own summary.
      const intro = oneLine(resolveDesc(full, lang));
      const body = [intro, staticBody(key, lang, origin, ctx)].filter(Boolean).join("\n\n");
      out.push(twin(origin, full, lang, "page", body, key));
    }
    for (const post of ctx.articles) {
      if (!availableLangs(post, ctx.langs).includes(lang)) continue;
      const page = articlePageSeo(post, lang, ctx.langs);
      out.push(twin(origin, page, lang, "article", itemBody(page, lang, origin)));
    }
    for (const item of ctx.projects) {
      if (!availableLangs(item, ctx.langs).includes(lang)) continue;
      const page = projectPageSeo(item, lang, ctx.langs);
      out.push(twin(origin, page, lang, "project", itemBody(page, lang, origin)));
    }
    for (const item of ctx.services) {
      if (!serviceLangs(item, ctx.langs).includes(lang)) continue;
      const page = servicePageSeo(item, lang, ctx.langs, extractFaq(localized(item.body, lang)));
      out.push(twin(origin, page, lang, "service", itemBody(page, lang, origin)));
    }
    // Country pages: the same English and Arabic files the prerender writes.
    for (const item of ctx.markets) {
      if (!marketLangs(item, ctx.langs).includes(lang)) continue;
      const page = marketPageSeo(item, lang, ctx.langs, extractFaq(localized(item.body, lang)));
      out.push(twin(origin, page, lang, "market", itemBody(page, lang, origin)));
    }
    for (const doc of ctx.legal) {
      if (!availableLangs(doc, ctx.langs).includes(lang)) continue;
      const page = legalPageSeo(doc, lang, ctx.langs);
      out.push(twin(origin, page, lang, "legal", itemBody(page, lang, origin)));
    }
  }
  return out;
}

/** Writes every twin next to its page (`dist/about.md`, `dist/ar/index.md`); returns the count. */
export async function writeMarkdownTwins(distDir: string, origin: string, ctx: BuildContext): Promise<number> {
  const twins = markdownTwins(origin, ctx);
  for (const t of twins) {
    const target = join(distDir, t.path.replace(/^\//, ""));
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, twinText(t, origin), "utf8");
  }
  return twins.length;
}
