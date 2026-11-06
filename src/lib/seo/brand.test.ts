import { beforeAll, describe, expect, it } from "vitest";
import { ABOUT_IDENTITY, BRAND_FAQS, COPYRIGHT_KEY, HERO_LEDE } from "../brand-copy.ts";
import ar from "../dict/ar.json";
import de from "../dict/de.json";
import fr from "../dict/fr.json";
import { primeDict, translate } from "../dict/index.ts";
import { FALLBACK_FAQS } from "../fallback-content.ts";
import { LANGS } from "../langs.ts";

/**
 * The copy that says which "KF Tech" this is. A missing entry would not fail
 * loudly — `t()` falls back to the English key — so an Arabic About page could
 * quietly carry an English paragraph on exactly the text meant to separate the
 * brand from a namesake.
 */
const DICTS: Record<string, Record<string, string>> = { ar, de, fr };
const FAQ_KEYS = FALLBACK_FAQS.flatMap((f) => [f.q, f.a]);
const KEYS = [...Object.values(ABOUT_IDENTITY), HERO_LEDE, COPYRIGHT_KEY, ...FAQ_KEYS];

// The only values allowed to open with the Latin brand: the alias list (it *is*
// Latin names) and nothing else. Everything else leads with Arabic so a
// plain-text surface keeps the line right-to-left.
const LATIN_LEAD = new Set<string>([ABOUT_IDENTITY.aliases]);

describe("brand copy dictionaries", () => {
  it.each(Object.keys(DICTS))("translates every brand key into %s", (lang) => {
    const missing = KEYS.filter((k) => !DICTS[lang][k]?.trim());
    expect(missing).toEqual([]);
  });

  it("keeps every Arabic value right-to-left from its first character", () => {
    const wrong = KEYS.filter((k) => {
      const v = ar[k as keyof typeof ar] as string;
      if (LATIN_LEAD.has(k)) return !/^(KF|[؀-ۿ])/.test(v);
      return !/^([؀-ۿ]|\/\/|©|\d)/.test(v);
    });
    expect(wrong).toEqual([]);
  });

  it("gives the Arabic alias once, in the Arabic values only", () => {
    expect(ar[ABOUT_IDENTITY.aliases as keyof typeof ar]).toContain("كي إف تك");
    expect(ar[HERO_LEDE as keyof typeof ar]).toContain("كي إف تك");
    expect(de[ABOUT_IDENTITY.aliases as keyof typeof de]).toBe(ABOUT_IDENTITY.aliases);
  });
});

describe("brand FAQs", () => {
  beforeAll(() => {
    primeDict("ar", ar);
    primeDict("de", de);
    primeDict("fr", fr);
  });

  it("are part of the one fallback list the pages and the prerender share", () => {
    const questions = FALLBACK_FAQS.map((f) => f.q);
    expect(questions).toEqual(expect.arrayContaining(BRAND_FAQS.map((f) => f.q)));
    expect(questions).toContain("Is KF Tech Solutions the same as KFTECH Software Solutions?");
    expect(new Set(questions).size).toBe(questions.length);
  });

  it.each(LANGS)("name the official website in %s", (lang) => {
    const official = BRAND_FAQS.find((f) => f.q.startsWith("What is the official website"));
    expect(official).toBeDefined();
    expect(translate(official!.a, lang)).toContain("kftechsolutions.dev");
  });

  it.each(LANGS)("name the unrelated namesake by its domain in %s", (lang) => {
    const namesake = BRAND_FAQS.find((f) => f.q.includes("KFTECH Software Solutions"))!;
    expect(translate(namesake.a, lang)).toContain("kftechsols.com");
  });
});
