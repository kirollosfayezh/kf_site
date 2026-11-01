/**
 * Minimal mat4 helpers. Only the operations this scene needs, so that
 * nothing has to be pulled in from a maths library. Column-major, like WebGL.
 */

export type Mat4 = Float32Array;

export function perspective(out: Mat4, fovyDeg: number, aspect: number, near: number, far: number): Mat4 {
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
export function lookAt(out: Mat4, ex: number, ey: number, ez: number, tx: number, ty: number, tz: number): Mat4 {
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
