import { describe, expect, it } from "vitest";
import { extractFaq } from "./faq";

const article = `
# Choosing a POS

Intro paragraph.

## Frequently asked questions

### How long does it take?

Usually **four to six** weeks, see [our process](/about).

### Does it work offline?

Yes — sales queue locally and sync later.
- a list item that is not prose

### An unanswered question

## Next steps

### Not part of the FAQ

Ignored.
`;

describe("extractFaq", () => {
  it("collects question/answer pairs from the FAQ section only", () => {
    expect(extractFaq(article)).toEqual([
      { q: "How long does it take?", a: "Usually four to six weeks, see our process." },
      { q: "Does it work offline?", a: "Yes — sales queue locally and sync later." },
    ]);
  });

  it("recognises the FAQ heading in other languages and with Windows line endings", () => {
    const ar = "## أسئلة شائعة\r\n\r\n### كم المدة؟\r\n\r\nأربعة أسابيع.\r\n";
    expect(extractFaq(ar)).toEqual([{ q: "كم المدة؟", a: "أربعة أسابيع." }]);
  });

  it("returns nothing for a body without an FAQ section", () => {
    expect(extractFaq("## Overview\n\n### Q\n\nA")).toEqual([]);
    expect(extractFaq("")).toEqual([]);
  });
});
