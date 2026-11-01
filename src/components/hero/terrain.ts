/**
 * The hero scene's numbers and static geometry. The values are the original
 * export's and are load-bearing: grid 78x120 at 1.5 spacing, 900 dust points.
 */

export const COLS = 78;
export const ROWS = 120;
export const SX = 1.5;
export const SZ = 1.5;
/** Forward flight speed, in world units per second. */
export const FLY_SPEED = 5.5;
export const DUST_COUNT = 900;

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

export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
export function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
}

const ORANGE_LIN = ORANGE_SRGB.map(srgbToLinear);
const PINK_LIN = PINK_SRGB.map(srgbToLinear);

/** The gradient at `m`, returned as the sRGB triple the shaders consume. */
export function rampAt(m: number): [number, number, number] {
  return [
    linearToSrgb(ORANGE_LIN[0] + (PINK_LIN[0] - ORANGE_LIN[0]) * m),
    linearToSrgb(ORANGE_LIN[1] + (PINK_LIN[1] - ORANGE_LIN[1]) * m),
    linearToSrgb(ORANGE_LIN[2] + (PINK_LIN[2] - ORANGE_LIN[2]) * m),
  ];
}

/** The terrain lattice — positions, per-vertex ramp colours and line indices. Built once. */
export function buildTerrain(): { verts: Float32Array<ArrayBuffer>; colors: Float32Array<ArrayBuffer>; indices: Uint16Array<ArrayBuffer> } {
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
  return { verts, colors, indices };
}

/** The dust cloud: random positions in a 110 x 44 x 170 box, random ramp colours. */
export function buildDust(): { positions: Float32Array<ArrayBuffer>; colors: Float32Array<ArrayBuffer> } {
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
  return { positions: dp, colors: dc };
}
