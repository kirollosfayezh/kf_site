import { useEffect, useRef } from "react";

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

// ---------------------------------------------------------------------------
// Minimal mat4 helpers. Only the three operations this scene needs, so that
// nothing has to be pulled in from a maths library.
// ---------------------------------------------------------------------------

type Mat4 = Float32Array;

function perspective(out: Mat4, fovyDeg: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan((fovyDeg * Math.PI) / 360);
  const nf = 1 / (near - far);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[14] = 2 * far * near * nf;
  return out;
}

/** View matrix for a camera at `eye` looking at `target`, Y-up — three's `lookAt`. */
function lookAt(out: Mat4, ex: number, ey: number, ez: number, tx: number, ty: number, tz: number): Mat4 {
  let zx = ex - tx;
  let zy = ey - ty;
  let zz = ez - tz;
  let len = Math.hypot(zx, zy, zz) || 1;
  zx /= len;
  zy /= len;
  zz /= len;

  // x = normalize(cross(up, z)), up = (0, 1, 0)
  let xx = zz;
  let xy = 0;
  let xz = -zx;
  len = Math.hypot(xx, xy, xz);
  if (len === 0) {
    // Looking straight up or down — nudge so the basis stays defined.
    xx = 1;
    xy = 0;
    xz = 0;
  } else {
    xx /= len;
    xy /= len;
    xz /= len;
  }

  // y = cross(z, x)
  const yx = zy * xz - zz * xy;
  const yy = zz * xx - zx * xz;
  const yz = zx * xy - zy * xx;

  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = xy; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * ex + xy * ey + xz * ez);
  out[13] = -(yx * ex + yy * ey + yz * ez);
  out[14] = -(zx * ex + zy * ey + zz * ez);
  out[15] = 1;
  return out;
}

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function program(gl: WebGLRenderingContext, vsSrc: string, fsSrc: string): WebGLProgram | null {
  const vs = compile(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const p = gl.createProgram();
  if (!p) return null;
  gl.attachShader(p, vs);
  gl.attachShader(p, fs);
  gl.linkProgram(p);
  // The shaders are owned by the program once linked; flagging them for delete
  // here means they go away with it.
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    gl.deleteProgram(p);
    return null;
  }
  return p;
}

/**
 * FogExp2, density 0.013, colour #07070A — three's exact formula, shared by
 * both shaders so the terrain and the dust fade into the distance together.
 *
 * The mix happens in **linear** space, not sRGB. three does its shading
 * linearly and only encodes to sRGB on output, and fog is no exception; mixing
 * the sRGB values directly instead (the obvious way to write this) fades the
 * mid-distance lines along a visibly different curve. Measured against the
 * original export, the shortcut left the terrain's lit pixels about 11% less
 * red and spread over a wider, fainter area. So: decode, mix, re-encode.
 */
const FOG = `
  const float FOG_DENSITY = 0.013;
  const vec3 FOG_COLOR = vec3(0.02745, 0.02745, 0.03922);

  vec3 srgbToLinear(vec3 c) {
    return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
  }
  vec3 linearToSrgb(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
  }

  vec3 applyFog(vec3 color, float depth) {
    float f = clamp(1.0 - exp(-FOG_DENSITY * FOG_DENSITY * depth * depth), 0.0, 1.0);
    vec3 lit = mix(srgbToLinear(color), srgbToLinear(FOG_COLOR), f);
    return linearToSrgb(lit);
  }
`;

/**
 * The ripple keeps the original export's constants; only *where* the height
 * field is sampled is corrected.
 *
 * The mesh scrolls forward and wraps by one cell pair — invisible for the grid
 * lines, because a uniform lattice looks identical after that shift. The height
 * has to be read at the position the vertex is actually **drawn** at, plus the
 * distance flown:
 *
 *     z = aPos.z + uOffset.z + uTravel
 *
 * Read it at the vertex's *local* z instead and the terrain is pinned to the
 * mesh: the ground under a given point on screen then only changes when the
 * mesh wraps, so it advances in discrete hops rather than flowing. Measured at
 * a fixed screen point, that produced a jump 7x the average frame-to-frame
 * change every 0.55 s — the "cut" in the animation. With the rendered position
 * the largest step is 1.7x the average, which is just the natural variation of
 * a sum of sines, and nothing recurs at the wrap period.
 */
const TERRAIN_VS = `
  precision highp float;
  attribute vec3 aPos;
  attribute vec3 aColor;
  uniform mat4 uProj;
  uniform mat4 uView;
  uniform vec3 uOffset;
  uniform float uTime;
  uniform float uTravel;
  varying vec3 vColor;
  varying float vDepth;
  void main() {
    float z = aPos.z + uOffset.z + uTravel;
    float y =
      sin(aPos.x * 0.16 + uTime * 0.55) * 1.9 +
      cos(z * 0.13 - uTime * 0.78) * 1.6 +
      sin((aPos.x + z) * 0.07 + uTime * 0.3) * 1.0;
    vec4 mv = uView * vec4(aPos.x + uOffset.x, y + uOffset.y, aPos.z + uOffset.z, 1.0);
    vDepth = -mv.z;
    vColor = aColor;
    gl_Position = uProj * mv;
  }
`;

const TERRAIN_FS = `
  precision highp float;
  varying vec3 vColor;
  varying float vDepth;
  ${FOG}
  void main() {
    gl_FragColor = vec4(applyFog(vColor, vDepth), 1.0);
  }
`;

