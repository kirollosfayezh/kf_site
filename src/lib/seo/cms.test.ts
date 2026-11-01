import { describe, expect, it } from "vitest";
import { articlePageSeo, availableLangs, legalPageSeo, projectPageSeo, projectSchema } from "./cms.ts";
import { servicePageSeo, serviceLangs } from "./service-page.ts";

describe("availableLangs", () => {
  it("always includes English and counts a translation only when title and body both exist", () => {
    const post = {
      title: { en: "T", ar: "ع", de: "T-de", fr: "" },
      body: { en: "B", ar: "نص", de: "  ", fr: "B-fr" },
    };
    expect(availableLangs(post)).toEqual(["en", "ar"]);
  });

  it("is limited to the languages the site has switched on", () => {
    const post = { title: { en: "T", ar: "ع" }, body: { en: "B", ar: "نص" } };
    expect(availableLangs(post, ["en", "de"])).toEqual(["en"]);
  });
});

describe("articlePageSeo", () => {
  const post = {
    id: "abc",
    slug: "erp-guide",
    title: { en: "ERP for small business" },
    summary: { en: "" },
    body: { en: "First   line.\nSecond line." },
    meta: { tag: "Guides", category: "ignored" },
    createdAt: "2026-03-01",
    updatedAt: "2026-04-01",
  };

  it("builds the path from the slug and brands the title", () => {
    const seo = articlePageSeo(post, "en");
    expect(seo.path).toBe("/blog/erp-guide");
    expect(seo.title).toBe("ERP for small business | KF Tech Solutions");
    expect(seo.kind).toBe("article");
  });

  it("falls back to the body, whitespace-collapsed, when there is no summary", () => {
    expect(articlePageSeo(post, "en").desc).toBe("First line. Second line.");
  });

  it("reads the article section from meta.tag before the legacy meta.category", () => {
    expect(articlePageSeo(post, "en").section).toBe("Guides");
    expect(articlePageSeo({ ...post, meta: { category: "Old" } }, "en").section).toBe("Old");
  });

  it("uses the id when an item has no slug", () => {
    expect(articlePageSeo({ ...post, slug: undefined }, "en").path).toBe("/blog/abc");
  });
});

describe("projects, services and legal pages", () => {
  it("adds the project's tag to its title", () => {
    const seo = projectPageSeo({ slug: "gentrack", title: { en: "GenTrack" }, meta: { tag: "ERP" } }, "en");
    expect(seo.path).toBe("/projects/gentrack");
    expect(seo.title).toBe("GenTrack — ERP | KF Tech Solutions");
  });

  it("describes a project as a CreativeWork with its technology as keywords", () => {
    const schema = projectSchema(
      "https://kf.test",
      { title: { en: "GenTrack" }, summary: { en: "An ERP." }, meta: { points: ["React", 3, "Node"], client: "Acme" } },
      "en",
      "https://kf.test/projects/gentrack",
    );
    expect(schema).toMatchObject({
      "@type": "CreativeWork",
      keywords: "React, Node",
      sourceOrganization: { name: "Acme" },
      creator: { "@id": "https://kf.test/#organization" },
    });
  });

  it("prefers a service page's own SEO title and exists only where its body is written", () => {
    const item = {
      slug: "web-development",
      title: { en: "Web Development" },
      body: { en: "Long body", ar: "نص" },
      meta: { seoTitle: { en: "Web development company in Cairo" }, headline: { en: "Websites that sell" } },
    };
    const seo = servicePageSeo(item, "en");
    expect(seo.path).toBe("/services/web-development");
    expect(seo.title).toBe("Web development company in Cairo");
    expect(seo.crumb).toBe("Websites that sell");
    expect(serviceLangs(item)).toEqual(["en", "ar"]);
  });

  it("keeps legal pages indexable", () => {
    const seo = legalPageSeo({ slug: "privacy", title: { en: "Privacy Policy" }, body: { en: "We collect little." } }, "en");
    expect(seo.path).toBe("/legal/privacy");
    expect(seo.noindex).toBeUndefined();
    expect(seo.desc).toBe("We collect little.");
  });
});
