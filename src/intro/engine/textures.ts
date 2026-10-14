import * as THREE from "three";

/** Tiny deterministic PRNG so textures look identical on every load. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  return { c, ctx };
}

/** Black lacquer lames laced with crimson cord and gilt rivets. */
export function createLamellarTexture() {
  const S = 512;
  const { c, ctx } = makeCanvas(S, S);
  const rand = mulberry32(21);
  ctx.fillStyle = "#0b0b0d";
  ctx.fillRect(0, 0, S, S);
  const rows = 8;
  const rh = S / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    const g = ctx.createLinearGradient(0, y, 0, y + rh);
    g.addColorStop(0, "#2a2a30");
    g.addColorStop(0.18, "#121216");
    g.addColorStop(0.85, "#08080a");
    g.addColorStop(1, "#000000");
    ctx.fillStyle = g;
    ctx.fillRect(0, y, S, rh - 2);
    // crimson lacing: paired vertical cords
    for (let x = 12; x < S; x += 32) {
      ctx.fillStyle = "#6d1016";
      ctx.fillRect(x, y + rh * 0.2, 5, rh * 0.75);
      ctx.fillRect(x + 8, y + rh * 0.2, 5, rh * 0.75);
      ctx.fillStyle = "rgba(255,120,110,0.18)";
      ctx.fillRect(x + 1, y + rh * 0.2, 1, rh * 0.75);
    }
    // rivets
    for (let x = 28; x < S; x += 32) {
      ctx.fillStyle = "#b08a3e";
      ctx.beginPath();
      ctx.arc(x, y + rh * 0.12, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    // wear
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(255,255,255,${rand() * 0.04})`;
      ctx.fillRect(rand() * S, y + rand() * rh, rand() * 20, 1);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Soft round sprite used for dust, sparks and smoke. */
export function createSoftSprite(kind: "dot" | "smoke") {
  const S = kind === "dot" ? 64 : 256;
  const { c, ctx } = makeCanvas(S, S);
  if (kind === "dot") {
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.6)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  } else {
    const rand = mulberry32(3);
    for (let i = 0; i < 28; i++) {
      const x = S / 2 + (rand() - 0.5) * S * 0.45;
      const y = S / 2 + (rand() - 0.5) * S * 0.45;
      const r = S * (0.12 + rand() * 0.25);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, "rgba(255,255,255,0.10)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * The monitor face: a pink → orange → amber gradient screen, an inset white rounded
 * frame and a bold white </> glyph. Drawn at the sheet's aspect so nothing stretches.
 */
export function createScreenTexture(size: number, aspect: number, glyphV = 0.5) {
  const W = aspect >= 1 ? size : Math.round(size * aspect);
  const H = aspect >= 1 ? Math.round(size / aspect) : size;
  const { c, ctx } = makeCanvas(W, H);
  const m = Math.min(W, H);

  // diagonal gradient: hot pink bottom-left → orange → amber top-right
  const g = ctx.createLinearGradient(0, H, W, 0);
  g.addColorStop(0, "#ff1f7d");
  g.addColorStop(0.45, "#ff6534");
  g.addColorStop(0.75, "#ff8c3a");
  g.addColorStop(1, "#ffc94f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // soft inner light so it reads as a lit panel
  const glow = ctx.createRadialGradient(W * 0.55, H * 0.4, 0, W * 0.55, H * 0.4, Math.max(W, H) * 0.6);
  glow.addColorStop(0, "rgba(255,255,255,0.10)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // fine scanline grain
  const rand = mulberry32(17);
  for (let i = 0; i < W * 3; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rand() * 0.035})`;
    ctx.fillRect(rand() * W, rand() * H, 1 + rand() * 2, 1);
  }

  // inset white rounded frame
  const inset = m * 0.055;
  const r = m * 0.07;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = m * 0.022;
  ctx.beginPath();
  ctx.roundRect(inset, inset, W - inset * 2, H - inset * 2, r);
  ctx.stroke();

  // </> glyph
  const s = m * 0.36; // glyph height
  const cx = W / 2;
  const cy = H * (1 - glyphV); // v is bottom-up; canvas y is top-down
  ctx.lineWidth = m * 0.055;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const half = s / 2;
  const gap = s * 0.62;
  ctx.beginPath();
  // <
  ctx.moveTo(cx - gap, cy - half * 0.95);
  ctx.lineTo(cx - gap - s * 0.34, cy);
  ctx.lineTo(cx - gap, cy + half * 0.95);
  // >
  ctx.moveTo(cx + gap, cy - half * 0.95);
  ctx.lineTo(cx + gap + s * 0.34, cy);
  ctx.lineTo(cx + gap, cy + half * 0.95);
  // /
  ctx.moveTo(cx + s * 0.2, cy - half * 1.15);
  ctx.lineTo(cx - s * 0.2, cy + half * 1.15);
  ctx.stroke();

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}
