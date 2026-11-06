import { afterEach, describe, expect, it } from "vitest";
import { SITE, allAlternateNames, disambiguation, resetSiteIdentity, setSiteIdentity, siteIdentity } from "./site.ts";

afterEach(resetSiteIdentity);

describe("setSiteIdentity", () => {
  it("starts from the compiled facts, the Arabic alias and Snapchat included", () => {
    const id = siteIdentity();
    expect(id.alternateNames).toEqual({ en: ["KF Tech", "KFTech", "KFTech Solutions"], ar: ["كي إف تك"], de: [], fr: [] });
    expect(id.sameAs).toEqual([...SITE.sameAs, ...SITE.extraSameAs]);
    expect(id.foundingDate).toBe("2020");
    expect(id.founderSameAs).toEqual([...SITE.founderSameAs]);
    expect(id.notAffiliatedWith).toEqual([...SITE.notAffiliatedWith]);
  });

  it("falls back per field: a blank or empty value keeps the compiled default", () => {
    setSiteIdentity({
      phone: " ",
      email: "hello@kf.test",
      alternateNames: { en: [], ar: [" ", "كيه إف"] },
      foundingDate: "",
      founderSameAs: [],
      profiles: [],
      notAffiliatedWith: [{ name: "", url: "" }],
    });
    const id = siteIdentity();
    expect(id.phone).toBe(SITE.phone);
    expect(id.email).toBe("hello@kf.test");
    expect(id.alternateNames.en).toEqual([...SITE.alternateName]);
    expect(id.alternateNames.ar).toEqual(["كيه إف"]);
    expect(id.foundingDate).toBe(SITE.foundingDate);
    expect(id.founderSameAs).toEqual([...SITE.founderSameAs]);
    expect(id.sameAs).toEqual([...SITE.sameAs, ...SITE.extraSameAs]);
    expect(id.notAffiliatedWith).toEqual([...SITE.notAffiliatedWith]);
  });

  it("puts the social profiles first and the directories after, without duplicates", () => {
    setSiteIdentity({
      sameAs: ["https://www.linkedin.com/company/kf/"],
      profiles: ["https://clutch.co/profile/kf", "https://www.linkedin.com/company/kf/"],
    });
    expect(siteIdentity().sameAs).toEqual(["https://www.linkedin.com/company/kf/", "https://clutch.co/profile/kf"]);
  });

  it("is restored by resetSiteIdentity", () => {
    setSiteIdentity({ foundingDate: "2019" });
    resetSiteIdentity();
    expect(siteIdentity().foundingDate).toBe("2020");
  });
});

describe("allAlternateNames", () => {
  it("lists the Latin forms first, then the Arabic, each once", () => {
    setSiteIdentity({ alternateNames: { en: ["KF Tech", "KFTech"], ar: ["كي إف تك"], de: ["KFTech", "KF Technik"] } });
    expect(allAlternateNames()).toEqual(["KF Tech", "KFTech", "KF Technik", "كي إف تك"]);
  });
});

describe("disambiguation", () => {
  it("names the city, founder, year, the one website and the namesake", () => {
    expect(disambiguation("https://kftechsolutions.dev")).toBe(
      "KF Tech Solutions is a software studio in Cairo, Egypt, founded by Kirollos Fayez in 2020; " +
        "its only website is kftechsolutions.dev. It is not affiliated with KFTECH Software Solutions (kftechsols.com).",
    );
  });

  it("follows the identity an editor set", () => {
    setSiteIdentity({ foundingDate: "2019", notAffiliatedWith: [{ name: "Other KF", url: "https://other.test/x" }] });
    expect(disambiguation("https://kf.test")).toMatch(/in 2019; its only website is kf\.test\. It is not affiliated with Other KF \(other\.test\)\.$/);
  });

  it("drops the clause when there is no namesake to name", () => {
    expect(disambiguation("https://kf.test", { foundingDate: "2020", notAffiliatedWith: [] })).toBe(
      "KF Tech Solutions is a software studio in Cairo, Egypt, founded by Kirollos Fayez in 2020; its only website is kf.test.",
    );
  });
});
