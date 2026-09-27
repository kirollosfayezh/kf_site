/**
 * Pulls the question/answer pairs out of a Markdown body's FAQ section.
 * Plain TypeScript, no JSX, so the build-time prerender can import it as well
 * as the pages — both then emit the same `FAQPage`.
 */

/**
 * The headings that open an article's FAQ section, per language.
 *
 * Matched by text because the body is plain Markdown with nowhere to put a
 * marker. A heading that is not on this list simply yields no FAQ data — a safe
 * failure, since the visible article is unaffected either way.
 */
const FAQ_HEADINGS = [
  "common questions",
  "frequently asked questions",
  "أسئلة متكررة",
  "أسئلة شائعة",
  "häufige fragen",
  "questions fréquentes",
];

const isFaqHeading = (text: string) => FAQ_HEADINGS.includes(text.trim().toLowerCase());

/**
 * Question/answer pairs from the article's FAQ section.
 *
 * Feeds `FAQPage` structured data. Google removed FAQ rich results in May 2026,
 * so this buys no stars — it is still parsed, and it is the form assistants read
 * when answering a question with a citation, which is the traffic this is
 * actually for.
 */
export function extractFaq(source: string): { q: string; a: string }[] {
  const lines = (source || "").replace(/\r\n?/g, "\n").split("\n");
  const out: { q: string; a: string }[] = [];
  let inFaq = false;
  let q: string | null = null;
  let buf: string[] = [];

  const flush = () => {
    // Structured answers are plain text: drop the Markdown emphasis and keep
    // a link's label.
    const answer = buf
      .join(" ")
      .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*\n]+)\*/g, "$1")
      .replace(/`([^`]+)`/g, "$1")
      .trim();
    if (q && answer) out.push({ q, a: answer });
    q = null;
    buf = [];
  };

  for (const line of lines) {
    const t = line.trim();
    const h2 = /^##\s+(?!#)(.*)$/.exec(t);
    if (h2) {
      flush();
      inFaq = isFaqHeading(h2[1]);
      continue;
    }
    if (!inFaq) continue;
    const h3 = /^###\s+(.*)$/.exec(t);
    if (h3) {
      flush();
      q = h3[1].trim();
      continue;
    }
    // Only prose counts as an answer; a table or list inside an FAQ entry is
    // not something a structured answer can carry.
    if (q && t && !/^[|>#\-*\d]/.test(t)) buf.push(t);
  }
  flush();
  return out;
}
