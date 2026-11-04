/** Static copy for the homepage sections. English keys: every render site passes them through t(). */

export const HERO_STATS = [
  { l: "PROJECTS", v: "40+" },
  { l: "YEARS", v: "6" },
  { l: "LANGUAGES", v: "4" },
];
export const HERO_MARQUEE = ["CUSTOM SOFTWARE", "WEB PLATFORMS", "DASHBOARDS", "MOBILE APPS", "POS SYSTEMS", "IOT SYSTEMS", "AI AUTOMATION"];

/**
 * The hero's code card, token by token: [class, text]. The class names map to
 * the syntax colours in Home.module.css. A real kind of project, in the stack
 * the studio actually ships with.
 */
type Tok = [string, string];
export const HERO_CODE: Tok[][] = [
  [["tkKey", "const"], ["", " project = {"]],
  [["", "  client: "], ["tkStr", "\"Retail, 4 branches\""], ["", ","]],
  [["", "  builds: ["], ["tkStr", "\"POS\""], ["", ", "], ["tkStr", "\"Dashboard\""], ["", ", "], ["tkStr", "\"App\""], ["", "],"]],
  [["", "  stack: ["], ["tkStr", "\"Next.js\""], ["", ", "], ["tkStr", "\"Node.js\""], ["", ","]],
  [["", "    "], ["tkStr", "\"PostgreSQL\""], ["", ", "], ["tkStr", "\"Docker\""], ["", "],"]],
  [["", "  ships: "], ["tkKey", "\"in stages\""], ["", ","]],
  [["", "  status: "], ["tkOk", "\"live\""], ["", ","]],
  [["", "};"]],
];

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
