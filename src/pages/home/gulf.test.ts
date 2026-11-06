import { describe, expect, it } from "vitest";
import { BUDGET_BANDS, budgetEquivalent, budgetLabel, thousands, zoneName } from "./gulf";

const t = (key: string) => key;

describe("thousands", () => {
  it("keeps one decimal under 10k and whole thousands above", () => {
    expect(thousands(7500, "en")).toBe("7.5");
    expect(thousands(7345, "en")).toBe("7.3");
    expect(thousands(18750, "en")).toBe("19");
    expect(thousands(55087.5, "en")).toBe("55");
  });

  it("writes the decimal with a comma in German and French", () => {
    expect(thousands(7500, "de")).toBe("7,5");
    expect(thousands(7500, "fr")).toBe("7,5");
    expect(thousands(7500, "ar")).toBe("7.5");
  });
});

describe("budgetEquivalent", () => {
  it("converts at the official pegs (SAR 3.75, AED 3.6725)", () => {
    expect(budgetEquivalent("Under $2k", "SA", "en", t)).toBe("≈ SAR 7.5k");
    expect(budgetEquivalent("$2k – $5k", "SA", "en", t)).toBe("≈ SAR 7.5k – 19k");
    expect(budgetEquivalent("$5k – $15k", "SA", "en", t)).toBe("≈ SAR 19k – 56k");
    expect(budgetEquivalent("$15k+", "SA", "en", t)).toBe("≈ SAR 56k+");
    expect(budgetEquivalent("Under $2k", "AE", "en", t)).toBe("≈ AED 7.3k");
    expect(budgetEquivalent("$5k – $15k", "AE", "en", t)).toBe("≈ AED 18k – 55k");
  });

  it("shows nothing outside Saudi Arabia and the UAE, before the guess, or for an open band", () => {
    expect(budgetEquivalent("Under $2k", "EG", "en", t)).toBeNull();
    expect(budgetEquivalent("Under $2k", "KW", "en", t)).toBeNull();
    expect(budgetEquivalent("Under $2k", undefined, "en", t)).toBeNull();
    expect(budgetEquivalent("Not sure yet", "SA", "en", t)).toBeNull();
    expect(budgetEquivalent("Unknown band", "SA", "en", t)).toBeNull();
  });

  it("goes through the dictionary for the template and the currency", () => {
    const ar: Record<string, string> = { SAR: "ريال", "≈ {cur} {a}k – {b}k": "≈ {a} – {b} ألف {cur}" };
    expect(budgetEquivalent("$2k – $5k", "SA", "ar", (k) => ar[k] ?? k)).toBe("≈ 7.5 – 19 ألف ريال");
  });
});

describe("budgetLabel", () => {
  it("adds the local equivalent to the translated band, and leaves the value alone", () => {
    expect(budgetLabel("Under $2k", "SA", "en", t)).toBe("Under $2k (≈ SAR 7.5k)");
    expect(budgetLabel("Under $2k", "EG", "en", t)).toBe("Under $2k");
    expect(BUDGET_BANDS.map((b) => b.value)).toEqual(["Under $2k", "$2k – $5k", "$5k – $15k", "$15k+", "Not sure yet"]);
  });
});

describe("zoneName", () => {
  it("names the Gulf and Cairo zones and leaves the rest to the IANA name", () => {
    expect(zoneName("Asia/Riyadh")).toBe("Riyadh time");
    expect(zoneName("Asia/Dubai")).toBe("UAE time");
    expect(zoneName("Europe/Berlin")).toBeUndefined();
  });
});
