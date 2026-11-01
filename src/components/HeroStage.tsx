import { useEffect, useRef } from "react";
import { afterIntroDone } from "../lib/intro";
import { startScene } from "./hero/renderer.ts";
import { DUST_FS, DUST_VS, TERRAIN_FS, TERRAIN_VS } from "./hero/shaders.ts";
import { program, whenLinked } from "./hero/webgl.ts";

/**
 * The animated hero from the original static export (`_stage()` in
 * `KF Tech Solutions.dc.html`): a wireframe terrain flown over slowly, with
 * drifting dust for depth.
 *
 * This used to be a three.js port that ran the animation on the CPU: every
 * frame it rewrote all 9,360 terrain vertices (three trig calls each) and all
 * 900 dust positions in JavaScript, then re-uploaded ~115 kB of vertex data to
 * the GPU. That is what made the hero stutter — the main thread was doing
 * ~30,000 Math calls and a full buffer upload inside every single frame, in
 * competition with Lenis' scroll interpolation and React.
 *
 * It is now hand-written WebGL with the *same* numbers — grid size, ripple
 * maths, fog, camera, dust drift and colours are unchanged — but the ripple
 * and the dust drift happen in the vertex shader from a single `uTime`
 * uniform. Per frame the CPU now uploads one float and two matrices, and
 * touches no vertex data at all. It also drops the 736 kB three.js chunk
 * (187 kB gzipped) that existed only to draw this one scene.
 *
 * Two incidental fixes come with the move: the dust now drifts at a fixed
 * speed per second rather than per frame (on a 120 Hz display the old version
 * ran at double speed), and the renderer no longer allocates at 1.8x device
 * pixel ratio on phones.
 *
 * When WebGL is unavailable or `prefers-reduced-motion` is set, nothing boots
 * and the CSS gradient painted by the parent stays visible.
 */

export function HeroStage({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let cleanup: (() => void) | null = null;
    let disposed = false;

    function boot() {
      if (disposed || !el) return;

      const canvas = document.createElement("canvas");
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";

      // Device pixel ratio is the single biggest cost lever here: every extra
      // 0.1 is more fragments for the same picture. 1.5 is indistinguishable
      // from 2 for thin additive lines, and phones get less again.
      const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
      const dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.25 : 1.5);

      const gl = (canvas.getContext("webgl", {
        alpha: true,
        // MSAA is only worth its bandwidth when we are not already
        // supersampling via the pixel ratio.
        antialias: dpr <= 1.25,
        // Nothing in this scene depth-tests (both materials are additive with
        // depth writes off), so a depth buffer would be allocated and cleared
        // for nothing.
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        powerPreference: "high-performance",
        /*
         * No context at all when WebGL would be software-rendered
         * (SwiftShader, llvmpipe): a fragment shader run on the CPU every
         * frame is exactly the visitor who should get the static gradient
         * instead. It also spares lab tools — headless Chrome, PageSpeed —
         * a ~1 s shader compile they counted as blocking time.
         */
        failIfMajorPerformanceCaveat: true,
      }) ?? null) as WebGLRenderingContext | null;

      if (!gl) return; // No (fast) WebGL — the CSS gradient behind us is the fallback.

      const parallel = gl.getExtension("KHR_parallel_shader_compile") !== null;
      const terrainProg = program(gl, TERRAIN_VS, TERRAIN_FS, !parallel);
      const dustProg = program(gl, DUST_VS, DUST_FS, !parallel);
      if (!terrainProg || !dustProg) {
        gl.getExtension("WEBGL_lose_context")?.loseContext();
        return;
      }

      // Everything from here on needs the linked programs, so it runs from
      // `whenLinked` below — right away without the extension, a few frames
      // later with it.
      const start = () => {
        cleanup = startScene({ el, canvas, gl, terrainProg, dustProg, dpr });
        if (disposed) cleanup();
      };

      // While the programs link in the background, disposal only has these
      // to release; `start` replaces this once the scene exists.
      let cancelLink = () => {};
      cleanup = () => {
        cancelLink();
        gl.deleteProgram(terrainProg);
        gl.deleteProgram(dustProg);
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      };
      cancelLink = whenLinked(gl, [terrainProg, dustProg], (ok) => {
        if (disposed) return;
        if (!ok) {
          cleanup?.();
          cleanup = null;
          return;
        }
        start();
      });
    }

    /*
     * Creating the context and compiling the shaders is one long main-thread
     * task — around a second on a throttled phone. The page arrives
     * prerendered now, so that task used to land right on top of hydration
     * and the hero text's first paint; it waits for an idle moment instead
     * (with a ceiling, so it never waits forever on a busy page).
     */
    let idleHandle: number | null = null;
    let frameHandle = 0;
    let cancelIntroWait = () => {};
    const whenIdle = (run: () => void) => {
      // While the opening animation is up its scene owns the GPU, and the
      // shader compile here is a long main-thread task that would freeze its
      // last frames; this scene starts once the overlay is gone.
      const fn = () => {
        cancelIntroWait = afterIntroDone(run);
      };
      const w = window as Window & {
        requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
        cancelIdleCallback?: (h: number) => void;
      };
      // Two frames first: the second callback runs only after the first
      // frame has painted, so the page is on screen before any of this work.
      frameHandle = requestAnimationFrame(() => {
        frameHandle = requestAnimationFrame(() => {
          idleHandle = w.requestIdleCallback ? w.requestIdleCallback(fn, { timeout: 2500 }) : window.setTimeout(fn, 400);
        });
      });
    };
    const cancelIdle = () => {
      cancelAnimationFrame(frameHandle);
      cancelIntroWait();
      if (idleHandle === null) return;
      const w = window as Window & { cancelIdleCallback?: (h: number) => void };
      if (w.cancelIdleCallback) w.cancelIdleCallback(idleHandle);
      else window.clearTimeout(idleHandle);
      idleHandle = null;
    };

    // Only boot once the hero is actually near the viewport; on an inner page
    // the scene is never created at all.
    let nearIo: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      nearIo = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            nearIo?.disconnect();
            nearIo = null;
            whenIdle(boot);
          }
        },
        { rootMargin: "200px" },
      );
      nearIo.observe(el);
    } else {
      whenIdle(boot);
    }

    return () => {
      disposed = true;
      cancelIdle();
      nearIo?.disconnect();
      cleanup?.();
    };
  }, []);

  return <div ref={ref} className={className} aria-hidden="true" />;
}
