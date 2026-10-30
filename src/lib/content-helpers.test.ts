import { beforeAll, describe, expect, it } from "vitest";
import { initials, metaPoints, metaString, pick, pickPlain } from "./content-helpers";
import { primeDict, setOverrides } from "./dict";

beforeAll(() => {
  primeDict("ar", { "POS Systems": "أنظمة نقاط البيع", "Fast setup": "إعداد سريع" });
});

describe("pick (CMS field → visible text)", () => {
  it("returns the stored value for the requested language", () => {
    expect(pick({ en: "POS Systems", ar: "نقاط بيع" }, "ar")).toBe("نقاط بيع");
  });

  it("falls back to the dictionary when the CMS was seeded with an empty translation", () => {
    expect(pick({ en: "POS Systems", ar: "" }, "ar")).toBe("أنظمة نقاط البيع");
    expect(pick({ en: "POS Systems", ar: "   " }, "ar")).toBe("أنظمة نقاط البيع");
  });

  it("falls back to English when neither the CMS nor the dictionary has it", () => {
    expect(pick({ en: "Something new", ar: "" }, "ar")).toBe("Something new");
    expect(pick({ en: "POS Systems", ar: "" }, "de")).toBe("POS Systems");
  });

  it("uses the Arabic text when English itself is empty", () => {
    expect(pick({ en: "", ar: "نص" }, "en")).toBe("نص");
  });

  it("is empty for a missing field", () => {
    expect(pick(undefined, "en")).toBe("");
  });

  it("lets a dashboard wording override reach CMS text through the dictionary", () => {
    setOverrides("ar", { "POS Systems": "نقاط البيع (معدل)" });
    expect(pick({ en: "POS Systems", ar: "" }, "ar")).toBe("نقاط البيع (معدل)");
    setOverrides("ar", {});
  });
});

describe("pickPlain", () => {
  it("translates plain strings such as meta.points through the dictionary", () => {
    expect(pickPlain(" Fast setup ", "ar")).toBe("إعداد سريع");
    expect(pickPlain("Fast setup", "en")).toBe("Fast setup");
    expect(pickPlain("Unknown", "ar")).toBe("Unknown");
    expect(pickPlain(undefined, "ar")).toBe("");
  });
});

describe("meta narrowing", () => {
  it("reads a non-blank string and treats anything else as absent", () => {
    expect(metaString({ client: "Acme" }, "client")).toBe("Acme");
    expect(metaString({ client: "  " }, "client")).toBeUndefined();
    expect(metaString({ client: 3 }, "client")).toBeUndefined();
    expect(metaString(undefined, "client")).toBeUndefined();
  });

  it("keeps only non-blank strings from a points list", () => {
    expect(metaPoints({ points: ["React", "", 4, null, "Node"] })).toEqual(["React", "Node"]);
    expect(metaPoints({ points: "React" })).toEqual([]);
    expect(metaPoints({ tags: ["a"] }, "tags")).toEqual(["a"]);
  });
});

describe("initials", () => {
  it("takes the first letter of the first two words", () => {
    expect(initials("kirollos fayez hanna")).toBe("KF");
    expect(initials("  Acme  ")).toBe("A");
  });
});
