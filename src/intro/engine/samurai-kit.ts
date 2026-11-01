/** Geometry helpers for modelling the armour: transforms, lathed bands, swept tubes, plates, and a batching Kit. */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export function xf(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  return new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), V(sx, sy, sz));
}

/** A frame at `from` whose +Y runs to `to` and whose +Z leans toward `fwd`. */
export function along(from: THREE.Vector3, to: THREE.Vector3, fwd: THREE.Vector3) {
  const y = to.clone().sub(from).normalize();
  const z = fwd.clone().sub(y.clone().multiplyScalar(fwd.dot(y))).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(from);
}

export function scaleUV(g: THREE.BufferGeometry, su: number, sv: number) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return g;
}

export const ell = (rx: number, ry: number, rz: number, w = 16, h = 12) => new THREE.SphereGeometry(1, w, h).scale(rx, ry, rz);

/**
 * An open band of a cone around +Y, centred on y = 0. θ = 0 faces +Z (front),
 * θ = π/2 faces +X. UVs are scaled so one texture tile spans `tile` units of arc.
 */
export function band(rTop: number, rBot: number, h: number, th0: number, thLen: number, tile = 0.16) {
  const g = new THREE.CylinderGeometry(rTop, rBot, h, Math.max(6, Math.ceil(thLen * 9)), 1, true, th0, thLen);
  return scaleUV(g, (thLen * (rTop + rBot)) / 2 / tile, 1);
}

/** A thin gilt (or cord) rim following a band's edge, same θ convention as `band`. */
export function trim(r: number, tube: number, th0: number, thLen: number) {
  const g = new THREE.TorusGeometry(r, tube, 5, Math.max(8, Math.ceil(thLen * 10)), thLen);
  g.rotateX(Math.PI / 2);
  g.rotateY(th0 + thLen - Math.PI / 2);
  return g;
}

/** Rows of laced lames hanging down from y = `top`, each tucked under the one above. */
export function lacedRows(n: number, top: number, rowH: number, r0: number, flare: number, th0: number, thLen: number) {
  const out: THREE.BufferGeometry[] = [];
  for (let k = 0; k < n; k++) {
    const rT = r0 + k * flare;
    out.push(band(rT, rT + flare + 0.006, rowH, th0, thLen).translate(0, top - rowH / 2 - k * (rowH - 0.008), 0));
  }
  return out;
}

/**
 * A tube swept along a smooth curve through `pts`, with the radius free to vary
 * along it (t, 0..1) and around it (a, radians from `ref`). Frames are carried
 * by parallel transport, so the tube never twists.
 */
export function sweep(pts: THREE.Vector3[], segs: number, radial: number, radius: (t: number, a: number) => number, ref?: THREE.Vector3) {
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  const T: THREE.Vector3[] = [];
  for (let i = 0; i <= segs; i++) T.push(curve.getTangentAt(i / segs).normalize());
  const n = (ref ?? (Math.abs(T[0].y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0))).clone();
  n.sub(T[0].clone().multiplyScalar(n.dot(T[0]))).normalize();
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const axis = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    if (i > 0) {
      axis.crossVectors(T[i - 1], T[i]);
      const len = axis.length();
      if (len > 1e-6) n.applyAxisAngle(axis.divideScalar(len), Math.acos(THREE.MathUtils.clamp(T[i - 1].dot(T[i]), -1, 1)));
    }
    const t = i / segs;
    const p = curve.getPointAt(t);
    b.crossVectors(T[i], n);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      const r = radius(t, a);
      const c = Math.cos(a) * r;
      const s = Math.sin(a) * r;
      pos.push(p.x + c * n.x + s * b.x, p.y + c * n.y + s * b.y, p.z + c * n.z + s * b.z);
      uv.push(j / radial, t);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const c = a + radial + 1;
      idx.push(a, a + 1, c, a + 1, c + 1, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setIndex(idx);
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  // weld the seam's normals so it doesn't show as a crease
  const nm = g.attributes.normal;
  const tmp = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const a = i * (radial + 1);
    const z = a + radial;
    tmp.set(nm.getX(a) + nm.getX(z), nm.getY(a) + nm.getY(z), nm.getZ(a) + nm.getZ(z)).normalize();
    nm.setXYZ(a, tmp.x, tmp.y, tmp.z);
    nm.setXYZ(z, tmp.x, tmp.y, tmp.z);
  }
  return g;
}

export function roundRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

export const plate = (shape: THREE.Shape, depth: number) =>
  new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 1, curveSegments: 8 });

/**
 * Collects every static part per (bone, material) and merges each set into a
 * single mesh: the figure has hundreds of parts but draws in a few dozen calls.
 */
export class Kit {
  private bins = new Map<THREE.Object3D, Map<THREE.Material, THREE.BufferGeometry[]>>();

  put(bone: THREE.Object3D, mat: THREE.Material, geo: THREE.BufferGeometry, m?: THREE.Matrix4) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    if (m) g.applyMatrix4(m);
    for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
    g.clearGroups();
    let bin = this.bins.get(bone);
    if (!bin) this.bins.set(bone, (bin = new Map()));
    const list = bin.get(mat) ?? [];
    list.push(g);
    bin.set(mat, list);
  }

  build(track: (g: THREE.BufferGeometry) => void) {
    for (const [bone, bin] of this.bins) {
      for (const [mat, list] of bin) {
        const merged = mergeGeometries(list, false)!;
        list.forEach((g) => g.dispose());
        track(merged);
        const mesh = new THREE.Mesh(merged, mat);
        mesh.castShadow = true;
        bone.add(mesh);
      }
    }
    this.bins.clear();
  }
}
