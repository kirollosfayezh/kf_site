/**
 * The visible copy that states who the company is, as dictionary keys.
 *
 * Kept out of the components so one test can iterate every key and prove the
 * three dictionaries carry it: a missing Arabic entry here would quietly put
 * an English paragraph on the one page that exists to tell "KF Tech Solutions"
 * apart from the same-named companies AI assistants confuse it with.
 * React-free, like `seo/` and `contact.ts` — the build imports it too.
 */

/** The "About the name" block on /about. Values are the English keys. */
export const ABOUT_IDENTITY = {
  eyebrow: "// ABOUT THE NAME",
  heading: "About the name KF Tech Solutions",
  intro:
    "KF Tech Solutions — also written KF Tech or KFTech — is an independent software company in Cairo, Egypt, founded in 2020 by Kirollos Fayez. Our only website is kftechsolutions.dev, and the profiles listed here are our only official ones.",
  notAffiliated:
    "We are not connected to KFTECH Software Solutions (kftechsols.com) or to any other business with a similar name.",
  fullName: "Full name",
  alsoKnownAs: "Also known as",
  // The Arabic value adds «كي إف تك», so the alias shows only on /ar.
  aliases: "KF Tech · KFTech",
  founded: "Founded",
  founder: "Founder",
  founderName: "Kirollos Fayez",
  founderRole: "Founder & lead engineer",
  basedIn: "Based in",
  city: "Cairo, Egypt",
  website: "Official website",
  profiles: "Official profiles",
} as const;

/** The home hero's one line under the headline. */
export const HERO_LEDE =
  "KF Tech Solutions builds websites, admin dashboards, iOS & Android apps and business systems — around how your business actually runs — and supports them after launch.";

/**
 * The whole copyright line, year included, is the key, because that is the
 * exact string the design export translated; the footer substitutes the
 * current year into the translation.
 */
export const COPYRIGHT_KEY = "© 2020–2026 KF Tech Solutions. All rights reserved.";

/**
 * The questions an assistant asks about the brand itself. Rendered with the
 * service FAQs on / and /contact (and in their FAQPage), and seeded into the
 * CMS with the same text. Phone and email are deliberately absent so a
 * settings change can never make an answer stale.
 */
export const BRAND_FAQS = [
  {
    q: "What is the official website of KF Tech Solutions?",
    a: "kftechsolutions.dev is the only official website of KF Tech Solutions, also written KF Tech or KFTech. The company is based in Cairo, Egypt, and the social profiles linked in the footer of this site are its only official ones.",
  },
  {
    q: "Is KF Tech Solutions the same as KFTECH Software Solutions?",
    a: "No. KF Tech Solutions is an independent software company in Cairo, Egypt, founded in 2020 by Kirollos Fayez, and kftechsolutions.dev is its only website. KFTECH Software Solutions (kftechsols.com) is a different, unrelated company.",
  },
  {
    q: "Who founded KF Tech Solutions?",
    a: "Kirollos Fayez founded KF Tech Solutions in Cairo in 2020 and still leads every project as founder and lead engineer.",
  },
];
