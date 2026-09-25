import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useI18n } from "../lib/i18n";
import { trackClick } from "../services/analytics";
import type { IntroHandle } from "../intro/engine/engine";
import { hasFastWebGL, introState, markIntroSeen, setIntroState, shouldPlayIntro } from "../lib/intro";
import css from "./SamuraiIntro.module.css";

/**
 * The opening: a samurai cuts through the screen and the site is revealed.
 *
 * Built to cost nothing when it does not play, and as little as possible when
 * it does:
 * - Three.js, GSAP and the scene live in their own chunk, fetched only after
 *   the page has painted and hydrated, and only when `shouldPlayIntro` says
 *   so — a returning visitor, a phone on 2G, a screen reader user with
 *   reduced motion, or a crawler never downloads a byte of it.
 * - The page is covered from the first paint by the inline boot script
 *   (`<html data-intro="pending">` + CSS), so there is no flash of the site
 *   before the overlay mounts.
 * - Skip button (bottom corner) and Esc at any point; a 6 s load failsafe and
 *   a 14 s watchdog so a slow device never gets stuck on the show.
 * - The hero's own scene, the offer popup and the chat greeting wait for the
 *   reveal, so nothing else competes for the GPU or pops up underneath.
 */
type Phase = "idle" | "loading" | "playing" | "revealed" | "done";

const LOAD_FAILSAFE_MS = 6000;
const WATCHDOG_MS = 14000;

export function SamuraiIntro() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<IntroHandle | null>(null);
  const skipRef = useRef<() => void>(() => {});
  const [phase, setPhase] = useState<Phase>("idle");

  useEffect(() => {
    // The boot script may already have covered the page; if the rules say no
    // (or this is a client-side navigation to the homepage), uncover it.
    if (!shouldPlayIntro(pathname) || !hasFastWebGL()) {
      if (introState()) setIntroState(null);
      return;
    }

    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    const unlock = () => {
      body.style.overflow = prevOverflow;
    };

    let cancelled = false;
    let finished = false;
    let skipped = false;
    let failsafe = 0;
    let watchdog = 0;

    const finish = () => {
      if (finished) return;
      finished = true;
      window.clearTimeout(failsafe);
      window.clearTimeout(watchdog);
      handleRef.current?.dispose();
      handleRef.current = null;
      markIntroSeen();
      unlock();
      setIntroState("revealed");
      setIntroState(null);
      setPhase("done");
      if (!cancelled) trackClick(skipped ? "intro.skip" : "intro.complete");
    };

    const skip = () => {
      skipped = true;
      if (handleRef.current) handleRef.current.skip();
      else finish();
    };
    skipRef.current = skip;

    // The attribute moves from "pending" to "loading" only once the overlay
    // itself is on screen (see the layout effect below), so the page is never
    // uncovered for a frame in between.
    setPhase("loading");
    failsafe = window.setTimeout(() => {
      if (!handleRef.current) finish();
    }, LOAD_FAILSAFE_MS);

    import("../intro/engine/engine")
      .then(({ createSamuraiIntro }) => {
        if (cancelled || !canvasRef.current) throw new Error("intro cancelled");
        return createSamuraiIntro(canvasRef.current, {
          onReveal: () => {
            setIntroState("revealed");
            // Nothing left to skip once the page is showing: the button would
            // only sit over the chat launcher while the paper fades.
            setPhase("revealed");
          },
          onComplete: finish,
        });
      })
      .then((handle) => {
        if (cancelled || finished) {
          handle.dispose();
          return;
        }
        window.clearTimeout(failsafe);
        handleRef.current = handle;
        setIntroState("playing");
        setPhase("playing");
        handle.play();
        watchdog = window.setTimeout(skip, WATCHDOG_MS);
      })
      .catch(() => finish());

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
    };
    window.addEventListener("keydown", onKey);
    // A tab going to the background mid-show: do not make them sit through it on return.
    const onHide = () => {
      if (document.visibilityState === "hidden") skip();
    };
    document.addEventListener("visibilitychange", onHide);

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHide);
      if (!finished) {
        finished = true;
        window.clearTimeout(failsafe);
        window.clearTimeout(watchdog);
        handleRef.current?.dispose();
        handleRef.current = null;
        unlock();
        if (introState()) setIntroState(null);
      }
    };
    // Decided once per page load; the route is read at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (phase === "loading") setIntroState("loading");
  }, [phase]);

  if (phase === "idle" || phase === "done") return null;

  return (
    <div className={css.intro} role="presentation">
      <canvas ref={canvasRef} className={css.canvas} aria-hidden="true" />
      {phase === "loading" && (
        <div className={css.loader} role="status" aria-label={t("Loading…")}>
          <span className={css.glyph} aria-hidden="true">斬</span>
          <span className={css.bar} aria-hidden="true" />
        </div>
      )}
      {phase !== "revealed" && (
        <button type="button" className={css.skip} onClick={() => skipRef.current()}>
          {t("Skip intro")}
          <kbd className={css.kbd} aria-hidden="true">Esc</kbd>
        </button>
      )}
    </div>
  );
}
