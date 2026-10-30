import { describe, expect, it } from "vitest";
import ar from "./ar.json";
import de from "./de.json";
import fr from "./fr.json";
import { dictFor, hasOverrides, isDictLoaded, loadDict, primeDict, setOverrides, translate } from "./index";

describe("translate", () => {
  it("returns the key itself for English — the key is the English copy", () => {
    expect(translate("Start a project", "en")).toBe("Start a project");
  });

  it("returns English display markup where a component needs it", () => {
    expect(translate("Custom software built to run on, not to demo well.", "en")).toContain("*run*");
  });

  it("translates through a loaded dictionary and falls back to the key", () => {
    primeDict("fr", { Contact: "Contact FR", Blank: "  " });
    expect(translate("Contact", "fr")).toBe("Contact FR");
    expect(translate("Missing key", "fr")).toBe("Missing key");
    expect(translate("Blank", "fr")).toBe("Blank");
  });

  it("lets a dashboard override win in any language, English included", () => {
    setOverrides("en", { "Start a project": "Let's talk" });
    expect(translate("Start a project", "en")).toBe("Let's talk");
    expect(hasOverrides("en")).toBe(true);
    setOverrides("en", {});
  });
});

describe("dictFor", () => {
  it("layers overrides over the shipped dictionary", () => {
    primeDict("de", { A: "a-de", B: "b-de" });
    setOverrides("de", { B: "b-override" });
    expect(dictFor("de")).toEqual({ A: "a-de", B: "b-override" });
    // Re-priming invalidates the merged view.
    primeDict("de", { A: "a2" });
    expect(dictFor("de")).toEqual({ A: "a2", B: "b-override" });
  });
});

describe("shipped dictionaries", () => {
  it("loads the Arabic dictionary on demand, once", async () => {
    const ar = await loadDict("ar");
    expect(isDictLoaded("ar")).toBe(true);
    expect(ar["Home"]).toBe("الرئيسية");
    expect(await loadDict("ar")).toBe(ar);
  });

  it("translates every key into all three languages, with no blanks", () => {
    const keys = new Set([...Object.keys(ar), ...Object.keys(de), ...Object.keys(fr)]);
    const blank = [...keys].filter((k) => ![ar, de, fr].every((d: Record<string, string>) => d[k]?.trim()));
    expect(keys.size).toBeGreaterThan(400);
    expect(blank).toEqual([]);
  });
});
