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

function canvasTexture(c: HTMLCanvasElement, colour: boolean) {
  const t = new THREE.CanvasTexture(c);
  if (colour) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/** Per-pixel grain on a canvas: `amount` is the ± range in 0–255 levels. */
function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number, rand: () => number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

export interface ArmourTextures {
  /** One row of laced lames (kebiki odoshi): a lacquered band on top, crimson cords below. Tiles in u; v spans the row. */
  lames: THREE.CanvasTexture;
  lamesBump: THREE.CanvasTexture;
  /** Hakama and gaiters: dark indigo with a faint pinstripe. */
  cloth: THREE.CanvasTexture;
  clothBump: THREE.CanvasTexture;
  /** Kusari (chain mail) for the sleeves. */
  mail: THREE.CanvasTexture;
  mailBump: THREE.CanvasTexture;
  /** Tsuka-ito: black cord wrapped in diamonds over white ray skin. */
  ito: THREE.CanvasTexture;
  all: THREE.Texture[];
}

/** Every surface texture the samurai uses, drawn once (deterministic) into small canvases. */
export function createArmourTextures(): ArmourTextures {
  const rand = mulberry32(21);

  // ---- laced lames: 512×128 = 16 lames per tile, one row tall ----
  const LW = 512;
  const LH = 128;
  const { c: lc, ctx: l } = makeCanvas(LW, LH);
  const { c: lbc, ctx: lb } = makeCanvas(LW, LH);
  l.fillStyle = "#050506";
  l.fillRect(0, 0, LW, LH);
  lb.fillStyle = "#000";
  lb.fillRect(0, 0, LW, LH);
  const band = LH * 0.28; // lacquered top band
  for (let x = 0; x < LW; x += 32) {
    // scalloped lame tops, lacquered
    const g = l.createLinearGradient(0, 2, 0, band);
    g.addColorStop(0, "#4a4a54");
    g.addColorStop(0.18, "#1c1c22");
    g.addColorStop(1, "#08080a");
    l.fillStyle = g;
    l.beginPath();
    l.roundRect(x + 1, 3, 30, LH - 6, [9, 9, 2, 2]);
    l.fill();
    const gb = lb.createLinearGradient(0, 2, 0, band);
    gb.addColorStop(0, "#fff");
    gb.addColorStop(0.25, "#d8d8d8");
    gb.addColorStop(1, "#b4b4b4");
    lb.fillStyle = gb;
    lb.beginPath();
    lb.roundRect(x + 1, 3, 30, LH - 6, [9, 9, 2, 2]);
    lb.fill();
    // a gilt rivet on every other lame
    if ((x / 32) % 2 === 0) {
      l.fillStyle = "#c9a256";
      l.beginPath();
      l.arc(x + 16, band * 0.5, 2.6, 0, Math.PI * 2);
      l.fill();
      lb.fillStyle = "#fff";
      lb.beginPath();
      lb.arc(x + 16, band * 0.5, 2.6, 0, Math.PI * 2);
      lb.fill();
    }
  }
  // dense vertical crimson lacing over the lower part of the row
  for (let x = 0; x < LW; x += 8) {
    const cg = l.createLinearGradient(x, 0, x + 7, 0);
    cg.addColorStop(0, "#3a0509");
    cg.addColorStop(0.45, "#b3232b");
    cg.addColorStop(0.6, "#8e161e");
    cg.addColorStop(1, "#2a0306");
    l.fillStyle = cg;
    l.fillRect(x, band, 7, LH - band - 5);
    const bg = lb.createLinearGradient(x, 0, x + 7, 0);
    bg.addColorStop(0, "#606060");
    bg.addColorStop(0.5, "#ffffff");
    bg.addColorStop(1, "#606060");
    lb.fillStyle = bg;
    lb.fillRect(x, band, 7, LH - band - 5);
    // braid: short dark diagonals down each cord
    l.strokeStyle = "rgba(20,0,2,0.45)";
    lb.strokeStyle = "rgba(0,0,0,0.5)";
    l.lineWidth = lb.lineWidth = 1.2;
    for (let y = band + 3; y < LH - 6; y += 6) {
      l.beginPath();
      l.moveTo(x + 1, y);
      l.lineTo(x + 6, y + 3);
      l.stroke();
      lb.beginPath();
      lb.moveTo(x + 1, y);
      lb.lineTo(x + 6, y + 3);
      lb.stroke();
    }
  }
  // the cords pass through the band: a soft shadow line where they emerge
  l.fillStyle = "rgba(0,0,0,0.55)";
  l.fillRect(0, band - 1, LW, 3);
  grain(l, LW, LH, 10, rand);

  // ---- hakama cloth: 256², dark indigo, pinstripes every 32px ----
  const CS = 256;
  const { c: cc, ctx: cl } = makeCanvas(CS, CS);
  const { c: cbc, ctx: cb } = makeCanvas(CS, CS);
  cl.fillStyle = "#262b3a";
  cl.fillRect(0, 0, CS, CS);
  cb.fillStyle = "#808080";
  cb.fillRect(0, 0, CS, CS);
  for (let x = 0; x < CS; x += 32) {
    cl.fillStyle = "#3a4156";
    cl.fillRect(x, 0, 2, CS);
    cl.fillStyle = "#171a24";
    cl.fillRect(x + 14, 0, 1, CS);
    cb.fillStyle = "#a0a0a0";
    cb.fillRect(x, 0, 2, CS);
  }
  // weave
  for (let y = 0; y < CS; y += 2) {
    cb.fillStyle = y % 4 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)";
    cb.fillRect(0, y, CS, 1);
  }
  grain(cl, CS, CS, 9, rand);
  grain(cb, CS, CS, 40, rand);

  // ---- kusari: 128², staggered rings ----
  const MS = 128;
  const { c: mc, ctx: ml } = makeCanvas(MS, MS);
  const { c: mbc, ctx: mb } = makeCanvas(MS, MS);
  ml.fillStyle = "#0a0a0c";
  ml.fillRect(0, 0, MS, MS);
  mb.fillStyle = "#000";
  mb.fillRect(0, 0, MS, MS);
  ml.lineWidth = mb.lineWidth = 3;
  for (let row = 0; row < 8; row++) {
    for (let col = -1; col <= 8; col++) {
      const x = col * 16 + (row % 2 ? 8 : 0) + 8;
      const y = row * 16 + 8;
      for (const dy of [0, -MS, MS]) {
        ml.strokeStyle = "#5c5c66";
        ml.beginPath();
        ml.ellipse(x, y + dy, 6.5, 5, 0, 0, Math.PI * 2);
        ml.stroke();
        ml.strokeStyle = "rgba(255,255,255,0.25)";
        ml.beginPath();
        ml.ellipse(x, y + dy, 6.5, 5, 0, Math.PI * 1.1, Math.PI * 1.6);
        ml.stroke();
        mb.strokeStyle = "#fff";
        mb.beginPath();
        mb.ellipse(x, y + dy, 6.5, 5, 0, 0, Math.PI * 2);
        mb.stroke();
      }
    }
  }

  // ---- tsuka-ito: 128×256, black cord diamonds over white same ----
  const IW = 128;
  const IH = 256;
  const { c: ic, ctx: il } = makeCanvas(IW, IH);
  il.fillStyle = "#ddd6c6";
  il.fillRect(0, 0, IW, IH);
  for (let i = 0; i < 900; i++) {
    il.fillStyle = `rgba(150,140,120,${0.25 + rand() * 0.3})`;
    il.beginPath();
    il.arc(rand() * IW, rand() * IH, 0.8 + rand() * 1.4, 0, Math.PI * 2);
    il.fill();
  }
  il.strokeStyle = "#111014";
  il.lineWidth = 22;
  il.lineCap = "butt";
  for (let y = -IH; y <= IH * 2; y += 64) {
    for (const dx of [-IW, 0, IW]) {
      il.beginPath();
      il.moveTo(dx, y);
      il.lineTo(dx + IW, y + 64);
      il.stroke();
      il.beginPath();
      il.moveTo(dx + IW, y);
      il.lineTo(dx, y + 64);
      il.stroke();
    }
  }
  // twist highlights on the cord
  il.strokeStyle = "rgba(255,255,255,0.08)";
  il.lineWidth = 2;
  for (let y = 0; y < IH; y += 5) {
    il.beginPath();
    il.moveTo(0, y);
    il.lineTo(IW, y + 2);
    il.stroke();
  }

  const t: ArmourTextures = {
    lames: canvasTexture(lc, true),
    lamesBump: canvasTexture(lbc, false),
    cloth: canvasTexture(cc, true),
    clothBump: canvasTexture(cbc, false),
    mail: canvasTexture(mc, true),
    mailBump: canvasTexture(mbc, false),
    ito: canvasTexture(ic, true),
    all: [],
  };
  t.all = [t.lames, t.lamesBump, t.cloth, t.clothBump, t.mail, t.mailBump, t.ito];
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
