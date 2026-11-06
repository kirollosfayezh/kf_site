import { beforeAll, describe, expect, it } from "vitest";
import { articleExtras, initials, listedIn, metaPoints, metaString, pick, pickPlain, postRegions } from "./content-helpers";
import { primeDict, setOverrides } from "./dict";

beforeAll(() => {
  primeDict("ar", {
    "POS Systems": "أنظمة نقاط البيع",
    "Fast setup": "إعداد سريع",
    "A receipt printer": "طابعة إيصالات",
    "compliance": "الامتثال",
    "typical integration time": "مدة الربط المعتادة",
  });
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

describe("articleExtras (caption, alt, stats, tags in one language)", () => {
  // English at the top of `meta`, as the seeder writes it for every article.
  const english = {
    caption: "Every receipt is a document.",
    alt: "A receipt printer",
    stats: [["4-6 weeks", "typical integration time"], ["bad"], "x"],
    tags: ["POS", "compliance"],
  };

  it("uses a translation's own extras, as written", () => {
    const meta = {
      ...english,
      i18n: {
        ar: {
          caption: "كل إيصال مستند.",
          alt: "طابعة على طاولة",
          stats: [["٤–٦ أسابيع", "مدة الربط"]],
          tags: ["نقاط البيع", "الفوترة الإلكترونية", "السعودية"],
        },
      },
    };
    expect(articleExtras(meta, "ar")).toEqual({
      caption: "كل إيصال مستند.",
      alt: "طابعة على طاولة",
      stats: [{ value: "٤–٦ أسابيع", label: "مدة الربط" }],
      tags: ["نقاط البيع", "الفوترة الإلكترونية", "السعودية"],
    });
    // Another language, and English itself, are untouched by the Arabic extras.
    expect(articleExtras(meta, "en").caption).toBe("Every receipt is a document.");
    expect(articleExtras(meta, "de").tags).toEqual(["POS", "compliance"]);
  });

  it("falls back to the English value through the dictionary, as before (no meta.i18n)", () => {
    expect(articleExtras(english, "ar")).toEqual({
      caption: "Every receipt is a document.", // no dictionary entry: English
      alt: "طابعة إيصالات",
      stats: [{ value: "4-6 weeks", label: "مدة الربط المعتادة" }], // malformed rows skipped
      tags: ["POS", "الامتثال"],
    });
    expect(articleExtras(english, "en")).toEqual({
      caption: "Every receipt is a document.",
      alt: "A receipt printer",
      stats: [{ value: "4-6 weeks", label: "typical integration time" }],
      tags: ["POS", "compliance"],
    });
  });

  it("falls back key by key, and lists as a whole", () => {
    const meta = { ...english, i18n: { ar: { caption: "تعليق", tags: [], stats: [["only one"]] } } };
    const extras = articleExtras(meta, "ar");
    expect(extras.caption).toBe("تعليق");
    expect(extras.alt).toBe("طابعة إيصالات");
    expect(extras.tags).toEqual(["POS", "الامتثال"]); // an empty own list is no list
    expect(extras.stats).toEqual([{ value: "4-6 weeks", label: "مدة الربط المعتادة" }]);
  });

  it("is empty for a post without extras, and ignores an i18n bag of the wrong shape", () => {
    expect(articleExtras(undefined, "ar")).toEqual({ caption: undefined, alt: undefined, stats: [], tags: [] });
    expect(articleExtras({ ...english, i18n: "ar" }, "ar").alt).toBe("طابعة إيصالات");
    expect(articleExtras({ ...english, i18n: { ar: ["x"] } }, "ar").alt).toBe("طابعة إيصالات");
  });
});

describe("listedIn (blog cards per language)", () => {
  it("lists a card everywhere unless it names its languages", () => {
    expect(listedIn({ tag: "POS" }, "de")).toBe(true);
    expect(listedIn(undefined, "fr")).toBe(true);
    expect(listedIn({ langs: ["en", "ar"] }, "ar")).toBe(true);
    expect(listedIn({ langs: ["en", "ar"] }, "de")).toBe(false);
  });
});

describe("postRegions", () => {
  it("reads the regions from the English tags, case-insensitively", () => {
    expect(postRegions({ tags: ["outsourcing", "Egypt", "Saudi Arabia", "UAE", "GCC"] })).toEqual([
      "Saudi Arabia",
      "UAE",
      "GCC",
      "Egypt",
    ]);
    expect(postRegions({ tags: [" ksa ", "payments"] })).toEqual(["Saudi Arabia"]);
    expect(postRegions({ tags: ["Dubai", "real estate CRM"] })).toEqual(["UAE"]);
  });

  it("puts Kuwait, Qatar, Bahrain and Oman under GCC", () => {
    for (const country of ["Kuwait", "Qatar", "Bahrain", "Oman"]) {
      expect(postRegions({ tags: [country] })).toEqual(["GCC"]);
    }
  });

  it("finds nothing in an untagged post or in translated tags", () => {
    expect(postRegions({ tags: ["POS", "compliance"] })).toEqual([]);
    expect(postRegions(undefined)).toEqual([]);
    expect(postRegions({ tags: ["POS"], i18n: { ar: { tags: ["مصر"] } } })).toEqual([]);
  });
});

describe("initials", () => {
  it("takes the first letter of the first two words", () => {
    expect(initials("kirollos fayez hanna")).toBe("KF");
    expect(initials("  Acme  ")).toBe("A");
  });
});
