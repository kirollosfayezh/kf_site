import { beforeAll, describe, expect, it } from "vitest";
import { primeDict } from "../dict/index.ts";
import { PAGES } from "./pages.ts";
import { fitDesc, fitTitle, resolveDesc, resolveTitle } from "./text.ts";

describe("fitTitle", () => {
  it("leaves a title that fits the results page alone", () => {
    expect(fitTitle("Book a Free Call | KF Tech Solutions")).toBe("Book a Free Call | KF Tech Solutions");
  });

  it("drops the trailing brand from an over-long title instead of cutting the headline", () => {
    const long = "How a restaurant owner should actually decide between POS systems | KF Tech Solutions";
    expect(fitTitle(long)).toBe("How a restaurant owner should actually decide between POS systems");
  });

  it("handles every separator the titles use", () => {
    const headline = "A very long headline about custom software for growing businesses in Egypt";
    for (const sep of ["|", "—", "–", "-"]) expect(fitTitle(`${headline} ${sep} KF Tech`)).toBe(headline);
  });

  it("never cuts a long title that has no brand suffix", () => {
    const long = "x".repeat(90);
    expect(fitTitle(long)).toBe(long);
  });
});

describe("fitDesc", () => {
  it("collapses whitespace and keeps a short description whole", () => {
    expect(fitDesc("  Custom software,\n  built   for you.  ")).toBe("Custom software, built for you.");
  });

  it("ends on a whole sentence when one fits", () => {
    const first = "We build point-of-sale systems, dashboards and integrations for restaurants and shops across Egypt.";
    const desc = `${first} Every project starts with a free scoping call and a fixed written quote before any code is written.`;
    expect(fitDesc(desc)).toBe(first);
  });

  it("otherwise cuts at a word boundary with an ellipsis, never mid-word", () => {
    const desc = `${"software ".repeat(30)}end`;
    const out = fitDesc(desc);
    expect(out.length).toBeLessThanOrEqual(160);
    expect(out.endsWith("software…")).toBe(true);
  });
});

describe("resolveTitle / resolveDesc", () => {
  beforeAll(() => {
    primeDict("de", { [PAGES.about.title]: "Über KF Tech Solutions", [PAGES.about.desc]: "Ein Software-Studio." });
  });

  it("returns the English text for English", () => {
    expect(resolveTitle(PAGES.about, "en")).toBe(PAGES.about.title);
  });

  it("translates the built-in English through the dictionary", () => {
    expect(resolveTitle(PAGES.about, "de")).toBe("Über KF Tech Solutions");
    expect(resolveDesc(PAGES.about, "de")).toBe("Ein Software-Studio.");
  });

  it("falls back to English when the dictionary has no entry", () => {
    expect(resolveTitle(PAGES.contact, "fr")).toBe(PAGES.contact.title);
  });

  it("lets an editor's explicit translation win over the dictionary", () => {
    const page = { ...PAGES.about, titleByLang: { de: "  Wer wir sind  " }, descByLang: { de: "   " } };
    expect(resolveTitle(page, "de")).toBe("Wer wir sind");
    // A blank override inherits rather than clearing.
    expect(resolveDesc(page, "de")).toBe("Ein Software-Studio.");
  });
});
