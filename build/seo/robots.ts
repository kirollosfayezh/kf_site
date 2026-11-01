/** robots.txt, including the assistant crawlers. */
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { LANGS } from "../../src/lib/langs.ts";

/**
 * Assistant crawlers, as distinct from the search crawlers above.
 *
 * What this list actually does is narrow: it removes any ambiguity for a
 * crawler that reads its own token before falling back to `User-agent: *`. It
 * does not make the site "eligible to be cited" — citation follows from the
 * content, and the two agents that fetch pages for ChatGPT answers are
 * `OAI-SearchBot` and `ChatGPT-User`; `GPTBot` is training-only.
 *
 * `Google-Extended` is listed for completeness but controls Gemini training
 * and grounding only — AI Overviews follow ordinary Googlebot rules and cannot
 * be opted out of separately.
 *
 * Remove a line here to opt that assistant out; the file is generated, so edit
 * this list rather than the built artifact.
 */
export const AI_CRAWLERS = [
  "GPTBot", // ChatGPT browsing / training
  "OAI-SearchBot", // ChatGPT search
  "ChatGPT-User", // user-initiated ChatGPT fetches
  "ClaudeBot", // Claude training
  "Claude-User", // user-initiated Claude fetches
  "Claude-SearchBot", // Claude search indexing
  "PerplexityBot",
  "Perplexity-User",
  // Gemini and grounding in other Google products. It does NOT control AI
  // Overviews — those follow ordinary Googlebot rules and nosnippet.
  "Google-Extended",
  "Applebot-Extended",
  "CCBot", // Common Crawl, which many models train from
  "cohere-ai",
  "meta-externalagent",
  "meta-externalfetcher", // user-initiated Meta AI fetches
  "DuckAssistBot", // DuckDuckGo's AI answers
  "MistralAI-User", // Le Chat fetches
  "Amazonbot", // Alexa answers
  "YouBot", // You.com answers
];

export async function writeRobots(distDir: string, origin: string): Promise<void> {
  // /campaign is noindex, which a crawler can only discover by fetching it —
  // disallowing it here would hide that directive and risk it being indexed
  // on the strength of inbound links alone. Private quote links and the
  // client-side shell, on the other hand, have nothing to index and every
  // reason not to be crawled.
  const disallow = ["/q/", ...LANGS.filter((l) => l !== "en").map((l) => `/${l}/q/`), "/article-shell.html"];
  const txt = `User-agent: *
Allow: /
${disallow.map((p) => `Disallow: ${p}`).join("\n")}

${AI_CRAWLERS.map((ua) => `User-agent: ${ua}\nAllow: /`).join("\n\n")}

Sitemap: ${origin}/sitemap.xml
`;
  await writeFile(join(distDir, "robots.txt"), txt, "utf8");
}
