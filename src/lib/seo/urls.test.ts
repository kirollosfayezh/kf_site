import { describe, expect, it } from "vitest";
import { absolute, languageAlternates, localePath } from "./urls.ts";

describe("localePath", () => {
  it("keeps English at the root and prefixes every other language", () => {
    expect(localePath("en", "/services")).toBe("/services");
    expect(localePath("ar", "/services")).toBe("/ar/services");
    expect(localePath("de", "/blog/x")).toBe("/de/blog/x");
  });

  it("maps the homepage to the bare language prefix, with no trailing slash", () => {
    expect(localePath("en", "/")).toBe("/");
    expect(localePath("fr", "/")).toBe("/fr");
  });
});

describe("absolute", () => {
  it("joins an origin and a path", () => {
    expect(absolute("https://kf.test", "/about")).toBe("https://kf.test/about");
    expect(absolute("https://kf.test", "icon.png")).toBe("https://kf.test/icon.png");
  });

  it("passes an absolute URL through untouched", () => {
    expect(absolute("https://kf.test", "https://images.unsplash.com/x")).toBe("https://images.unsplash.com/x");
  });
});

describe("languageAlternates", () => {
  it("lists one URL per language plus x-default pointing at English", () => {
    expect(languageAlternates("https://kf.test", "/services", ["en", "ar"])).toEqual([
      { hreflang: "en", href: "https://kf.test/services" },
      { hreflang: "ar", href: "https://kf.test/ar/services" },
      { hreflang: "x-default", href: "https://kf.test/services" },
    ]);
  });
});
