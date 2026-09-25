import * as THREE from "three";
import { gsap } from "gsap";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { createScreenTexture, createSoftSprite, setBrushFont } from "./textures";
import { Samurai, type SamuraiPose, PHI0, PHI1 } from "./samurai";
import { PaperSheet } from "./paper";
import { CutGlow, Dust, Shreds, Smoke, Sparks, SwordTrail } from "./effects";

export interface IntroOptions {
  /** Called when the paper starts to separate — start the hero's entrance here. */
  onReveal?: () => void;
  /** Called once the canvas has fully faded; unmount the overlay here. */
  onComplete?: () => void;
  /** Force a quality tier; default picks from viewport + device hints. */
  quality?: "high" | "low";
  /**
   * Playback speed of the approach (camera push-in, the samurai raising the
   * blade) and of the impact (wind-up, slash, split, reveal). 1 is the
   * original pacing; the site runs the approach fast and the impact only
   * moderately so the cut still reads as a cut.
   */
  speed?: number;
  impactSpeed?: number;
  /** CSS font-family for the brush glyphs on the paper (e.g. next/font's variable value). */
  brushFont?: string;
}

export interface IntroHandle {
  play(): void;
  _debugSeek?(t: number): void;
  skip(): void;
  dispose(): void;
}

const PAPER_DIST = 12;
const SAM_Z = 5.6;
const FOV = 32;

