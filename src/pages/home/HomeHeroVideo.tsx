import { useEffect, useRef } from "react";
import h from "../Home.module.css";

/**
 * The hero's motion piece: an 8 s seamless loop of a dashboard and a phone
 * app building and updating themselves, in the brand's video palette. It is
 * rendered offline (KF/social/video/hero-loop/, `node render.mjs`) and has no
 * words, so the same file serves every language.
 *
 * The page ships only a still of the first frame (a 10–17 kB WebP). The
 * video itself is attached once the page has loaded — VP9 where the browser
 * plays it, H.264 otherwise, the 800px cut on small screens — so it never
 * competes with the first paint. It pauses whenever the hero is off screen,
 * and is never loaded for a visitor who prefers reduced motion or has Data
 * Saver on: they see the still frame.
 */
export function HomeHeroVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || conn?.saveData) return;

    let visible = true;
    let attached = false;
    const play = () => {
      if (attached && visible) void video.play().catch(() => {});
    };
    const attach = () => {
      const small = window.innerWidth < 720;
      const vp9 = video.canPlayType('video/webm; codecs="vp9"') !== "";
      video.src = `/hero/hero-loop${small ? "-800" : ""}.${vp9 ? "webm" : "mp4"}`;
      attached = true;
      play();
    };

    let id = 0;
    const later = () => {
      id = window.setTimeout(attach, 1200);
    };
    if (document.readyState === "complete") later();
    else window.addEventListener("load", later, { once: true });

    const io =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible) play();
            else video.pause();
          });
    io?.observe(video);

    return () => {
      window.removeEventListener("load", later);
      window.clearTimeout(id);
      io?.disconnect();
    };
  }, []);

  return (
    <div className={h.heroVideo} aria-hidden="true">
      <div className={h.heroVideoGlow} />
      <div className={h.heroVideoFrame}>
        {/* The still is a real <img> in the prerendered page, not the video's
            poster: it is the hero's largest paint, so it must be found by the
            preload scanner and fetched first (10–17 kB). The video fades in
            over it once it is actually playing. */}
        <img
          className={h.heroVideoEl}
          src="/hero/hero-loop-poster-1280.webp"
          srcSet="/hero/hero-loop-poster-800.webp 800w, /hero/hero-loop-poster-1280.webp 1280w"
          sizes="(max-width: 960px) 92vw, 620px"
          width={1280}
          height={800}
          alt=""
          fetchPriority="high"
          decoding="async"
        />
        <video
          ref={ref}
          className={`${h.heroVideoEl} ${h.heroVideoPlay}`}
          onPlaying={(e) => e.currentTarget.setAttribute("data-on", "")}
          width={1280}
          height={800}
          muted
          loop
          playsInline
          preload="none"
          disablePictureInPicture
          tabIndex={-1}
        />
      </div>
    </div>
  );
}
