import { describe, expect, it } from "vitest";
import { lookAt, perspective } from "./mat4.ts";
import { COLS, DUST_COUNT, ROWS, buildDust, buildTerrain, rampAt } from "./terrain.ts";

/** Column-major mat4 × vec4, as WebGL reads it. */
const apply = (m: Float32Array, [x, y, z, w]: number[]) =>
  [0, 1, 2, 3].map((r) => m[r] * x + m[4 + r] * y + m[8 + r] * z + m[12 + r] * w);

describe("rampAt (the orange → pink brand gradient)", () => {
  it("hits the brand colours #FF6A00 and #FF0080 at its ends", () => {
    expect(rampAt(0).map((c) => Math.round(c * 255))).toEqual([255, 106, 0]);
    expect(rampAt(1).map((c) => Math.round(c * 255))).toEqual([255, 0, 128]);
  });

  it("interpolates in linear light, like three's Color.lerp, not in sRGB", () => {
    const [, g, b] = rampAt(0.5);
    // A naive sRGB midpoint would give g ≈ 0.208, b ≈ 0.251.
    expect(g).toBeCloseTo(0.298, 2);
    expect(b).toBeCloseTo(0.362, 2);
  });
});

describe("terrain geometry", () => {
  const { verts, colors, indices } = buildTerrain();

  it("keeps the original 78 × 120 lattice, flat until the shader lifts it", () => {
    expect(verts.length).toBe(COLS * ROWS * 3);
    expect(colors.length).toBe(verts.length);
    for (let i = 1; i < verts.length; i += 3) expect(verts[i]).toBe(0);
  });

  it("draws one line per neighbour pair and fits a 16-bit index buffer", () => {
    expect(indices.length).toBe(2 * ((COLS - 1) * ROWS + COLS * (ROWS - 1)));
    expect(Math.max(...indices)).toBe(COLS * ROWS - 1);
    expect(COLS * ROWS).toBeLessThan(65536);
  });

  it("is centred on x and runs away from the camera along -z", () => {
    expect(verts[0]).toBeCloseTo(-verts[(COLS - 1) * 3]);
    expect(verts[verts.length - 1]).toBeLessThan(0);
  });

  it("scatters the dust inside its 110 × 44 × 170 box", () => {
    const { positions } = buildDust();
    expect(positions.length).toBe(DUST_COUNT * 3);
    for (let i = 0; i < positions.length; i += 3) {
      expect(Math.abs(positions[i])).toBeLessThanOrEqual(55);
      expect(Math.abs(positions[i + 1])).toBeLessThanOrEqual(22);
      expect(positions[i + 2]).toBeLessThanOrEqual(0);
      expect(positions[i + 2]).toBeGreaterThanOrEqual(-170);
    }
  });
});

describe("mat4", () => {
  it("lookAt moves the eye to the origin and puts the target straight ahead (-z)", () => {
    const view = lookAt(new Float32Array(16), 0, 4.2, 5, 0, -2.4, -26);
    expect(apply(view, [0, 4.2, 5, 1]).map((v) => +v.toFixed(5) + 0)).toEqual([0, 0, 0, 1]);
    const [x, y, z] = apply(view, [0, -2.4, -26, 1]);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(-Math.hypot(6.6, 31), 4);
  });

  it("perspective maps the near and far planes to clip-space -1 and +1", () => {
    const proj = perspective(new Float32Array(16), 62, 16 / 9, 0.1, 220);
    const ndcZ = (d: number) => {
      const [, , z, w] = apply(proj, [0, 0, -d, 1]);
      return z / w;
    };
    expect(ndcZ(0.1)).toBeCloseTo(-1, 5);
    expect(ndcZ(220)).toBeCloseTo(1, 5);
  });
});
