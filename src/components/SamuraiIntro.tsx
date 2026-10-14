import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
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
 * - Three.js, GSAP and the scene live in their own chunk, fetched only when
 *   `shouldPlayIntro` says so — a returning visitor, a phone on 2G, a screen
 *   reader user with reduced motion, or a crawler never downloads a byte of
 *   it. When it will play, the inline boot script starts that download before
 *   the first paint, so the engine is usually cached by the time React asks.
 * - The page is covered from the first paint by the boot script
 *   (`<html data-intro="pending">` + CSS), so there is no flash of the site
 *   before the overlay mounts.
 * - Skip button (bottom corner) and Esc at any point; a 6 s load failsafe and
 *   an 8 s watchdog so a slow device never gets stuck on the show.
 * - The hero's own scene, the offer popup and the chat greeting wait for the
 *   reveal, so nothing else competes for the GPU or pops up underneath.
 */
type Phase = "idle" | "loading" | "playing" | "revealed" | "done";

const LOAD_FAILSAFE_MS = 6000;
const WATCHDOG_MS = 8000;
/**
 * Pacing. The original show ran seven seconds; here the approach (camera
 * push-in, blade raised) runs at 6× and the impact (wind-up, slash, split,
 * reveal) at 2.5×, so the page is showing about 1.3 s after the samurai
 * appears and the overlay is gone in under 2 s — quick, but the cut still reads.
 */
const APPROACH_SPEED = 6;
const IMPACT_SPEED = 2.5;

interface Control {
  finished: boolean;
  skipped: boolean;
  unmounted: boolean;
  /** The engine has been asked for; a second effect run must not ask again. */
  started: boolean;
  failsafe: number;
  watchdog: number;
  unlock: () => void;
}

const freshControl = (): Control => ({ finished: false, skipped: false, unmounted: false, started: false, failsafe: 0, watchdog: 0, unlock: () => {} });

export function SamuraiIntro() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<IntroHandle | null>(null);
  const ctl = useRef<Control>(freshControl());
  const [phase, setPhase] = useState<Phase>("idle");

  /** Ends the show, whichever way it ended: complete, skipped, failed, timed out. */
  const finish = useCallback(() => {
    const c = ctl.current;
    if (c.finished) return;
    c.finished = true;
    window.clearTimeout(c.failsafe);
    window.clearTimeout(c.watchdog);
    handleRef.current?.dispose();
    handleRef.current = null;
    markIntroSeen();
    c.unlock();
    setIntroState("revealed");
    setIntroState(null);
    if (!c.unmounted) {
      setPhase("done");
      trackClick(c.skipped ? "intro.skip" : "intro.complete");
    }
  }, []);

  const skip = useCallback(() => {
    ctl.current.skipped = true;
    // Mid-show the engine fades itself out and reports completion; before
    // that there is nothing to fade, so the page is uncovered at once.
    if (handleRef.current) handleRef.current.skip();
    else finish();
  }, [finish]);

  // Decided once per page load: the route is read at that moment.
  useEffect(() => {
    // A fresh control per run: React's development StrictMode runs this
    // effect, its cleanup, then the effect again, and the first run's
    // "finished" would otherwise leave the second stuck on the loader with
    // the page locked.
    const c = freshControl();
    ctl.current = c;
    // The boot script may already have covered the page; if the rules say no
    // (or this is a client-side navigation to the homepage), uncover it.
    if (!shouldPlayIntro(pathname) || !hasFastWebGL()) {
      if (introState()) setIntroState(null);
      return;
    }

    const body = document.body;
    const prevOverflow = body.style.overflow;
    body.style.overflow = "hidden";
    c.unlock = () => {
      body.style.overflow = prevOverflow;
    };
    c.failsafe = window.setTimeout(() => {
      if (!handleRef.current) finish();
    }, LOAD_FAILSAFE_MS);
    setPhase("loading");

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
      c.unmounted = true;
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHide);
      if (!c.finished) {
        c.finished = true;
        window.clearTimeout(c.failsafe);
        window.clearTimeout(c.watchdog);
        handleRef.current?.dispose();
        handleRef.current = null;
        c.unlock();
        if (introState()) setIntroState(null);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The attribute moves from "pending" to "loading" only once the overlay
  // itself is on screen, so the page is never uncovered for a frame between.
  useLayoutEffect(() => {
    if (phase === "loading") setIntroState("loading");
  }, [phase]);

  // The engine starts once the canvas exists — with the chunk preloaded the
  // import can resolve before the overlay has even rendered, so this waits
  // for the "loading" commit rather than racing it.
  useEffect(() => {
    if (phase !== "loading" || ctl.current.started) return;
    ctl.current.started = true;
    const canvas = canvasRef.current;
    if (!canvas) {
      finish();
      return;
    }
    import("../intro/engine/engine")
      .then(({ createSamuraiIntro }) => {
        if (ctl.current.finished) throw new Error("intro ended before the engine arrived");
        return createSamuraiIntro(canvas, {
          speed: APPROACH_SPEED,
          impactSpeed: IMPACT_SPEED,
          onReveal: () => {
            setIntroState("revealed");
            // Nothing left to skip once the page is showing: the button would
            // only sit over the chat launcher while the paper fades.
            if (!ctl.current.unmounted) setPhase("revealed");
          },
          onComplete: finish,
        });
      })
      .then((handle) => {
        if (ctl.current.finished) {
          handle.dispose();
          return;
        }
        window.clearTimeout(ctl.current.failsafe);
        handleRef.current = handle;
        setIntroState("playing");
        setPhase("playing");
        handle.play();
        ctl.current.watchdog = window.setTimeout(skip, WATCHDOG_MS);
      })
      .catch(() => finish());
  }, [phase, finish, skip]);

  if (phase === "idle" || phase === "done") return null;

  return (
    <div className={css.intro} role="presentation">
      <canvas ref={canvasRef} className={css.canvas} aria-hidden="true" />
      {phase === "loading" && (
        <div className={css.loader} role="status" aria-label={t("Loading…")}>
          <span className={css.bar} aria-hidden="true" />
        </div>
      )}
      {phase !== "revealed" && (
        <button type="button" className={css.skip} onClick={skip}>
          {t("Skip intro")}
          <kbd className={css.kbd} aria-hidden="true">Esc</kbd>
        </button>
      )}
    </div>
  );
}
