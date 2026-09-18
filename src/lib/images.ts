/**
 * Every photo on the site goes through here.
 *
 * With `VITE_IMAGE_CDN` set to an image-resizing proxy's origin, images are
 * requested from our own edge: right-sized,
 * AVIF/WebP-negotiated and cached for a year. With it unset — local dev, or
 * before the domain is live — the original URL is used, with Unsplash's own
 * transform appended so nothing ever falls all the way back to a 4 MB JPEG.
 *
 * Nothing in the app should build an image URL any other way: a bare `src` on
 * an <img> is how the 4 MB originals got shipped in the first place.
 */

const CDN = (import.meta.env.VITE_IMAGE_CDN ?? "").replace(/\/+$/, "");

/** Hosts the resizing proxy is allowed to fetch; must match its own allowlist. */
const PROXYABLE = /^https:\/\/(images|plus)\.unsplash\.com\//;

/**
 * The widths the Worker will serve. Asking for anything else just gets rounded
 * up there, so generating srcsets from this list keeps every request a cache
 * hit rather than a fresh transform.
 */
export const IMAGE_WIDTHS = [320, 480, 640, 768, 960, 1200, 1600, 2000] as const;

export interface ImageOptions {
  width?: number;
  quality?: number;
  fit?: "cover" | "contain";
}

/** True for URLs the CDN is allowed to touch — everything else passes through. */
function proxyable(src: string): boolean {
  return PROXYABLE.test(src);
}

/** Unsplash is imgix-backed, so it can size itself when the CDN is not in play. */
function unsplashDirect(src: string, width: number, quality: number, fit: string): string {
  const url = new URL(src);
  for (const key of ["w", "h", "q", "fm", "auto", "fit", "dpr"]) url.searchParams.delete(key);
  url.searchParams.set("w", String(width));
  url.searchParams.set("q", String(quality));
  url.searchParams.set("auto", "format");
  url.searchParams.set("fit", fit === "contain" ? "clip" : "crop");
  return url.toString();
}

/**
 * The URL for one photo at one width. Local files (`/founder.jpg`) and any
 * host the Worker does not allow are returned untouched.
 */
export function imageUrl(src: string | undefined, opts: ImageOptions = {}): string | undefined {
  if (!src) return src;
  const width = opts.width ?? 1200;
  const quality = opts.quality ?? 72;
  const fit = opts.fit ?? "cover";

  if (!proxyable(src)) return src;

  if (CDN) {
    const q = new URLSearchParams({ src, w: String(width), q: String(quality), fit });
    return `${CDN}/img?${q.toString()}`;
  }
  return unsplashDirect(src, width, quality, fit);
}

/**
 * A `srcset` covering the widths at or below twice the layout width — enough
 * for a 2x screen, and no more, so a phone never downloads a desktop photo.
 */
export function imageSrcSet(src: string | undefined, opts: ImageOptions = {}): string | undefined {
  if (!src || !proxyable(src)) return undefined;
  const target = (opts.width ?? 1200) * 2;
  const widths = IMAGE_WIDTHS.filter((w) => w <= target);
  if (widths.length === 0) return undefined;
  return widths.map((w) => `${imageUrl(src, { ...opts, width: w })} ${w}w`).join(", ");
}