export async function createSamuraiIntro(canvas: HTMLCanvasElement, opts: IntroOptions = {}): Promise<IntroHandle> {
  // Give the paper's brush glyphs a moment to use the web font (never block for long).
  setBrushFont(opts.brushFont);
  const family = opts.brushFont?.split(",")[0]?.trim() || '"Shippori Mincho"';
  try {
    await Promise.race([
      document.fonts?.load(`40px ${family}`, "一閃真剣勝負") ?? Promise.resolve(),
      new Promise((r) => setTimeout(r, 700)),
    ]);
  } catch {
    /* ignore */
  }

  const w0 = canvas.clientWidth || window.innerWidth;
  const h0 = canvas.clientHeight || window.innerHeight;
  const low =
    opts.quality === "low" ||
    (opts.quality !== "high" && (Math.min(w0, h0) < 700 || (navigator.hardwareConcurrency || 8) <= 4));

  const renderer = new THREE.WebGLRenderer({
    canvas,
    // MSAA only where it's cheap (1× displays, capable device); high-DPR screens don't need it.
    antialias: !low && (window.devicePixelRatio || 1) < 1.5,
    alpha: true,
    powerPreference: "high-performance",
  });
  // Render resolution is the main GPU cost: cap it, then adapt at runtime (see
  // frame()). Phones are the low tier, but they are also the sharpest screens:
  // at 1× the screen's white frame and the </> mark went soft on a 3× display,
  // so the cap is 2× everywhere and frame() steps it down only if frames lag.
  let pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, w0 / h0, 0.1, 80);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  const envMap = envRT.texture;

  // ---------- assets ----------
  let screenTex: THREE.CanvasTexture | null = null;
  let sheetY = 0;
  let texAspect = 0;
  let texGlyph = -1;
  const dotTex = createSoftSprite("dot");
  const smokeTex = createSoftSprite("smoke");

  // ---------- lights ----------
  const hemi = new THREE.HemisphereLight(0x4a5266, 0x050505, 0);
  scene.add(hemi);
  // Low, raking key from the left: throws the figure's long shadow across the sheet.
  const key = new THREE.SpotLight(0xffe2c0, 0, 0, 0.34, 0.85, 0);
  key.position.set(-9.5, 3.2, 30);
  key.castShadow = true;
  key.shadow.mapSize.set(low ? 512 : 1024, low ? 512 : 1024);
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 3;
  key.shadow.focus = 0.45; // tighter frustum around the figure → sharper shadow for the same map size
  key.shadow.camera.near = 12;
  key.shadow.camera.far = 45;
  scene.add(key, key.target);
  const rim = new THREE.SpotLight(0xa4bcff, 0, 0, 0.55, 0.6, 0);
  const rim2 = new THREE.SpotLight(0xff3d22, 0, 0, 0.6, 0.7, 0);
  scene.add(rim, rim.target, rim2, rim2.target);
  const flash = new THREE.PointLight(0xd6ebff, 0, 7, 1.2);
  scene.add(flash);

  // ---------- samurai ----------
  const samurai = new Samurai(envMap);
  scene.add(samurai.root);

  // ---------- effects ----------
  const trail = new SwordTrail();
  scene.add(trail.glow, trail.mesh);
  const dust = new Dust(low ? 90 : 200, dotTex, new THREE.Vector3(14, 8, 9));
  scene.add(dust.points);
  const sparks = new Sparks(low ? 140 : 320, dotTex);
  scene.add(sparks.points);
  const smoke = new Smoke(low ? 6 : 10, smokeTex, new THREE.Vector3(0, -1.2, SAM_Z), 3.4);
  scene.add(smoke.group);

  // ---------- paper (rebuilt on resize until the cut) ----------
  let paper: PaperSheet;
  let glow: CutGlow;
  let shreds: Shreds;
  let contactX = 0;
  const sheet = new THREE.Group();
  scene.add(sheet);

  const pose: SamuraiPose = { raise: 0, wind: 0, slash: 0, settle: 0 };
  const S = {
    paperGlow: 0,
    key: 0,
    rim: 0,
    trail: 0,
    ignite: 0,
    igniteI: 0,
    ember: 0,
    flash: 0,
    camZ: PAPER_DIST + 1.5,
    camX: 0,
    camY: 1.3,
    fov: FOV,
    samOpacity: 1,
    paperOpacity: 1,
    canvasOpacity: 1,
    shake: 0,
    wind: 0,
    smoke: 0,
  };
  let cutFired = false;
  let splitDone = false;

  const slashCam = new THREE.Vector3(0, 0.9, PAPER_DIST);
  const projectToPaper = (p: THREE.Vector3) => {
    const k = slashCam.z / (slashCam.z - p.z);
    return new THREE.Vector3(slashCam.x + (p.x - slashCam.x) * k, slashCam.y + (p.y - slashCam.y) * k, 0);
  };

  function layout() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    const aspect = w / h;
    // If the canvas is shown scaled down (CSS transform, zoomed preview), don't render
    // more pixels than actually reach the screen.
    const shown = canvas.getBoundingClientRect().width / w || 1;
    const dpr = Math.max(0.5, Math.min(pixelRatio, (window.devicePixelRatio || 1) * shown));
    if (renderer.getPixelRatio() !== dpr) renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = aspect;
    // Portrait screens: widen the lens a little so the figure and slash still read.
    camera.fov = aspect < 0.8 ? FOV + 12 : FOV;
    S.fov = camera.fov;
    camera.updateProjectionMatrix();
    if (cutFired) return;

    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const visH = 2 * PAPER_DIST * t;
    const visW = visH * aspect;
    // A monitor: the screen fills most of the view, the stand sits below it.
    // On a portrait phone the screen keeps its landscape proportions and
    // simply gets smaller — stretched to fill the tall viewport it read as a
    // door, not a monitor — and sits in the upper half, above the figure.
    const portrait = aspect < 0.8;
    const W = visW * (portrait ? 0.9 : 0.88);
    const H = portrait ? W / 1.6 : visH * 0.7;
    const neckH = visH * (portrait ? 0.07 : 0.12);
    sheetY = portrait ? visH * 0.16 : neckH * 0.55;

    // samurai placement: left of centre on landscape, centred on portrait
    const halfWs = (PAPER_DIST - SAM_Z) * t * aspect;
    const sx = aspect > 1.05 ? -halfWs * 0.42 : 0;
    samurai.root.position.set(sx, -1.36, SAM_Z);
    samurai.root.rotation.y = aspect > 1.05 ? 0.38 : 0.15;
    samurai.update(0, pose);
    samurai.root.updateMatrixWorld(true);

    // Project the blade's sweep onto the paper plane → the cut line.
    const at = (u: number) => samurai.bladeWorld({ raise: 1, wind: 1, slash: u, settle: 0 }, 0.9).tip;
    const a = projectToPaper(at(0.3));
    const b = projectToPaper(at(0.72));
    const slope = THREE.MathUtils.clamp((b.y - a.y) / (b.x - a.x || 1), -0.2, 0.2);
    // world → sheet-local (the sheet is lifted by sheetY to make room for the stand)
    const y0 = THREE.MathUtils.clamp(a.y - slope * a.x - sheetY, -H * 0.3, H * 0.3);
    const u0 = -PHI0 / (PHI1 - PHI0);
    contactX = THREE.MathUtils.clamp(projectToPaper(at(u0)).x, -W / 2, W / 2);

    if (paper) {
      sheet.remove(paper.group, glow.mesh);
      scene.remove(shreds.mesh);
      paper.dispose();
      glow.dispose();
      shreds.dispose();
    }
    // </> sits dead centre on the screen.
    const glyphV = 0.5;
    if (!screenTex || Math.abs(W / H - texAspect) > 0.04 || Math.abs(glyphV - texGlyph) > 0.02) {
      screenTex?.dispose();
      texAspect = W / H;
      texGlyph = glyphV;
      screenTex = createScreenTexture(low ? 1536 : 2048, texAspect, glyphV);
    }
    paper = new PaperSheet(W, H, { y0, slope }, screenTex);
    paper.addStand(neckH);
    sheet.position.y = sheetY;
    glow = new CutGlow(W, paper.cut, contactX);
    shreds = new Shreds(low ? 24 : 56, paper.surfMat);
    sheet.add(paper.group, glow.mesh);
    scene.add(shreds.mesh);

    // rim lights follow the figure
    const sp = samurai.root.position;
    rim.position.set(sp.x + 2.2, sp.y + 3.6, sp.z - 2.6);
    rim.target.position.set(sp.x, sp.y + 1.5, sp.z);
    rim2.position.set(sp.x - 2, sp.y + 1.9, sp.z - 1.8);
    rim2.target.position.set(sp.x, sp.y + 1.3, sp.z);
    key.target.position.set(0, -0.2, 0);
    smoke.group.position.x = sp.x;
  }
  layout();

  // ---------- warm-up ----------
  // Compile every shader (trail, sparks, shreds, shadows) now, not on the frame they first
  // appear — otherwise the GPU stalls exactly at the slash.
  {
    const hidden = [trail.mesh, trail.glow, shreds!.mesh];
    hidden.forEach((o) => (o.visible = true));
    key.intensity = 0.001;
    renderer.compile(scene, camera);
    renderer.render(scene, camera);
    hidden.forEach((o) => (o.visible = false));
    key.intensity = 0;
    renderer.clear();
  }

  // ---------- pointer parallax ----------
  const pointer = new THREE.Vector2();
  const pointerSmooth = new THREE.Vector2();
  const onPointer = (e: PointerEvent) => {
    pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
  };
  window.addEventListener("pointermove", onPointer, { passive: true });

  // ---------- resize ----------
  let resizeRaf = 0;
  const onResize = () => {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(layout);
  };
  const ro = new ResizeObserver(onResize);
  ro.observe(canvas);

  // ---------- timeline ----------
  let revealed = false;
  let completed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    opts.onReveal?.();
  };
  const complete = () => {
    if (completed) return;
    completed = true;
    reveal();
    opts.onComplete?.();
  };

  const worldOnSheet = (v: THREE.Vector3) => v.applyMatrix4(sheet.matrixWorld);

  const fireCut = () => {
    if (cutFired) return;
    cutFired = true;
    const tip = samurai.bladeWorld(pose).tip;
    flash.position.copy(tip);
    sheet.updateMatrixWorld(true);
    sparks.emit(paper.W, paper.cut, contactX, 0.2, worldOnSheet);
    // hit-stop: the world holds its breath for a beat
    // brief hit-stop (kept short so it reads as impact, not as a stutter)
    tl.timeScale(0.45 * impactSpeed);
    gsap.to(tl, { timeScale: impactSpeed, duration: 0.22, delay: 0.04, ease: "power1.in" });
  };

  const split = () => {
    if (splitDone) return;
    splitDone = true;
    paper.doSplit();
    shreds.emit(paper.W, paper.cut, contactX, 0.15, worldOnSheet);
  };

  const approachSpeed = Math.max(0.1, opts.speed ?? 1);
  const impactSpeed = Math.max(0.1, opts.impactSpeed ?? approachSpeed);
  const tl = gsap.timeline({ paused: true, defaults: { ease: "power2.inOut" } });
  // The approach plays at its own speed; from the wind-up on, the impact's.
  tl.call(() => tl.timeScale(impactSpeed), [], 4.2);
  tl.to(S, { paperGlow: 0.75, smoke: 1, duration: 1.6, ease: "sine.inOut" }, 0)
    .to(S, { camZ: PAPER_DIST, camY: 0.9, duration: 4.5 }, 0)
    .to(S, { key: 1, duration: 1.9 }, 0.9)
    .to(S, { paperGlow: 0.18, duration: 1.9 }, 0.9)
    .to(S, { rim: 1, duration: 1.7 }, 1.3)
    .to(pose, { raise: 1, duration: 1.35, ease: "power3.inOut" }, 2.3)
    // — dramatic pause — (3.65 → 4.3)
    .to(S, { key: 0.82, duration: 0.6, ease: "sine.inOut" }, 3.7)
    .to(pose, { wind: 1, duration: 0.42, ease: "power3.inOut" }, 4.3)
    .addLabel("slash", 4.76)
    .set(S, { trail: 1 }, "slash")
    .to(pose, { slash: 1, duration: 0.26, ease: "power3.in" }, "slash")
    .call(fireCut, [], "slash+=0.155")
    .set(S, { igniteI: 1, flash: 1, shake: 1, ember: 1 }, "slash+=0.155")
    .to(S, { ignite: 1, duration: 0.22, ease: "power2.out" }, "slash+=0.155")
    .to(S, { flash: 0, duration: 0.5, ease: "power2.out" }, "slash+=0.2")
    .to(S, { shake: 0, duration: 0.6, ease: "power2.out" }, "slash+=0.2")
    .to(S, { trail: 0, duration: 0.55, ease: "power2.out" }, "slash+=0.26")
    .to(pose, { settle: 1, duration: 0.9, ease: "power2.out" }, "slash+=0.26")
    .to(S, { wind: 1, duration: 1.2, ease: "power2.out" }, "slash+=0.2")
    .addLabel("split", "slash+=0.42")
    .call(split, [], "split")
    .to(S, { igniteI: 0, duration: 0.4 }, "split")
    .to(S, { ember: 0, duration: 1.2, ease: "power1.out" }, "split")
    .call(reveal, [], "split+=0.2")
    .to(S, { camZ: 7.5, camY: 0.3, camX: 0.5, fov: "+=8", duration: 1.6, ease: "power3.inOut" }, "split+=0.15")
    .to(S, { samOpacity: 0, smoke: 0, duration: 0.5, ease: "power1.inOut" }, "split+=0.15")
    .to(S, { key: 0.4, rim: 0, duration: 1 }, "split+=0.4")
    .to(S, { paperOpacity: 0, duration: 0.6 }, "split+=1.0")
    .to(S, { canvasOpacity: 0, duration: 0.55, ease: "power1.out" }, "split+=1.2")
    .call(complete, [], "split+=1.8");

  // ---------- render loop ----------
  const clock = new THREE.Clock();
  let raf = 0;
  let time = 0;
  let frameEma = 1 / 60;
  let slowStreak = 0;
  let lastOpacity = -1;
  const tmp = new THREE.Vector3();
  const emberHot = new THREE.Color(0xfff2d8);
  const emberMid = new THREE.Color(0xff6a1a);
  const emberCold = new THREE.Color(0x3a0f1f);

  const render = () => {
    raf = requestAnimationFrame(render);
    frame(Math.min(clock.getDelta(), 1 / 20));
  };

  const frame = (rawDt: number, draw = true) => {
    const dt = rawDt * tl.timeScale();
    time += dt;

    // adaptive resolution: drop pixel ratio if the first second runs slow
    // Dynamic resolution: if frames stay slow, step the pixel ratio down (never back up,
    // so it can't oscillate). Floor 0.6 keeps it recognisable on very weak GPUs.
    if (draw && rawDt > 0) {
      frameEma += (rawDt - frameEma) * 0.1;
      slowStreak = frameEma > 1 / 48 ? slowStreak + 1 : 0;
      if (slowStreak > 20 && pixelRatio > 0.6) {
        pixelRatio = Math.max(0.6, pixelRatio - 0.25);
        renderer.setPixelRatio(pixelRatio);
        const w = canvas.clientWidth || window.innerWidth;
        const h = canvas.clientHeight || window.innerHeight;
        renderer.setSize(w, h, false);
        slowStreak = 0;
        frameEma = 1 / 60;
      }
    }

    // lights
    key.intensity = S.key * 2.5;
    hemi.intensity = 0.05 + S.key * 0.12;
    rim.intensity = S.rim * 14;
    rim2.intensity = S.rim * 4;
    flash.intensity = S.flash * 40;
    if (cutFired) {
      const tip = samurai.bladeWorld(pose).tip;
      flash.position.lerp(tip, 0.3);
    }
    paper.surfMat.emissiveIntensity = S.paperGlow + S.igniteI * 0.12;
    samurai.bladeMat.emissiveIntensity = S.trail * 0.6 + S.flash * 1.5;

    // ember colour on the fresh cut edges
    const e = S.ember;
    paper.emberMat.color.copy(emberCold).lerp(emberMid, Math.min(1, e * 1.4)).lerp(emberHot, Math.max(0, e * 2 - 1));

    // samurai
    samurai.update(time, pose);
    if (S.samOpacity < 1) samurai.setOpacity(S.samOpacity);
    samurai.root.visible = S.samOpacity > 0.01;

    // trail
    if (S.trail > 0.001) {
      const to = pose.slash;
      const from = Math.max(0, to - 0.42);
      trail.update(from, to, (u) => samurai.bladeWorld({ raise: 1, wind: 1, slash: u, settle: 0 }, 1.25), S.trail);
      trail.mesh.visible = trail.glow.visible = true;
    } else {
      trail.mesh.visible = trail.glow.visible = false;
    }

    // paper
    if (!cutFired) {
      sheet.rotation.x = Math.sin(time * 0.35) * 0.012;
      sheet.rotation.y = Math.sin(time * 0.27 + 1) * 0.015;
      sheet.position.y = sheetY + Math.sin(time * 0.4) * 0.03;
    }
    glow.mat.uniforms.uP.value = S.ignite;
    glow.mat.uniforms.uI.value = S.igniteI;
    glow.mesh.visible = S.igniteI > 0.001 || S.ignite < 1;
    paper.update(time, dt);
    if (S.paperOpacity < 1) paper.setOpacity(S.paperOpacity);
    sparks.mat.uniforms.uScale.value = renderer.domElement.height * 0.35;
    dust.mat.uniforms.uScale.value = renderer.domElement.height * 0.35;
    sparks.update(dt);
    shreds.update(dt);
    dust.mat.uniforms.uI.value = 0.15 + S.key * 0.45;
    dust.update(time, S.wind);
    smoke.update(time, S.smoke);

    // camera: slow push-in, pointer parallax, slash shake, dolly through the cut
    pointerSmooth.lerp(pointer, 0.04);
    const par = cutFired ? 0 : 1;
    const shake = S.shake * S.shake;
    camera.position.set(
      S.camX + pointerSmooth.x * 0.28 * par + (Math.random() - 0.5) * shake * 0.12,
      S.camY - pointerSmooth.y * 0.16 * par + (Math.random() - 0.5) * shake * 0.1,
      S.camZ
    );
    if (Math.abs(camera.fov - S.fov) > 0.01) {
      camera.fov = S.fov;
      camera.updateProjectionMatrix();
    }
    tmp.set(S.camX * 0.6 + pointerSmooth.x * 0.1 * par, 0.05, 0);
    camera.lookAt(tmp);
    camera.rotation.z += Math.sin(time * 0.5) * 0.002 + (Math.random() - 0.5) * shake * 0.01;

    if (S.canvasOpacity !== lastOpacity) {
      lastOpacity = S.canvasOpacity;
      canvas.style.opacity = String(S.canvasOpacity);
    }
    if (draw) renderer.render(scene, camera);
  };

  let started = false;
  let disposed = false;

  return {
    play() {
      if (started || disposed) return;
      started = true;
      clock.getDelta();
      render();
      tl.timeScale(approachSpeed);
      tl.play(0);
    },
    /** Dev helper: deterministically advance to time t (seconds) and render. */
    _debugSeek(t: number) {
      tl.pause();
      const step = 1 / 60;
      while (tl.time() < t) {
        tl.time(Math.min(t, tl.time() + step));
        frame(step, false);
      }
      frame(0);
    },
    skip() {
      if (disposed || completed) return;
      reveal();
      tl.pause();
      gsap.to(S, {
        canvasOpacity: 0,
        duration: 0.45,
        ease: "power1.out",
        onComplete: complete,
      });
      if (!started) {
        started = true;
        render();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(resizeRaf);
      tl.kill();
      gsap.killTweensOf(S);
      gsap.killTweensOf(pose);
      ro.disconnect();
      window.removeEventListener("pointermove", onPointer);
      samurai.dispose();
      paper.dispose();
      glow.dispose();
      shreds.dispose();
      trail.dispose();
      dust.dispose();
      sparks.dispose();
      smoke.dispose();
      screenTex?.dispose();
      dotTex.dispose();
      smokeTex.dispose();
      envRT.dispose();
      pmrem.dispose();
      key.shadow.map?.dispose();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
