import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../../lib/i18n";
import h from "../Home.module.css";
import { SHOWREEL } from "./data";

/**
 * The hero's showreel: real client products playing like a screen recording.
 * A browser window and a phone change project together, the screen slowly
 * zooms while it is up, and a row of story-style bars shows where the reel is
 * — each bar jumps to its project, and the frame opens the case study.
 *
 * Built from screenshots rather than a video file: ~15 kB per desktop frame
 * instead of megabytes of video, sharp at any size, and the headline stays
 * the page's largest paint. Only the first frame loads with the page; the
 * rest arrive once it has loaded. The bar's own CSS animation is the clock
 * (its `animationend` moves the reel on), so hovering, focusing or scrolling
 * the hero out of view pauses everything at once, and a visitor who prefers
 * reduced motion gets a still reel they can step through.
 */
export function HomeShowreel() {
  const { t } = useI18n();
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [offscreen, setOffscreen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // The other frames wait until the page has loaded and settled: they must
  // not compete with the first paint (or a phone's first seconds) for
  // bandwidth. The first project stays up meanwhile, so nothing looks idle.
  useEffect(() => {
    let id = 0;
    const later = () => {
      id = window.setTimeout(() => setReady(true), 2500);
    };
    if (document.readyState === "complete") later();
    else window.addEventListener("load", later, { once: true });
    return () => {
      window.removeEventListener("load", later);
      window.clearTimeout(id);
    };
  }, []);

  // Nothing animates while the hero is scrolled away.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setOffscreen(!entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const item = SHOWREEL[active];
  const next = () => setActive((i) => (i + 1) % SHOWREEL.length);
  const running = ready && !paused && !offscreen;

  return (
    <div
      ref={rootRef}
      className={h.reel}
      data-running={running || undefined}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className={h.reelGlow} aria-hidden="true" />

      <Link to={`/projects/${item.slug}`} className={h.reelBrowser} data-track="hero.reel" aria-label={`${t("View project")}: ${t(item.title)}`}>
        <span className={h.reelBar} aria-hidden="true">
          <i />
          <i />
          <i />
          <span className={h.reelUrl} dir="ltr">kftechsolutions.dev/projects/{item.slug}</span>
          <span className={h.reelLive}>
            <span className="kf-dot" />
            {t("Live in production")}
          </span>
        </span>
        <span className={h.reelScreen}>
          {SHOWREEL.map((s, i) =>
            i === 0 || ready ? (
              <img
                key={s.slug}
                className={`${h.reelShot} ${i === active ? h.reelShotOn : ""}`}
                src={`/hero/${s.desktop}-1040.webp`}
                srcSet={`/hero/${s.desktop}-640.webp 640w, /hero/${s.desktop}-1040.webp 1040w`}
                sizes="(max-width: 960px) 92vw, 600px"
                width={1040}
                height={532}
                alt=""
                decoding="async"
                // Low even for the first frame: the headline is the page's main
                // paint, and a high-priority image would queue ahead of it.
                fetchPriority="low"
              />
            ) : null,
          )}
        </span>
      </Link>

      <span className={`${h.reelPhone} ${item.mobile ? "" : h.reelPhoneAway}`} aria-hidden="true">
        <span className={h.reelPhoneScreen}>
          {SHOWREEL.map((s, i) =>
            s.mobile && (i === 0 || ready) ? (
              <img
                key={s.slug}
                className={`${h.reelShot} ${i === active ? h.reelShotOn : ""}`}
                src={`/hero/${s.mobile}-360.webp`}
                width={360}
                height={680}
                alt=""
                decoding="async"
                loading={i === 0 ? undefined : "lazy"}
                fetchPriority="low"
              />
            ) : null,
          )}
        </span>
      </span>

      <div className={h.reelFoot}>
        <Link to={`/projects/${item.slug}`} className={h.reelCaption} data-track="hero.reel.caption">
          <span className={h.reelTag}>{t(item.tag)}</span>
          <span className={h.reelTitle}>{t(item.title)}</span>
          <span className="kf-arrow" aria-hidden="true">&rarr;</span>
        </Link>
        <div className={h.reelBars} role="tablist" aria-label={t("Selected work")}>
          {SHOWREEL.map((s, i) => (
            <button
              key={s.slug}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={t(s.title)}
              className={`${h.reelBarBtn} ${i < active ? h.reelBarDone : ""}`}
              onClick={() => setActive(i)}
            >
              {/* Re-keyed on every change so the fill restarts from zero. */}
              <span key={`${active}-${i}`} className={i === active ? h.reelFill : undefined} onAnimationEnd={i === active ? next : undefined} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
