import { describe, expect, it } from "vitest";
import { imageSrcSet, imageUrl, ogImageUrl } from "./images";

const PHOTO = "https://images.unsplash.com/photo-1?w=4000&q=100&fm=jpg";

describe("imageUrl", () => {
  it("passes local files and unknown hosts through untouched", () => {
    expect(imageUrl("/founder.jpg")).toBe("/founder.jpg");
    expect(imageUrl("https://example.com/a.jpg", { width: 320 })).toBe("https://example.com/a.jpg");
    expect(imageUrl(undefined)).toBeUndefined();
  });

  it("replaces Unsplash's own sizing parameters with the requested ones", () => {
    const url = new URL(imageUrl(PHOTO, { width: 640 })!);
    expect(url.searchParams.get("w")).toBe("640");
    expect(url.searchParams.get("q")).toBe("72");
    expect(url.searchParams.get("fit")).toBe("crop");
    expect(url.searchParams.get("auto")).toBe("format");
    expect(url.searchParams.has("fm")).toBe(false);
  });

  it("maps fit: contain to Unsplash's clip", () => {
    expect(new URL(imageUrl(PHOTO, { fit: "contain" })!).searchParams.get("fit")).toBe("clip");
  });
});

describe("ogImageUrl", () => {
  it("crops Unsplash photos to a 1200x630 card and says the size may be claimed", () => {
    const { url, sized } = ogImageUrl(PHOTO);
    expect(sized).toBe(true);
    expect(new URL(url!).searchParams.get("h")).toBe("630");
  });

  it("never claims a size for an image it cannot resize", () => {
    expect(ogImageUrl("https://cdn.test/upload.png")).toEqual({ url: "https://cdn.test/upload.png", sized: false });
    expect(ogImageUrl(undefined)).toEqual({ url: undefined, sized: false });
  });
});

describe("imageSrcSet", () => {
  it("offers widths up to twice the layout width, no more", () => {
    const widths = imageSrcSet(PHOTO, { width: 420 })!.split(", ").map((c) => c.split(" ")[1]);
    expect(widths).toEqual(["320w", "480w", "640w", "768w"]);
  });

  it("has no srcset for images it cannot resize", () => {
    expect(imageSrcSet("/founder.jpg", { width: 420 })).toBeUndefined();
  });
});