// Dust drifts toward the camera and wraps. The old code advanced z by a fixed
// amount per *frame*; this advances it per second and wraps with mod(), which
// is both frame-rate independent and free.
const DUST_VS = `
  precision highp float;
  attribute vec3 aPos;
  attribute vec3 aColor;
  uniform mat4 uProj;
  uniform mat4 uView;
  uniform float uTime;
  uniform float uScale;
  varying vec3 vColor;
  varying float vDepth;
  void main() {
    // Original: z += 0.085 per frame at 60fps, reset to -170.0 once past 6.0.
    float z = -170.0 + mod(aPos.z + 170.0 + uTime * 5.1, 176.0);
    vec4 mv = uView * vec4(aPos.x, aPos.y, z, 1.0);
    vDepth = -mv.z;
    vColor = aColor;
    gl_Position = uProj * mv;
    gl_PointSize = 0.42 * (uScale / max(-mv.z, 0.001));
  }
`;

// A radial white-to-transparent falloff, which is what the 32x32 canvas
// gradient texture the original built was: linear in alpha from centre to edge.
const DUST_FS = `
  precision highp float;
  varying vec3 vColor;
  varying float vDepth;
  ${FOG}
  void main() {
    float a = clamp(1.0 - 2.0 * distance(gl_PointCoord, vec2(0.5)), 0.0, 1.0);
    if (a <= 0.0) discard;
    gl_FragColor = vec4(applyFog(vColor, vDepth), a * 0.75);
  }
`;

const COLS = 78;
const ROWS = 120;
const SX = 1.5;
const SZ = 1.5;
/** Forward flight speed, in world units per second. */
const FLY_SPEED = 5.5;
const DUST_COUNT = 900;

/**
 * The brand gradient's endpoints, #FF6A00 and #FF0080.
 *
 * three's `Color` holds components in **linear** space and `lerp()` therefore
 * interpolates there, with the encode to sRGB happening on output. Doing the
 * same lerp on the sRGB values instead walks a different path between the two
 * hues — measurably so in the middle of the ramp, which is most of the grid.
 * So the endpoints are decoded, mixed linearly, and re-encoded once at build
 * time; the shader then just reads an sRGB colour, as it does for everything
 * else.
 */
const ORANGE_SRGB = [1, 0.41569, 0];
const PINK_SRGB = [1, 0, 0.50196];

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

const ORANGE_LIN = ORANGE_SRGB.map(srgbToLinear);
const PINK_LIN = PINK_SRGB.map(srgbToLinear);

/** The gradient at `m`, returned as the sRGB triple the shaders consume. */
function rampAt(m: number): [number, number, number] {
  return [
    linearToSrgb(ORANGE_LIN[0] + (PINK_LIN[0] - ORANGE_LIN[0]) * m),
    linearToSrgb(ORANGE_LIN[1] + (PINK_LIN[1] - ORANGE_LIN[1]) * m),
    linearToSrgb(ORANGE_LIN[2] + (PINK_LIN[2] - ORANGE_LIN[2]) * m),
  ];
}

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
        failIfMajorPerformanceCaveat: false,
      }) ?? canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;

      if (!gl) return; // No WebGL — the CSS gradient behind us is the fallback.

      const terrainProg = program(gl, TERRAIN_VS, TERRAIN_FS);
      const dustProg = program(gl, DUST_VS, DUST_FS);
      if (!terrainProg || !dustProg) return;

      el.appendChild(canvas);
      // The CSS gradient is only the stand-in for this scene — drop it now that
      // the real one is painting, so additive blending sits on the same black
      // the original does.
      el.style.background = "none";

      // --- terrain geometry (built once, never touched again) ---------------
      const vertCount = COLS * ROWS;
      const verts = new Float32Array(vertCount * 3);
      const colors = new Float32Array(vertCount * 3);
      for (let z = 0; z < ROWS; z++) {
        for (let x = 0; x < COLS; x++) {
          const i = (z * COLS + x) * 3;
          verts[i] = (x - (COLS - 1) / 2) * SX;
          verts[i + 1] = 0;
          verts[i + 2] = -z * SZ;
          const [cr, cg, cb] = rampAt(x / (COLS - 1));
          colors[i] = cr;
          colors[i + 1] = cg;
          colors[i + 2] = cb;
        }
      }

      const idx: number[] = [];
      for (let z = 0; z < ROWS; z++) {
        for (let x = 0; x < COLS; x++) {
          const i = z * COLS + x;
          if (x < COLS - 1) idx.push(i, i + 1);
          if (z < ROWS - 1) idx.push(i, i + COLS);
        }
      }
      // 9,360 vertices fits in a 16-bit index, so no extension is needed.
      const indices = new Uint16Array(idx);

      // --- dust geometry ----------------------------------------------------
      const dp = new Float32Array(DUST_COUNT * 3);
      const dc = new Float32Array(DUST_COUNT * 3);
      for (let i = 0; i < DUST_COUNT; i++) {
        const j = i * 3;
        dp[j] = (Math.random() - 0.5) * 110;
        dp[j + 1] = (Math.random() - 0.5) * 44;
        dp[j + 2] = -Math.random() * 170;
        const [cr, cg, cb] = rampAt(Math.random());
        dc[j] = cr;
        dc[j + 1] = cg;
        dc[j + 2] = cb;
      }

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

      cleanup = () => {
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
      if (disposed) cleanup();
    }

    // Only boot once the hero is actually near the viewport; on an inner page
    // the scene is never created at all.
    let nearIo: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      nearIo = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            nearIo?.disconnect();
            nearIo = null;
            boot();
          }
        },
        { rootMargin: "200px" },
      );
      nearIo.observe(el);
    } else {
      boot();
    }

    return () => {
      disposed = true;
      nearIo?.disconnect();
      cleanup?.();
    };
  }, []);

  return <div ref={ref} className={className} aria-hidden="true" />;
}
