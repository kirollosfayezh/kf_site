import type { ReactNode } from "react";

/**
 * A small Markdown subset, rendered to React elements.
 *
 * Article bodies were rendered as `white-space: pre-wrap` plain text, so every
 * post was one undifferentiated slab — no headings, no lists, and no tables,
 * which the content plan requires (a price comparison in EGP and USD is the
 * format that actually wins these queries).
 *
 * Two deliberate constraints:
 *
 * 1. **React elements, never `dangerouslySetInnerHTML`.** Bodies come from the
 *    CMS, so HTML injection would put an XSS hole one compromised admin away.
 *    Producing elements means there is no HTML string to sanitise in the first
 *    place.
 * 2. **No dependency.** A parser is ~35KB against a 300KB bundle, for a grammar
 *    this small; the site already hand-writes its icons and its WebGL for the
 *    same reason.
 *
 * Supported: `##`/`###` headings, paragraphs, `-`/`*` and `1.` lists, `>`
 * blockquotes (a trailing `— Name` line becomes the attribution), `|` tables,
 * `---` rules, fenced code, and inline `**bold**`, `*italic*`, `` `code` ``
 * and `[text](url)`. Anything else renders as literal text rather than
 * disappearing.
 */

export interface Heading {
  id: string;
  text: string;
  level: 2 | 3;
}

/** Stable, readable anchors. Arabic and other non-Latin headings slugify to
 *  nothing, so those fall back to a positional id rather than colliding on "". */
function slugify(text: string, index: number): string {
  const base = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return base && /[a-z0-9]/.test(base) ? base : `section-${index + 1}`;
}

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
    const answer = buf.join(" ").trim();
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

/* ----------------------------------------------------------------- inline */

const INLINE = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let i = 0;
  for (const part of text.split(INLINE)) {
    if (!part) continue;
    const key = `${keyPrefix}-${i++}`;
    if (part.startsWith("**") && part.endsWith("**")) {
      out.push(<strong key={key}>{part.slice(2, -2)}</strong>);
    } else if (part.startsWith("`") && part.endsWith("`")) {
      out.push(<code key={key}>{part.slice(1, -1)}</code>);
    } else if (part.startsWith("*") && part.endsWith("*")) {
      out.push(<em key={key}>{part.slice(1, -1)}</em>);
    } else if (part.startsWith("[")) {
      const m = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
      if (!m) {
        out.push(part);
        continue;
      }
      const [, label, href] = m;
      const external = /^https?:\/\//.test(href);
      out.push(
        <a
          key={key}
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {label}
        </a>,
      );
    } else {
      out.push(part);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ blocks */

const isTableRow = (l: string) => l.trim().startsWith("|") && l.trim().endsWith("|");
const cells = (l: string) =>
  l
    .trim()
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim());

/**
 * Parses the body once, returning both the rendered blocks and the headings
 * found — the "on this page" list is built from the same pass, so it can never
 * list a heading the article does not have.
 */
export function renderRichText(source: string): { blocks: ReactNode[]; headings: Heading[] } {
  const lines = (source || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  const headings: Heading[] = [];
  let para: string[] = [];
  let k = 0;

  // `Seo.tsx` builds FAQPage schema by reading `data-kf-faq-*` off the DOM, so
  // the answers are attached to the questions here rather than plumbed through
  // a second channel. Same contract the hand-written FAQ accordion uses.
  const faq = new Map(extractFaq(source).map((x) => [x.q, x.a]));

  const flushPara = () => {
    if (!para.length) return;
    const text = para.join(" ");
    blocks.push(<p key={`p-${k++}`}>{inline(text, `p${k}`)}</p>);
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushPara();
      continue;
    }

    // fenced code
    if (trimmed.startsWith("```")) {
      flushPara();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) buf.push(lines[i++]);
      blocks.push(
        <pre key={`pre-${k++}`}>
          <code>{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // headings
    const h = /^(#{2,3})\s+(.*)$/.exec(trimmed);
    if (h) {
      flushPara();
      const level = (h[1].length === 2 ? 2 : 3) as 2 | 3;
      const text = h[2].trim();
      const id = slugify(text, headings.length);
      headings.push({ id, text, level });
      const Tag = level === 2 ? "h2" : "h3";
      const answer = level === 3 ? faq.get(text) : undefined;
      blocks.push(
        <Tag
          key={`h-${k++}`}
          id={id}
          {...(answer ? { "data-kf-faq-q": text, "data-kf-faq-a": answer } : {})}
        >
          {inline(text, `h${k}`)}
        </Tag>,
      );
      continue;
    }

    if (/^(---|\*\*\*|___)$/.test(trimmed)) {
      flushPara();
      blocks.push(<hr key={`hr-${k++}`} />);
      continue;
    }

    // blockquote — a trailing "— Name" line becomes the attribution
    if (trimmed.startsWith(">")) {
      flushPara();
      const buf: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        buf.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      i--;
      let cite: string | undefined;
      const last = buf[buf.length - 1];
      if (last && /^(—|--)\s*/.test(last)) cite = buf.pop()!.replace(/^(—|--)\s*/, "");
      blocks.push(
        <blockquote key={`q-${k++}`}>
          <p>{inline(buf.join(" "), `q${k}`)}</p>
          {cite ? <cite>{cite}</cite> : null}
        </blockquote>,
      );
      continue;
    }

    // tables — header row, separator, body rows
    if (isTableRow(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
      flushPara();
      const head = cells(line);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && isTableRow(lines[i])) body.push(cells(lines[i++]));
      i--;
      blocks.push(
        <div className="kf-table-wrap" key={`tw-${k++}`}>
          <table>
            <thead>
              <tr>
                {head.map((c, ci) => (
                  <th key={ci}>{inline(c, `th${k}-${ci}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri}>
                  {row.map((c, ci) => (
                    <td key={ci}>{inline(c, `td${k}-${ri}-${ci}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // lists
    const ordered = /^\d+[.)]\s+/.test(trimmed);
    const unordered = /^[-*]\s+/.test(trimmed);
    if (ordered || unordered) {
      flushPara();
      const items: string[] = [];
      const matches = (l: string) =>
        ordered ? /^\d+[.)]\s+/.test(l.trim()) : /^[-*]\s+/.test(l.trim());
      while (i < lines.length && matches(lines[i])) {
        items.push(lines[i].trim().replace(/^(\d+[.)]|[-*])\s+/, ""));
        i++;
      }
      i--;
      const Tag = ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={`l-${k++}`}>
          {items.map((it, ii) => (
            <li key={ii}>{inline(it, `li${k}-${ii}`)}</li>
          ))}
        </Tag>,
      );
      continue;
    }

    para.push(trimmed);
  }

  flushPara();
  return { blocks, headings };
}

/**
 * Reading time in minutes, from the body rather than a field an editor has to
 * keep in step with their own edits.
 *
 * 200 wpm is the usual English figure. Arabic is counted the same way: word
 * counts run lower for the same content, which offsets the slower per-word
 * rate closely enough for a rounded "N min read".
 */
export function readingMinutes(source: string): number {
  const words = (source || "").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
