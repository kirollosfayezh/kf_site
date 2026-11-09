import { describe, expect, it } from "vitest";
import { guidesFor } from "./service-guides";

const card = (slug: string, tag: string, tags: string[], createdAt = "2026-11-01", langs?: string[]) => ({
  slug,
  createdAt,
  meta: { tag, tags, ...(langs ? { langs } : {}) },
});

describe("guidesFor", () => {
  const cards = [
    card("pos-guide", "POS System", ["POS", "restaurants"], "2026-10-01"),
    card("erp-mention", "Web Development", ["ERP"], "2026-11-05"),
    card("iot-fleet", "Business Systems", ["fleet management", "GPS tracking", "IoT"]),
    card("app-cost", "Mobile", ["app development cost"]),
    card("ar-only", "Mobile", ["MVP"], "2026-11-08", ["ar"]),
  ];

  it("ranks an article in the service's category above one that only mentions it", () => {
    expect(guidesFor(cards, "business-systems", "en").map((c) => c.slug)).toEqual(["pos-guide", "iot-fleet", "erp-mention"]);
  });

  it("matches on keywords alone when the service has no category", () => {
    expect(guidesFor(cards, "iot-solutions", "en").map((c) => c.slug)).toEqual(["iot-fleet"]);
  });

  it("only lists posts published in the page's language", () => {
    expect(guidesFor(cards, "mobile-applications", "en").map((c) => c.slug)).toEqual(["app-cost"]);
    expect(guidesFor(cards, "mobile-applications", "ar").map((c) => c.slug)).toEqual(["ar-only", "app-cost"]);
  });

  it("returns nothing for a service without matches", () => {
    expect(guidesFor(cards, "api-and-backend", "en")).toEqual([]);
  });
});
