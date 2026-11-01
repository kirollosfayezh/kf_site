import { describe, expect, it } from "vitest";
import type { SiteSettings } from "../services/api-types";
import { DEFAULT_CONTACT, DEFAULT_SOCIAL, identityFromSettings, resolveContact, resolveSocial, whatsappDigits } from "./contact";

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
