import { describe, expect, it } from "vitest";
import { cardMinutes, cardView, readingMinutes } from "./reading-time";

const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

describe("cardView", () => {
  it("drops the body and keeps the reading time per language, falling back to English", () => {
    const card = cardView({ title: { en: "T" }, body: { en: words(1000), ar: words(400), de: " " }, meta: { tag: "POS" } });
    expect(card).not.toHaveProperty("body");
    expect(card.meta).toEqual({ tag: "POS", readingMinutes: { en: 5, ar: 2, de: 5, fr: 5 }, langs: ["en"] });
  });

  it("counts Arabic when there is no English body", () => {
    expect((cardView({ body: { ar: words(600) }, meta: {} }).meta as Record<string, unknown>).readingMinutes).toEqual({ en: 3, ar: 3, de: 3, fr: 3 });
  });

  it("leaves an item without a body as it is", () => {
    const item = { title: { en: "T" }, meta: {} };
    expect(cardView(item)).toBe(item);
  });

  const full = {
    id: "1",
    slug: "zatca",
    published: true,
    order: 3,
    title: { en: "T", ar: "ع", de: "D", fr: "F" },
    summary: { en: "S", ar: "م", de: "", fr: "SF" },
    body: { en: words(400), ar: words(200), de: words(400), fr: words(400) },
    media: ["https://images.unsplash.com/photo-1"],
    meta: {
      tag: "Business Systems",
      tags: ["e-invoicing", "Saudi Arabia"],
      caption: "C",
      alt: "A",
      stats: [["1", "x"]],
      i18n: { ar: { caption: "ت", tags: ["السعودية"] } },
    },
    createdAt: "2026-11-06T00:00:00.000Z",
    updatedAt: "2026-11-06T00:00:00.000Z",
  };

  it("keeps only what a card reads: the category, the tags, ids, dates and the photo", () => {
    const card = cardView(full);
    expect(card.meta).toEqual({
      tag: "Business Systems",
      tags: ["e-invoicing", "Saudi Arabia"],
      readingMinutes: { en: 2, ar: 1, de: 2, fr: 2 },
    });
    expect(card).not.toHaveProperty("published");
    expect(card).toMatchObject({ id: "1", slug: "zatca", order: 3, title: full.title, summary: full.summary, media: full.media });
    expect(card.updatedAt).toBe(full.updatedAt);
  });

  it("names the languages a post is written in only when that is not all four", () => {
    const enAr = { ...full, title: { en: "T", ar: "ع", de: "D", fr: "" }, body: { en: "x", ar: "y", de: "", fr: "z" } };
    // German has a title but no body, French a body but no title: neither counts.
    expect((cardView(enAr).meta as Record<string, unknown>).langs).toEqual(["en", "ar"]);
    expect(cardView(full).meta).not.toHaveProperty("langs");
  });

  it("trims to one language's title, summary and minutes when given one", () => {
    const ar = cardView(full, "ar");
    expect(ar.title).toEqual({ ar: "ع" });
    expect(ar.summary).toEqual({ ar: "م" });
    expect(ar.meta).toEqual({ tag: "Business Systems", tags: ["e-invoicing", "Saudi Arabia"], readingMinutes: { ar: 1 } });
    // A blank translation keeps English beside it, which is what pick() falls back to.
    expect(cardView(full, "de").summary).toEqual({ de: "", en: "S" });
    expect(cardView({ ...full, summary: { en: "", ar: "م" } }, "fr").summary).toEqual({ en: "", ar: "م" });
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
