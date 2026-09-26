import type { ImgHTMLAttributes, Ref } from "react";
import { imageSrcSet, imageUrl } from "../lib/images";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet" | "loading"> & {
  src: string | undefined;
  alt: string;
  /** The widest this image is ever laid out, in CSS pixels. Drives the srcset. */
  width?: number;
  /** The `sizes` attribute. Without it the browser assumes 100vw and over-fetches. */
  sizes?: string;
  /** JPEG/AVIF quality, 30–95. */
  quality?: number;
  fit?: "cover" | "contain";
  /**
   * Set on the one image that is the page's LCP candidate: it loads eagerly at
   * high priority. Everything else stays lazy, which is the default.
   */
  priority?: boolean;
  /**
   * Load now, at normal priority. For a photo that is about to be shown but is
   * off screen right now (the next slide of a gallery): lazy loading would
   * wait until it slides in and reveal it half-drawn.
   */
  eager?: boolean;
  ref?: Ref<HTMLImageElement>;
};

/**
 * Every photo on the site renders through this.
 *
 * It routes the URL through the Cloudflare image CDN (`lib/images.ts`), emits a
 * `srcset` so a phone fetches a phone-sized file instead of a desktop one, and
 * defaults to lazy + async decoding so images below the fold never compete with
 * the hero for bandwidth or block the main thread while they decode.
 *
 * The media containers in `sections.module.css` already carry `aspect-ratio`,
 * so the slot is reserved before the file arrives and nothing shifts.
 */
export function Img({ src, alt, width = 1200, sizes, quality, fit, priority = false, eager = false, ...rest }: Props) {
  const opts = { width, quality, fit };
  return (
    <img
      src={imageUrl(src, opts)}
      srcSet={imageSrcSet(src, opts)}
      sizes={sizes ?? `(max-width: 700px) 100vw, ${width}px`}
      alt={alt}
      loading={priority || eager ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      fetchPriority={priority ? "high" : "low"}
      {...rest}
    />
  );
}
