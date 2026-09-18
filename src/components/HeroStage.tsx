import { useEffect, useRef } from "react";

/**
 * The animated hero from the original static export (`_stage()` in
 * `KF Tech Solutions.dc.html`): a wireframe terrain flown over slowly, with
 * drifting dust for depth. Ported 1:1 — the grid size, fog, camera, ripple
 * maths, dust recycling and resize handling are the original numbers.
 *
 * three.js is pulled in with a dynamic `import()` so it lands in its own chunk
 * and is only fetched on Home, only when the hero is actually near the
 * viewport, and never under `prefers-reduced-motion`. When the scene can't or
 * shouldn't run, the CSS gradient painted by the parent stays visible.
 */
export function HeroStage({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let disposed = false;
    // Everything the async boot may create, so teardown works no matter how
    // far the boot got before the component unmounted.
    let cleanup: (() => void) | null = null;

    async function boot() {
      const THREE = await import("three");
      if (disposed || !el) return;

      let w = el.clientWidth || window.innerWidth;
      let h = el.clientHeight || window.innerHeight;

      const scene = new THREE.Scene();
      scene.fog = new THREE.FogExp2(0x07070a, 0.013);
      const camera = new THREE.PerspectiveCamera(62, w / h, 0.1, 220);

      let renderer: InstanceType<typeof THREE.WebGLRenderer>;
      try {
        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      } catch {
        return; // No WebGL — the CSS gradient behind us is the fallback.
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
      renderer.setSize(w, h);
      el.appendChild(renderer.domElement);
      // The CSS gradient is only the stand-in for this scene — drop it now that
      // the real one is painting, so additive blending sits on the same black
      // the original does.
      el.style.background = "none";

      const orange = new THREE.Color("#FF6A00");
      const pink = new THREE.Color("#FF0080");

      const COLS = 78;
      const ROWS = 120;
      const SX = 1.5;
      const SZ = 1.5;
      const verts: number[] = [];
      const colors: number[] = [];
      const idx: number[] = [];
      for (let z = 0; z < ROWS; z++) {
        for (let x = 0; x < COLS; x++) {
          verts.push((x - (COLS - 1) / 2) * SX, 0, -z * SZ);
          const c = orange.clone().lerp(pink, x / (COLS - 1));
          colors.push(c.r, c.g, c.b);
        }
      }
      for (let z = 0; z < ROWS; z++) {
        for (let x = 0; x < COLS; x++) {
          const i = z * COLS + x;
          if (x < COLS - 1) idx.push(i, i + 1);
          if (z < ROWS - 1) idx.push(i, i + COLS);
        }
      }
      const geo = new THREE.BufferGeometry();
      const posAttr = new THREE.BufferAttribute(new Float32Array(verts), 3);
      geo.setAttribute("position", posAttr);
      geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(colors), 3));
      geo.setIndex(idx);
      const lineMat = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 1,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.LineSegments(geo, lineMat);
      mesh.position.y = -2.6;
      scene.add(mesh);

      // Dust drifting through the shot, for depth.
      const N = 900;
      const dp = new Float32Array(N * 3);
      const dc = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        dp[i * 3] = (Math.random() - 0.5) * 110;
        dp[i * 3 + 1] = (Math.random() - 0.5) * 44;
        dp[i * 3 + 2] = -Math.random() * 170;
        const c = orange.clone().lerp(pink, Math.random());
        dc[i * 3] = c.r;
        dc[i * 3 + 1] = c.g;
        dc[i * 3 + 2] = c.b;
      }
      const cv = document.createElement("canvas");
      cv.width = 32;
      cv.height = 32;
      const cx = cv.getContext("2d")!;
      const g = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      cx.fillStyle = g;
      cx.fillRect(0, 0, 32, 32);
      const dustGeo = new THREE.BufferGeometry();
      const dustAttr = new THREE.BufferAttribute(dp, 3);
      dustGeo.setAttribute("position", dustAttr);
      dustGeo.setAttribute("color", new THREE.BufferAttribute(dc, 3));
      const dustTex = new THREE.CanvasTexture(cv);
      const dustMat = new THREE.PointsMaterial({
        size: 0.42,
        map: dustTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      });
      const dust = new THREE.Points(dustGeo, dustMat);
      scene.add(dust);

      const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
      const onMove = (e: PointerEvent) => {
        mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener("pointermove", onMove, { passive: true });

      // Pause when the hero scrolls away or the tab is hidden — no wasted GPU.
      let visible = true;
      let io: IntersectionObserver | null = null;
      if ("IntersectionObserver" in window) {
        io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; }, { threshold: 0 });
        io.observe(el);
      }
      const onVis = () => { if (document.hidden) visible = false; else visible = true; };
      document.addEventListener("visibilitychange", onVis);

      const clock = new THREE.Clock();
      const pa = posAttr.array as Float32Array;
      const da = dustAttr.array as Float32Array;
      let raf = 0;
      let live = true;

      const tick = () => {
        if (!live) return;
        raf = requestAnimationFrame(tick);
        if (document.hidden || !visible) return;

        const t = clock.getElapsedTime();

        for (let i = 0; i < pa.length; i += 3) {
          const x = pa[i];
          const z = pa[i + 2];
          pa[i + 1] =
            Math.sin(x * 0.16 + t * 0.55) * 1.9 +
            Math.cos(z * 0.13 - t * 0.78) * 1.6 +
            Math.sin((x + z) * 0.07 + t * 0.3) * 1.0;
        }
        posAttr.needsUpdate = true;

        mesh.position.z = (t * 5.5) % (SZ * 2);
        for (let i = 0; i < da.length; i += 3) {
          da[i + 2] += 0.085;
          if (da[i + 2] > 6) {
            da[i + 2] = -170;
            da[i] = (Math.random() - 0.5) * 110;
          }
        }
        dustAttr.needsUpdate = true;

        mouse.x += (mouse.tx - mouse.x) * 0.028;
        mouse.y += (mouse.ty - mouse.y) * 0.028;
        camera.position.set(mouse.x * 2.4, 4.2 + Math.sin(t * 0.22) * 0.4 - mouse.y * 1.2, 5);
        camera.lookAt(mouse.x * 1.2, -2.4, -26);

        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(tick);

      const onResize = () => {
        if (!el) return;
        w = el.clientWidth;
        h = el.clientHeight;
        if (!w || !h) return;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener("resize", onResize);

      cleanup = () => {
        live = false;
        cancelAnimationFrame(raf);
        window.removeEventListener("resize", onResize);
        window.removeEventListener("pointermove", onMove);
        document.removeEventListener("visibilitychange", onVis);
        io?.disconnect();
        geo.dispose();
        lineMat.dispose();
        dustGeo.dispose();
        dustMat.dispose();
        dustTex.dispose();
        renderer.dispose();
        renderer.domElement.parentNode?.removeChild(renderer.domElement);
        if (el) el.style.background = "";
      };
      if (disposed) cleanup();
    }

    // Only pay for the three.js chunk once the hero is actually near the
    // viewport — on an inner page it is never fetched at all.
    let nearIo: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      nearIo = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            nearIo?.disconnect();
            nearIo = null;
            void boot();
          }
        },
        { rootMargin: "200px" },
      );
      nearIo.observe(el);
    } else {
      void boot();
    }

    return () => {
      disposed = true;
      nearIo?.disconnect();
      cleanup?.();
    };
  }, []);

  return <div ref={ref} className={className} aria-hidden="true" />;
}
