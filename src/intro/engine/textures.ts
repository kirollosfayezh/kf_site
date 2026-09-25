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

let brushFont = '"Shippori Mincho","Hiragino Mincho ProN","Yu Mincho","Noto Serif JP","Noto Serif CJK JP",serif';
/** Override the brush-glyph font stack (e.g. with next/font's generated family). */
export function setBrushFont(family: string | undefined) {
  if (family && family.trim()) brushFont = `${family.trim()},${brushFont}`;
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  return { c, ctx };
}

/**
 * Warm washi-style paper: grain, long fibres, faint foxing, a vertical line of
 * brush text and a red seal. Returns colour map + bump map.
 */
export function createPaperTextures(size: number, aspect = 16 / 9) {
  const W = aspect >= 1 ? size : Math.round(size * aspect);
  const H = aspect >= 1 ? Math.round(size / aspect) : size;
  const rand = mulberry32(7);

  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = "#eee7da";
  ctx.fillRect(0, 0, W, H);

  // Large soft tonal variation
  for (let i = 0; i < 26; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const r = (0.15 + rand() * 0.35) * W;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const warm = rand() > 0.5;
    g.addColorStop(0, warm ? "rgba(214,196,164,0.10)" : "rgba(255,252,244,0.12)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // Pixel grain
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 14;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n * 0.9;
  }
  ctx.putImageData(img, 0, 0);

  // Fibres
  const fibres = Math.round(W * 1.6);
  for (let i = 0; i < fibres; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const len = 6 + rand() * (W * 0.02);
    const a = rand() * Math.PI * 2;
    ctx.strokeStyle = rand() > 0.5 ? `rgba(160,140,110,${0.05 + rand() * 0.08})` : `rgba(255,255,250,${0.1 + rand() * 0.12})`;
    ctx.lineWidth = 0.5 + rand() * 0.9;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(
      x + Math.cos(a + 0.6) * len * 0.5,
      y + Math.sin(a + 0.6) * len * 0.5,
      x + Math.cos(a) * len,
      y + Math.sin(a) * len
    );
    ctx.stroke();
  }

  // Edge darkening (aged border)
  const edge = ctx.createLinearGradient(0, 0, W, 0);
  edge.addColorStop(0, "rgba(120,96,60,0.16)");
  edge.addColorStop(0.035, "rgba(0,0,0,0)");
  edge.addColorStop(0.965, "rgba(0,0,0,0)");
  edge.addColorStop(1, "rgba(120,96,60,0.16)");
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, W, H);
  const edgeV = ctx.createLinearGradient(0, 0, 0, H);
  edgeV.addColorStop(0, "rgba(120,96,60,0.14)");
  edgeV.addColorStop(0.05, "rgba(0,0,0,0)");
  edgeV.addColorStop(0.95, "rgba(0,0,0,0)");
  edgeV.addColorStop(1, "rgba(120,96,60,0.16)");
  ctx.fillStyle = edgeV;
  ctx.fillRect(0, 0, W, H);

  // Vertical brush line, right side ("一閃" — a single flash)
  const unit = Math.min(W, H * 1.78) / 100;
  ctx.save();
  ctx.fillStyle = "rgba(24,20,18,0.78)";
  ctx.font = `${unit * 3.6}px ${brushFont}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const chars = ["一", "閃"];
  chars.forEach((ch, i) => ctx.fillText(ch, W - unit * 8, H * 0.12 + i * unit * 4.4));
  ctx.fillStyle = "rgba(24,20,18,0.45)";
  ctx.font = `${unit * 1.2}px ${brushFont}`;
  const small = ["真", "剣", "勝", "負"];
  small.forEach((ch, i) => ctx.fillText(ch, W - unit * 12.2, H * 0.14 + i * unit * 1.6));
  ctx.restore();

  // Red seal (hanko)
  const sx = W - unit * 10;
  const sy = H * 0.12 + unit * 10.2;
  const ss = unit * 3.4;
  ctx.save();
  ctx.fillStyle = "rgba(168,32,26,0.86)";
  ctx.fillRect(sx, sy, ss, ss);
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(0,0,0,${rand() * 0.5})`;
    ctx.fillRect(sx + rand() * ss, sy + rand() * ss, rand() * 2.5, rand() * 2.5);
  }
  ctx.restore();
  ctx.save();
  ctx.fillStyle = "rgba(240,228,210,0.95)";
  ctx.font = `600 ${ss * 0.46}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("KF", sx + ss / 2, sy + ss / 2 + 1);
  ctx.restore();

  // Small caption, bottom-left
  ctx.save();
  ctx.fillStyle = "rgba(40,34,28,0.55)";
  ctx.font = `${unit * 0.85}px Georgia, serif`;
  ctx.fillText("KF TECH SOLUTIONS  —  CAIRO", unit * 6, H - unit * 6);
  ctx.restore();

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  // Bump: grain + fibres only
  const { c: bc, ctx: bctx } = makeCanvas(Math.round(W / 2), Math.round(H / 2));
  bctx.fillStyle = "#808080";
  bctx.fillRect(0, 0, bc.width, bc.height);
  const bimg = bctx.getImageData(0, 0, bc.width, bc.height);
  const bd = bimg.data;
  for (let i = 0; i < bd.length; i += 4) {
    const n = 128 + (rand() - 0.5) * 60;
    bd[i] = bd[i + 1] = bd[i + 2] = n;
  }
  bctx.putImageData(bimg, 0, 0);
  for (let i = 0; i < fibres * 0.5; i++) {
    const x = rand() * bc.width;
    const y = rand() * bc.height;
    const a = rand() * Math.PI * 2;
    const len = 4 + rand() * 18;
    bctx.strokeStyle = `rgba(255,255,255,${0.15 + rand() * 0.2})`;
    bctx.lineWidth = 0.6;
    bctx.beginPath();
    bctx.moveTo(x, y);
    bctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    bctx.stroke();
  }
  const bump = new THREE.CanvasTexture(bc);
  return { map, bump };
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
