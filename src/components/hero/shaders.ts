/** GLSL for the hero: the rippling terrain lines and the drifting dust points. */

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
export const TERRAIN_VS = `
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

export const TERRAIN_FS = `
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
export const DUST_VS = `
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
export const DUST_FS = `
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
