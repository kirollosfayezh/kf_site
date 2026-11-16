import { describe, expect, it } from "vitest";
import type { SiteSettings } from "../services/api-types";
import { DEFAULT_CONTACT, DEFAULT_SOCIAL, identityFromSettings, resolveContact, resolveDirectories, resolveSocial, whatsappDigits } from "./contact";

describe("resolveContact", () => {
  it("uses the dashboard value per field and the default for blanks", () => {
    expect(resolveContact({ email: " hello@kf.test ", phone: "", whatsapp: "+20 100 000 0000" })).toEqual({
      email: "hello@kf.test",
      phone: DEFAULT_CONTACT.phone,
      whatsapp: "201000000000",
    });
    expect(resolveContact(null)).toEqual(DEFAULT_CONTACT);
  });
});

describe("whatsappDigits", () => {
  it("strips everything wa.me does not accept", () => {
    expect(whatsappDigits("+20 (150) 009-9671")).toBe("201500099671");
  });
});

describe("resolveSocial", () => {
  it("falls back to the company profiles when nothing is configured", () => {
    expect(resolveSocial({ x: " ", facebook: "" })).toEqual([
      { key: "facebook", href: DEFAULT_SOCIAL.facebook },
      { key: "instagram", href: DEFAULT_SOCIAL.instagram },
      { key: "linkedin", href: DEFAULT_SOCIAL.linkedin },
      { key: "tiktok", href: DEFAULT_SOCIAL.tiktok },
      { key: "snapchat", href: DEFAULT_SOCIAL.snapchat },
    ]);
  });

  it("turns a Snapchat username into its add link", () => {
    expect(resolveSocial({ snapchat: "@kftechsolutions" })).toEqual([
      { key: "snapchat", href: "https://www.snapchat.com/add/kftechsolutions" },
    ]);
  });

  it("shows exactly the configured profiles, turning an X handle into a URL", () => {
    expect(resolveSocial({ x: "@kftech", github: "not-a-url", linkedin: "https://linkedin.com/company/kf" })).toEqual([
      { key: "linkedin", href: "https://linkedin.com/company/kf" },
      { key: "x", href: "https://x.com/kftech" },
    ]);
  });

  it("feeds the Organization schema's sameAs", () => {
    const settings = { contact: {}, social: { x: "kftech" } } as Pick<SiteSettings, "contact" | "social"> as SiteSettings;
    expect(identityFromSettings(settings).sameAs).toEqual(["https://x.com/kftech"]);
    expect(identityFromSettings(null).email).toBe(DEFAULT_CONTACT.email);
  });
});

describe("identityFromSettings", () => {
  it("forwards every brand field, the founder's profiles under the Person's name for them", () => {
    const brand = {
      alternateNames: { en: ["KFT"], ar: ["كي إف تك"], de: [], fr: [] },
      foundingDate: "2020",
      founderProfiles: ["https://github.com/someone"],
      profiles: ["https://clutch.co/profile/kf"],
      notAffiliatedWith: [{ name: "Other KF", url: "https://other.test" }],
    };
    const settings = { contact: {}, social: {}, brand } as Pick<SiteSettings, "contact" | "social" | "brand"> as SiteSettings;
    expect(identityFromSettings(settings)).toMatchObject({
      alternateNames: brand.alternateNames,
      foundingDate: "2020",
      founderSameAs: brand.founderProfiles,
      profiles: brand.profiles,
      notAffiliatedWith: brand.notAffiliatedWith,
    });
  });

  it("leaves the brand fields undefined without settings, so each falls back on its own", () => {
    const id = identityFromSettings(null);
    for (const key of ["alternateNames", "foundingDate", "founderSameAs", "profiles", "notAffiliatedWith"] as const) {
      expect(id[key]).toBeUndefined();
    }
  });
});

describe("resolveDirectories", () => {
  const FALLBACK = ["https://www.snapchat.com/add/kf", "https://clutch.co/profile/kf", "https://themanifest.com/company/kf"];

  it("names the directories in the compiled fallback when settings list none", () => {
    for (const empty of [undefined, null, [], ["  "]]) {
      expect(resolveDirectories(empty, FALLBACK)).toEqual([
        { href: "https://clutch.co/profile/kf", name: "Clutch" },
        { href: "https://themanifest.com/company/kf", name: "The Manifest" },
      ]);
    }
  });

  it("uses the settings list instead of the fallback once it has an entry, as the schema does", () => {
    expect(resolveDirectories(["https://www.snapchat.com/add/kf"], FALLBACK)).toEqual([]);
    expect(resolveDirectories([" https://www.goodfirms.co/company/kf ", "https://techbehemoths.com/company/kf"], FALLBACK)).toEqual([
      { href: "https://www.goodfirms.co/company/kf", name: "GoodFirms" },
      { href: "https://techbehemoths.com/company/kf", name: "TechBehemoths" },
    ]);
  });

  it("skips what it cannot name or trust: unknown hosts, malformed and non-https URLs, repeats", () => {
    expect(
      resolveDirectories(
        ["not a url", "http://clutch.co/profile/kf", "https://example.com/kf", "https://clutch.co/profile/kf", "https://clutch.co/profile/kf"],
        FALLBACK,
      ),
    ).toEqual([{ href: "https://clutch.co/profile/kf", name: "Clutch" }]);
  });
});
