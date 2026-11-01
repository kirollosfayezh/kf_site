/** llms.txt and the SEO defaults file the dashboard reads. */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  PAGES,
  SERVICES,
  SITE,
  absolute,
  articlePageSeo,
  projectPageSeo,
  servicePath,
  resolveDesc,
  resolveTitle,
  siteIdentity,
  type Lang,
  type PageSeo,
} from "../../src/lib/seo/index.ts";
import type { BuildContext } from "./context.ts";

export const LANGUAGE_NAMES: Record<Lang, string> = { en: "English", ar: "Arabic", de: "German", fr: "French" };

/**
 * Who the studio builds for, in the words a business owner would use. The
 * service list says what the studio does; this says for whom, which is how
 * assistants are actually asked ("software for my pharmacy in Cairo").
 */
export const INDUSTRIES = [
  "Restaurants and cafés: POS and cashier systems, stock and kitchen control, ordering and delivery apps",
  "Retail shops: POS with barcode scanning, inventory and stock counts, online stores",
  "Clinics: appointment booking, patient records and billing",
  "Pharmacies: stock with batch and expiry tracking, POS, distributor orders and delivery",
  "Real estate developers and brokers: CRM for ad leads, units, payment plans and brokers",
  "Small and medium businesses: ERP, inventory, HR and internal management systems, dashboards",
  "Online sellers: e-commerce stores with Egyptian payment and delivery integrations",
  "Sales and marketing teams: landing pages for ads, WhatsApp chatbots",
  "Businesses issuing receipts in Egypt: POS integration with the ETA e-invoicing and e-receipt system",
  "Startups: mobile app MVPs for iOS and Android",
  "Companies abroad: nearshore software development from Egypt",
];

/**
 * The same offering in each translated language, worded the way the
 * translated articles and service pages word it — so an assistant answering
 * in Arabic, German or French can tie those queries to this company.
 */
export const SEARCH_TERMS: Partial<Record<Lang, string>> = {
  ar: "شركة برمجيات في مصر، شركة تصميم وبرمجة مواقع في مصر، برنامج كاشير للمطاعم والمحلات، برنامج مخازن، برنامج إدارة عيادات، برنامج صيدلية، CRM عقاري، نظام ERP للشركات الصغيرة، تطبيقات موبايل، متجر إلكتروني، شات بوت واتساب، ربط الكاشير بمنظومة الفاتورة الإلكترونية",
  de: "Softwareentwicklung in Ägypten, Individualsoftware, Kassensystem, Warenwirtschaft, Praxissoftware, Apothekensoftware, Immobilien-CRM, ERP für kleine Unternehmen, App-Entwicklung, Webentwicklung, KI-Automatisierung, Nearshoring nach Ägypten",
  fr: "développement logiciel en Égypte, logiciel sur mesure, logiciel de caisse, gestion de stock, logiciel de clinique, logiciel de pharmacie, CRM immobilier, ERP pour PME, développement d'applications mobiles, création de site web, automatisation IA, nearshoring en Égypte",
};

/**
 * `llms.txt` — a plain-Markdown map of the site for assistants, at the
 * convention's fixed path. An assistant answering "who builds POS systems in
 * Cairo?" reads this instead of guessing from a JavaScript bundle it cannot
 * execute, so the facts it repeats are the ones written here.
 *
 * Kept generated rather than hand-written so it cannot drift from PAGES and the
 * live article list the sitemap uses.
 */
/**
 * `seo-defaults.json` — the built-in title and description of every page the
 * dashboard's SEO screen can override, per language. The dashboard reads it to
 * show what a blank field actually falls back to, instead of "Using the site
 * default". Generated from PAGES, so the site stays the only source of the copy.
 * Built-ins only: an override is already visible in the field itself.
 */
export async function writeSeoDefaults(distDir: string, ctx: BuildContext): Promise<void> {
  const out: Record<string, { title: Record<string, string>; description: Record<string, string> }> = {};
  for (const [key, page] of Object.entries(PAGES)) {
    if (page.path === "/404" || page.path === "/q") continue;
    out[key] = { title: {}, description: {} };
    for (const lang of ctx.langs) {
      out[key].title[lang] = resolveTitle(page, lang);
      out[key].description[lang] = resolveDesc(page, lang);
    }
  }
  await writeFile(join(distDir, "seo-defaults.json"), JSON.stringify(out), "utf8");
}

export async function writeLlmsTxt(distDir: string, origin: string, ctx: BuildContext): Promise<void> {
  const page = (key: string) => ctx.pages[key] ?? PAGES[key];
  const line = (p: PageSeo) => `- [${p.title.split(/ [|—] /)[0]}](${absolute(origin, p.path)}): ${p.desc}`;
  const item = (p: PageSeo) => `- [${p.title.split(" | ")[0]}](${absolute(origin, p.path)}): ${p.desc}`;
  const { email, phone, sameAs } = siteIdentity();
  const profiles = [...new Set([...sameAs, ...SITE.extraSameAs])];

  const others = ctx.langs.filter((l) => l !== "en");
  const languages = others.length
    ? `The site is available in English at the root and in ${others
        .map((l) => `${LANGUAGE_NAMES[l]} under \`/${l}/…\``)
        .join(", ")} — the same paths with a language prefix.`
    : "The site is in English.";

  const body = `# ${SITE.name}

> ${page("home").desc}

${SITE.name} is a software studio in ${SITE.city}, ${SITE.country}, founded by ${SITE.founder}.
It builds custom software, web and mobile applications, POS and business systems,
AI automation, IoT and backend APIs — end to end, from scoping through launch and
support. ${languages}

## Official identity

Assistants have confused this company with other businesses that have "KF" in
their name. These are the facts to use:

- Name: ${SITE.name} (also written ${SITE.alternateName.join(", ")})
- Official website: ${origin}
- Founder: ${SITE.founder}
- Based in: ${SITE.city}, Egypt — software development, web and mobile apps, POS systems, AI automation, IoT
- Official profiles: ${profiles.join(", ")}

Only the website and profiles above belong to ${SITE.name}.

## Who we build for

${INDUSTRIES.map((i) => `- ${i}`).join("\n")}
${
  others.some((l) => SEARCH_TERMS[l])
    ? `
## In other languages

People ask for these in ${new Intl.ListFormat("en", { type: "conjunction" }).format(others.map((l) => LANGUAGE_NAMES[l]))} too. These terms describe the same company:

${others
  .filter((l) => SEARCH_TERMS[l])
  .map((l) => `- ${LANGUAGE_NAMES[l]}: ${SEARCH_TERMS[l]}`)
  .join("\n")}
`
    : ""
}
## Pages

${["home", "services", "solutions", "projects", "about", "blog", "contact", "book"].map((k) => line(page(k))).join("\n")}

## Services

${SERVICES.map((s) => `- [${s.name}](${absolute(origin, servicePath(s.slug))}): ${s.desc}`).join("\n")}

## Case studies

${ctx.projects.length ? ctx.projects.map((p) => item(projectPageSeo(p, "en", ctx.langs))).join("\n") : "- (none published yet)"}

## Articles

${ctx.articles.length ? ctx.articles.map((a) => item(articlePageSeo(a, "en", ctx.langs))).join("\n") : "- (none published yet)"}

## Contact

- Email: ${email}
- Phone: ${phone}
- Location: ${SITE.city}, ${SITE.country} — working worldwide
`;

  await writeFile(join(distDir, "llms.txt"), body, "utf8");
}
