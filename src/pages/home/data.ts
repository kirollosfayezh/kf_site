/** Static copy for the homepage sections. English keys: every render site passes them through t(). */

/** The strip under the hero; each one opens its service page. */
export const HERO_MARQUEE = [
  { label: "CUSTOM SOFTWARE", slug: "custom-software" },
  { label: "WEB PLATFORMS", slug: "web-development" },
  { label: "DASHBOARDS", slug: "business-systems" },
  { label: "MOBILE APPS", slug: "mobile-applications" },
  { label: "POS SYSTEMS", slug: "business-systems" },
  { label: "IOT SYSTEMS", slug: "iot-solutions" },
  { label: "AI AUTOMATION", slug: "automation" },
];

/**
 * Delivered client projects we keep resized screenshots of in public/hero/
 * (desktop 640/1040w, phone 360w): the homepage work cards use these instead
 * of the 2000px CMS originals. Slugs are the case-study URLs.
 */
export const SHOWREEL = [
  { slug: "solana-red-sea", title: "Solana Red Sea", tag: "Luxury real estate", desktop: "solana-red-sea", mobile: "solana-red-sea-mobile" },
  { slug: "gentrack", title: "GenTrack", tag: "IoT generator SaaS", desktop: "gentrack", mobile: "gentrack-mobile" },
  { slug: "alkhameesi", title: "Alkhameesi", tag: "Vegetable export", desktop: "alkhameesi", mobile: "alkhameesi-mobile" },
  { slug: "eltayib", title: "Eltayib", tag: "Car towing & roadside", desktop: "eltayib-desktop", mobile: "eltayib-mobile" },
] as const;

/** The brand book's four values, with the same wording as the guidelines. */
export const VALUES = [
  { n: "01", title: "Working over impressive", desc: "We measure success by the system your team uses every day, not the demo." },
  { n: "02", title: "Clear, fixed scope", desc: "Written stages, written prices. No surprises in the invoice." },
  { n: "03", title: "Craft in the details", desc: "Clean code, fast pages, correct Arabic — the details users feel." },
  { n: "04", title: "Here after launch", desc: "Hand-over, training and support. We stay reachable." },
];

export const STEPS = [
  { n: "01", title: "Discover", desc: "Understand the business, users and requirements." },
  { n: "02", title: "Plan", desc: "Define architecture, features and user experience." },
  { n: "03", title: "Design", desc: "Create the interface and the product experience." },
  { n: "04", title: "Build", desc: "Develop, integrate and thoroughly test the product." },
  { n: "05", title: "Launch", desc: "Deploy, monitor and continuously improve." },
];

/**
 * What every build comes with, in the words a client would ask about it. The
 * icon key picks one of the stroke icons in HomeIncluded.
 */
export const INCLUDED = [
  { icon: "dashboard", title: "A dashboard you control", desc: "Edit content, prices, users and orders yourself — no developer needed for daily changes." },
  { icon: "language", title: "Arabic and English, done right", desc: "Right-to-left layouts designed in from the start, not flipped at the end." },
  { icon: "devices", title: "Works on every screen", desc: "Phones, tablets and desktops, tested on real devices before launch." },
  { icon: "search", title: "Fast, and found on Google", desc: "Speed, SEO and analytics set up before launch, not added later." },
  { icon: "shield", title: "Secure by default", desc: "HTTPS, roles and permissions, and protected data from day one." },
  { icon: "key", title: "Yours to keep", desc: "The domain, accounts and data are registered in your name." },
  { icon: "training", title: "Training and hand-over", desc: "Your team learns to run it before we step back." },
  { icon: "support", title: "Support after launch", desc: "Fixes, updates and new features on a clear monthly plan." },
] as const;
