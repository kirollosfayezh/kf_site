import { lookAt, perspective } from "./mat4.ts";
import { DUST_COUNT, FLY_SPEED, SZ, buildDust, buildTerrain } from "./terrain.ts";

export interface SceneSetup {
  /** The hero container; the canvas is appended to it. */
  el: HTMLElement;
  canvas: HTMLCanvasElement;
  gl: WebGLRenderingContext;
  terrainProg: WebGLProgram;
  dustProg: WebGLProgram;
  /** The capped device pixel ratio the canvas is allocated at. */
  dpr: number;
}

/**
 * Mounts the canvas, uploads the static geometry once and starts the render
 * loop. Needs linked programs. Returns the teardown, which releases every GL
 * object, listener and observer and restores the CSS gradient.
 */
export function startScene({ el, canvas, gl, terrainProg, dustProg, dpr }: SceneSetup): () => void {
  el.appendChild(canvas);
  // The CSS gradient is only the stand-in for this scene — drop it now that
  // the real one is painting, so additive blending sits on the same black
  // the original does.
  el.style.background = "none";

  // Geometry is built once and never touched again; the ripple and the dust
  // drift happen in the vertex shaders.
  const { verts, colors, indices } = buildTerrain();
  const { positions: dp, colors: dc } = buildDust();

  const buf = (data: BufferSource, target: GLenum = gl.ARRAY_BUFFER) => {
    const b = gl.createBuffer();
    gl.bindBuffer(target, b);
    gl.bufferData(target, data, gl.STATIC_DRAW);
    return b;
  };
  const terrainPos = buf(verts);
  const terrainCol = buf(colors);
  const terrainIdx = buf(indices, gl.ELEMENT_ARRAY_BUFFER);
  const dustPos = buf(dp);
  const dustCol = buf(dc);

  const loc = {
    terrain: {
      aPos: gl.getAttribLocation(terrainProg, "aPos"),
      aColor: gl.getAttribLocation(terrainProg, "aColor"),
      uProj: gl.getUniformLocation(terrainProg, "uProj"),
      uView: gl.getUniformLocation(terrainProg, "uView"),
      uOffset: gl.getUniformLocation(terrainProg, "uOffset"),
      uTime: gl.getUniformLocation(terrainProg, "uTime"),
      uTravel: gl.getUniformLocation(terrainProg, "uTravel"),
    },
    dust: {
      aPos: gl.getAttribLocation(dustProg, "aPos"),
      aColor: gl.getAttribLocation(dustProg, "aColor"),
      uProj: gl.getUniformLocation(dustProg, "uProj"),
      uView: gl.getUniformLocation(dustProg, "uView"),
      uTime: gl.getUniformLocation(dustProg, "uTime"),
      uScale: gl.getUniformLocation(dustProg, "uScale"),
    },
  };

  const proj = new Float32Array(16);
  const view = new Float32Array(16);

  let w = 0;
  let h = 0;
  const applySize = (cw: number, ch: number) => {
    if (!cw || !ch || (cw === w && ch === h)) return;
    w = cw;
    h = ch;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    perspective(proj, 62, w / h, 0.1, 220);
  };

  // Size is pushed in by a ResizeObserver rather than pulled by reading
  // `clientWidth` in the render loop: that read is a synchronous layout
  // flush, and doing it once a frame would put back exactly the kind of
  // main-thread stall this rewrite exists to remove.
  applySize(el.clientWidth || window.innerWidth, el.clientHeight || window.innerHeight);
  let ro: ResizeObserver | null = null;
  const onWindowResize = () => applySize(el.clientWidth || window.innerWidth, el.clientHeight || window.innerHeight);
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) applySize(Math.round(box.width), Math.round(box.height));
    });
    ro.observe(el);
  } else {
    window.addEventListener("resize", onWindowResize);
  }

  // Additive blending on a transparent canvas, depth tested but not
  // written — the original's material settings.
  gl.disable(gl.DEPTH_TEST);
  gl.depthMask(false);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.clearColor(0, 0, 0, 0);

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
  const onVis = () => { visible = !document.hidden; };
  document.addEventListener("visibilitychange", onVis);

  const start = performance.now();
  let raf = 0;
  let live = true;
  // The easing below was written against 60fps frames. Scaling it by the
  // real frame delta keeps the parallax feeling identical on 120 Hz panels
  // instead of twice as fast.
  let last = start;

  const tick = (now: number) => {
    if (!live) return;
    raf = requestAnimationFrame(tick);
    if (document.hidden || !visible) {
      last = now;
      return;
    }

    if (!w || !h) return;

    const t = (now - start) / 1000;
    const step = Math.min((now - last) / 16.667, 4);
    last = now;

    mouse.x += (mouse.tx - mouse.x) * 0.028 * step;
    mouse.y += (mouse.ty - mouse.y) * 0.028 * step;
    lookAt(
      view,
      mouse.x * 2.4, 4.2 + Math.sin(t * 0.22) * 0.4 - mouse.y * 1.2, 5,
      mouse.x * 1.2, -2.4, -26,
    );

    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(terrainProg);
    gl.uniformMatrix4fv(loc.terrain.uProj, false, proj);
    gl.uniformMatrix4fv(loc.terrain.uView, false, view);
    gl.uniform1f(loc.terrain.uTime, t);
    // The mesh wraps by one cell pair (invisible on a uniform lattice); the
    // height field reads the unwrapped distance, so the ground ahead never
    // repeats. Computed in JS so the modulo is done in double precision.
    const travel = t * FLY_SPEED;
    gl.uniform1f(loc.terrain.uTravel, travel);
    gl.uniform3f(loc.terrain.uOffset, 0, -2.6, travel % (SZ * 2));
    gl.bindBuffer(gl.ARRAY_BUFFER, terrainPos);
    gl.enableVertexAttribArray(loc.terrain.aPos);
    gl.vertexAttribPointer(loc.terrain.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, terrainCol);
    gl.enableVertexAttribArray(loc.terrain.aColor);
    gl.vertexAttribPointer(loc.terrain.aColor, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, terrainIdx);
    gl.drawElements(gl.LINES, indices.length, gl.UNSIGNED_SHORT, 0);

    gl.useProgram(dustProg);
    gl.uniformMatrix4fv(loc.dust.uProj, false, proj);
    gl.uniformMatrix4fv(loc.dust.uView, false, view);
    gl.uniform1f(loc.dust.uTime, t);
    gl.uniform1f(loc.dust.uScale, h * 0.5 * dpr);
    gl.bindBuffer(gl.ARRAY_BUFFER, dustPos);
    gl.enableVertexAttribArray(loc.dust.aPos);
    gl.vertexAttribPointer(loc.dust.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, dustCol);
    gl.enableVertexAttribArray(loc.dust.aColor);
    gl.vertexAttribPointer(loc.dust.aColor, 3, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.POINTS, 0, DUST_COUNT);
  };
  raf = requestAnimationFrame(tick);

  // A lost context (tab backgrounded on a phone, GPU reset) would
  // otherwise leave a permanently black canvas over the gradient.
  const onLost = (e: Event) => {
    e.preventDefault();
    live = false;
    cancelAnimationFrame(raf);
    el.style.background = "";
  };
  canvas.addEventListener("webglcontextlost", onLost);

  return () => {
    live = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("pointermove", onMove);
    document.removeEventListener("visibilitychange", onVis);
    canvas.removeEventListener("webglcontextlost", onLost);
    io?.disconnect();
    ro?.disconnect();
    window.removeEventListener("resize", onWindowResize);
    gl.deleteBuffer(terrainPos);
    gl.deleteBuffer(terrainCol);
    gl.deleteBuffer(terrainIdx);
    gl.deleteBuffer(dustPos);
    gl.deleteBuffer(dustCol);
    gl.deleteProgram(terrainProg);
    gl.deleteProgram(dustProg);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    canvas.parentNode?.removeChild(canvas);
    el.style.background = "";
  };
}
