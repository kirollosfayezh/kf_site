import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { renderRichText } from "./rich-text.tsx";

const html = (md: string) => renderToStaticMarkup(createElement(Fragment, null, ...renderRichText(md).blocks));

describe("renderRichText lists", () => {
  it("keeps a hard-wrapped item's next lines inside the item", () => {
    const out = html("- **Whether items have variants.** Clothing has sizes. Phones have\n  serial numbers and IMEIs.\n- Second item");
    expect(out).toBe(
      "<ul><li><strong>Whether items have variants.</strong> Clothing has sizes. Phones have serial numbers and IMEIs.</li><li>Second item</li></ul>",
    );
  });

  it("keeps a numbered list in one <ol> when its items wrap", () => {
    const out = html("1. First step that is long\n   and wraps here.\n2. Second step\n   also wraps.\n3. Third");
    expect(out).toBe("<ol><li>First step that is long and wraps here.</li><li>Second step also wraps.</li><li>Third</li></ol>");
  });

  it("continues numbering when a blank line splits a numbered list", () => {
    expect(html("1. One\n\n2. Two")).toBe("<ol><li>One</li></ol><ol start=\"2\"><li>Two</li></ol>");
  });

  it("does not swallow a heading, table, quote or new paragraph after a list", () => {
    const out = html("- Item\n## Next\n\nParagraph text.");
    expect(out).toBe('<ul><li>Item</li></ul><h2 id="next">Next</h2><p>Paragraph text.</p>');
  });

  it("still splits an unordered list from a following ordered one", () => {
    expect(html("- a\n1. b")).toBe("<ul><li>a</li></ul><ol><li>b</li></ol>");
  });
});

describe("renderRichText site links", () => {
  const inLang = async (lang: "en" | "ar" | "de", md: string) => {
    const { MemoryRouter } = await import("react-router-dom");
    const { I18nProvider } = await import("./i18n.tsx");
    return renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { basename: lang === "en" ? undefined : `/${lang}`, initialEntries: [lang === "en" ? "/" : `/${lang}`] },
        createElement(I18nProvider, { initialLang: lang, enabled: ["en", "ar", "de", "fr"], children: renderRichText(md).blocks }),
      ),
    );
  };

  it("keeps a country-page link in the reader's language where the page exists", async () => {
    expect(await inLang("ar", "See [the UAE page](/uae).")).toContain('href="/ar/uae"');
  });

  it("sends a German reader to the English country page, which is the only one", async () => {
    const out = await inLang("de", "Siehe [VAE](/uae) und [Leistungen](/services/automation).");
    expect(out).toContain('<a href="/uae" hrefLang="en">VAE</a>');
    expect(out).toContain('href="/de/services/automation"');
  });
});
