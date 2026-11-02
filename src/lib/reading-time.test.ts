import { describe, expect, it } from "vitest";
import { cardMinutes, cardView, readingMinutes } from "./reading-time";

const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

describe("cardView", () => {
  it("drops the body and keeps the reading time per language, falling back to English", () => {
    const card = cardView({ title: { en: "T" }, body: { en: words(1000), ar: words(400), de: " " }, meta: { tag: "POS" } });
    expect(card).not.toHaveProperty("body");
    expect(card.meta).toEqual({ tag: "POS", readingMinutes: { en: 5, ar: 2, de: 5, fr: 5 } });
  });

  it("counts Arabic when there is no English body", () => {
    expect((cardView({ body: { ar: words(600) }, meta: {} }).meta as Record<string, unknown>).readingMinutes).toEqual({ en: 3, ar: 3, de: 3, fr: 3 });
  });

  it("leaves an item without a body as it is", () => {
    const item = { title: { en: "T" }, meta: {} };
    expect(cardView(item)).toBe(item);
  });
});

describe("cardMinutes", () => {
  const pickEn = (body: unknown) => (body as { en?: string } | undefined)?.en ?? "";

  it("reads the card's stored minutes for the language", () => {
    expect(cardMinutes({ meta: { readingMinutes: { en: 7, ar: 4 } } }, "ar", pickEn)).toBe(4);
  });

  it("counts the body when the item is not a card (an older cached list)", () => {
    expect(cardMinutes({ body: { en: words(800) } }, "en", pickEn)).toBe(readingMinutes(words(800)));
  });
});
