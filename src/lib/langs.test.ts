import { describe, expect, it } from "vitest";
import { LANGS, dirOf, isLang } from "./langs";

describe("language primitives", () => {
  it("ships exactly English, Arabic, German and French", () => {
    expect([...LANGS]).toEqual(["en", "ar", "de", "fr"]);
  });

  it("recognises only supported language codes", () => {
    expect(isLang("ar")).toBe(true);
    expect(isLang("es")).toBe(false);
    expect(isLang(undefined)).toBe(false);
    expect(isLang("AR")).toBe(false);
  });

  it("lays Arabic out right-to-left and everything else left-to-right", () => {
    expect(dirOf("ar")).toBe("rtl");
    expect(LANGS.filter((l) => l !== "ar").map(dirOf)).toEqual(["ltr", "ltr", "ltr"]);
  });
});

