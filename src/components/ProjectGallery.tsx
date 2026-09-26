import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Img } from "./Img";
import { useI18n } from "../lib/i18n";
import css from "./ProjectGallery.module.css";

export type Device = "photo" | "desktop" | "mobile";

/**
 * How a photo is shown, from its URL's fragment: `…/shot.webp#desktop` is a
 * desktop screenshot (drawn in a browser window), `#mobile` a phone screenshot
 * (drawn in a phone), anything else a plain photo filling the box. The flag
 * lives on the URL so it travels with the photo through reordering, the media
 * library and the API without a schema change; browsers never send fragments,
 * so the file requested is the same.
 */
export function parseMedia(url: string): { src: string; device: Device } {
  const m = /#(desktop|mobile)$/.exec(url);
  return m ? { src: url.slice(0, m.index), device: m[1] as Device } : { src: url.replace(/#.*$/, ""), device: "photo" };
}

/** Photos only: the media library also holds MP4s and PDFs, which a slide cannot show. */
export function galleryImages(media: string[] | undefined): string[] {
  return (media ?? []).filter((m) => m && !/\.(mp4|webm|pdf)(\?|#|$)/i.test(parseMedia(m).src));
}

type Props = {
  images: string[];
  alt: string;
  /** Widest the gallery is ever laid out, in CSS px (drives each photo's srcset). */
  width: number;
  sizes: string;
  /** First photo is the page's LCP candidate: load it eagerly. */
  priority?: boolean;
  /** Milliseconds each photo stays up. */
  interval?: number;
  /**
   * Extra wait before the first advance. A grid of cards passes a different
   * value per card so they don't all flip on the same beat.
   */
  offset?: number;
};

/**
 * A project's photos, swiping to the next one every two seconds.
 *
 * Built to be invisible when it has nothing to do and cheap when it does:
 * - One photo: renders exactly what a plain <Img> would, no timer, no dots.
 * - Only the current photo and the next one are ever in the DOM as images;
 *   the next is mounted (and so downloaded) while the current one is showing,
 *   so a swipe never reveals a half-loaded picture and a visitor who never
 *   sees the fifth photo never downloads it.
 * - It only runs while it is on screen, the tab is visible and nobody is
 *   hovering or focusing it; `prefers-reduced-motion` turns the automatic
 *   advance off (the dots still work).
 * - The loop is seamless: a copy of the first photo sits after the last, the
 *   track slides onto it and then jumps back without a transition.
 * - Touch: a horizontal swipe moves it by hand; vertical scrolling is left
 *   alone (touch-action: pan-y).
 * - The first render is the same on the server and the client (photo one,
 *   index 0), so the prerendered page hydrates cleanly.
 */
export function ProjectGallery({ images, alt, width, sizes, priority = false, interval = 2000, offset = 0 }: Props) {
  const { t } = useI18n();
  const count = images.length;
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // `index` may equal `count`: the copy of photo one at the end of the track.
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);
  // How many photos (from the start) are mounted as images.
  const [mounted, setMounted] = useState(1);
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);

  const current = index % Math.max(count, 1);

  useEffect(() => {
    if (count < 2) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    const onVis = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      mq.removeEventListener("change", onChange);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [count]);

  useEffect(() => {
    const el = rootRef.current;
    if (count < 2 || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, [count]);

  // Keep the next photo mounted ahead of time, once the gallery has been seen.
  useEffect(() => {
    if (count < 2 || !inView) return;
    // `current + 2` photos: the one showing and the next. At the last photo
    // that reaches `count`, which also mounts the copy the loop slides onto.
    setMounted((m) => Math.max(m, Math.min(count, current + 2)));
  }, [count, inView, current]);

  const go = useCallback(
    (next: number) => {
      if (count < 2) return;
      setAnimate(true);
      setIndex(next);
    },
    [count],
  );

  const running = count > 1 && inView && visible && !paused && !reduced;
  useEffect(() => {
    if (!running) return;
    // The first advance after (re)starting waits the offset too, so a grid
    // that scrolls into view together still flips in a ripple, not in unison.
    let timer = window.setTimeout(function tick() {
      setAnimate(true);
      setIndex((i) => (i >= count ? 1 : i + 1));
      timer = window.setTimeout(tick, interval);
    }, interval + offset);
    return () => window.clearTimeout(timer);
  }, [running, count, interval, offset]);

  // Landed on the copy of photo one: jump back to the real one, unanimated.
  const onTransitionEnd = () => {
    if (index === count) {
      setAnimate(false);
      setIndex(0);
    }
  };
  // Re-arm the transition on the frame after the silent jump.
  useEffect(() => {
    if (animate) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setAnimate(true)));
    return () => cancelAnimationFrame(id);
  }, [animate]);

  // Touch: a deliberate horizontal swipe moves by hand.
  const touch = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const p = e.touches[0];
    touch.current = { x: p.clientX, y: p.clientY };
    setPaused(true);
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touch.current;
    touch.current = null;
    setPaused(false);
    if (!start) return;
    const p = e.changedTouches[0];
    const dx = p.clientX - start.x;
    const dy = p.clientY - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const rtl = document.documentElement.dir === "rtl";
    const forward = rtl ? dx > 0 : dx < 0;
    if (forward) go(index >= count ? 1 : index + 1);
    else go(current === 0 ? count - 1 : current - 1);
  };

  if (count === 0) return null;
  if (count === 1) {
    return <GallerySlide url={images[0]} alt={alt} width={width} sizes={sizes} priority={priority} />;
  }

  const slides = [...images, images[0]];
  return (
    <div
      ref={rootRef}
      className={css.gallery}
      role="group"
      aria-roledescription="carousel"
      aria-label={alt}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => setPaused(false)}
    >
      <div
        ref={trackRef}
        className={css.track}
        style={{ ["--i" as string]: index, transition: animate ? undefined : "none" }}
        onTransitionEnd={onTransitionEnd}
      >
        {slides.map((src, i) => {
          const real = i % count;
          // The loop's copy of photo one only once the last photo is up next.
          const show = i < count ? i < mounted : mounted >= count;
          return (
            <div key={i} className={css.slide} aria-hidden={real !== current || i === count}>
              {show ? (
                <GallerySlide
                  url={src}
                  alt={i === count ? "" : `${alt} (${real + 1}/${count})`}
                  width={width}
                  sizes={sizes}
                  priority={priority && i === 0}
                  // The upcoming photo is wanted now, not when it slides in.
                  eager={i > 0}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className={css.dots}>
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            className={css.dot}
            aria-current={i === current ? "true" : undefined}
            aria-label={t("Show photo {n} of {total}").replace("{n}", String(i + 1)).replace("{total}", String(count))}
            onClick={() => go(i)}
          >
            <span />
          </button>
        ))}
      </div>
    </div>
  );
}

const DEFAULT_RATIO: Record<Device, number> = { photo: 16 / 10, desktop: 16 / 10, mobile: 9 / 19.5 };
// A screenshot's own shape, within reason: very long full-page captures show
// their top and are trimmed at the bottom rather than shrinking to a sliver.
const RATIO_RANGE: Record<Device, [number, number]> = { photo: [0, 99], desktop: [1.2, 2.4], mobile: [0.42, 0.75] };

/**
 * One photo. A screenshot sits in a device frame sized to the screenshot's
 * own proportions (read once it has loaded), so the whole capture is visible
 * instead of being cropped at the box's edges; a plain photo fills the box as
 * before. Frames are pure CSS: no extra images, no extra requests.
 */
export function GallerySlide({
  url,
  alt,
  width,
  sizes,
  priority = false,
  eager = false,
}: {
  url: string;
  alt: string;
  width: number;
  sizes: string;
  priority?: boolean;
  eager?: boolean;
}) {
  const { src, device } = parseMedia(url);
  const imgRef = useRef<HTMLImageElement>(null);
  const [ratio, setRatio] = useState(DEFAULT_RATIO[device]);
  const measure = useCallback(() => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth || device === "photo") return;
    const [lo, hi] = RATIO_RANGE[device];
    setRatio(Math.min(hi, Math.max(lo, img.naturalWidth / img.naturalHeight)));
  }, [device]);
  // A prerendered image can finish loading before hydration attaches onLoad.
  useLayoutEffect(() => {
    if (imgRef.current?.complete) measure();
  }, [measure]);

  const img = (
    <Img ref={imgRef} src={src} alt={alt} width={width} sizes={sizes} priority={priority} eager={eager} onLoad={measure} />
  );
  if (device === "photo") return img;
  return (
    <div className={css.stage}>
      <div className={css.frame} data-device={device} style={{ ["--r" as string]: ratio }}>
        {device === "desktop" ? (
          <div className={css.bar} aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        ) : (
          <span className={css.notch} aria-hidden="true" />
        )}
        <div className={css.screen}>{img}</div>
      </div>
    </div>
  );
}
