import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/**
 * A thick sheet of paper pre-split into two halves along the future cut line.
 * Until `split()` the halves sit flush and share UVs, so the seam is invisible.
 * After the cut each half curls, flutters and flies apart with simple rigid-body
 * integration (velocity, angular velocity, gravity, air drag).
 */

export interface CutLine {
  y0: number; // paper-local y at x = 0
  slope: number;
}

const NX = 96;
const NY = 24;
const THICK = 0.12;

class Half {
  group = new THREE.Group();
  surface: THREE.Mesh;
  walls: THREE.Mesh;
  cutWall: THREE.Mesh;
  private base: Float32Array; // x, y, zStatic, s per vertex
  private pos: THREE.BufferAttribute;
  private wallPos: THREE.BufferAttribute;
  private cutPos: THREE.BufferAttribute;
  private wallIdx: number[][];
  private cutIdx: number[];
  vel = new THREE.Vector3();
  ang = new THREE.Vector3();
  acc = new THREE.Vector3();
  curl = 0;
  flutter = 0;
  sign: 1 | -1;

  constructor(
    sign: 1 | -1,
    W: number,
    H: number,
    cut: (x: number) => number,
    pivotY: number,
    surfMat: THREE.Material,
    edgeMat: THREE.Material,
    emberMat: THREE.Material
  ) {
    this.sign = sign;
    const count = (NX + 1) * (NY + 1);
    const positions = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    this.base = new Float32Array(count * 4);
    for (let j = 0; j <= NY; j++) {
      for (let i = 0; i <= NX; i++) {
        const k = j * (NX + 1) + i;
        const x = -W / 2 + (W * i) / NX;
        const yc = cut(x);
        const s = j / NY;
        const y = sign > 0 ? yc + (H / 2 - yc) * s : yc - (yc + H / 2) * s;
        // round the outer corners (monitor bezel): pull points outside the arc onto it
        const R = Math.min(W, H) * 0.075;
        const cxr = W / 2 - R;
        const cyr = H / 2 - R;
        const ox = Math.abs(x) - cxr;
        const oy = Math.abs(y) - cyr;
        let px = x;
        let py = y;
        if (ox > 0 && oy > 0) {
          const d = Math.hypot(ox, oy);
          if (d > R) {
            px = Math.sign(x) * (cxr + (ox / d) * R);
            py = Math.sign(y) * (cyr + (oy / d) * R);
          }
        }
        const nx = px / (W / 2);
        const ny = py / (H / 2);
        // static waviness + lifted corners (folded, handled paper)
        // a rigid panel: only the faintest bow
        const z = 0.02 * (1 - nx * nx) * (1 - ny * ny);
        this.base.set([px, py - pivotY, z, s], k * 4);
        positions.set([px, py - pivotY, z], k * 3);
        uvs.set([(px + W / 2) / W, (py + H / 2) / H], k * 2);
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) {
        const a = j * (NX + 1) + i;
        const b = a + 1;
        const c = a + NX + 1;
        const d = c + 1;
        if (sign > 0) idx.push(a, b, d, a, d, c);
        else idx.push(a, d, b, a, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(positions, 3);
    geo.setAttribute("position", this.pos);
    geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    this.surface = new THREE.Mesh(geo, surfMat);
    this.surface.receiveShadow = true;
    this.surface.castShadow = true;
    this.group.add(this.surface);
    this.group.position.y = pivotY;

    // boundary strips (paper thickness)
    const row = (j: number) => Array.from({ length: NX + 1 }, (_, i) => j * (NX + 1) + i);
    const col = (i: number) => Array.from({ length: NY + 1 }, (_, j) => j * (NX + 1) + i);
    this.cutIdx = row(0);
    this.wallIdx = [row(NY), col(0), col(NX)];
    const mkStrip = (lists: number[][]) => {
      let n = 0;
      lists.forEach((l) => (n += l.length));
      const p = new Float32Array(n * 2 * 3);
      const ind: number[] = [];
      let off = 0;
      lists.forEach((l) => {
        for (let q = 0; q < l.length - 1; q++) {
          const a = (off + q) * 2;
          ind.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
        off += l.length;
      });
      const g = new THREE.BufferGeometry();
      const attr = new THREE.BufferAttribute(p, 3);
      g.setAttribute("position", attr);
      g.setIndex(ind);
      return { g, attr };
    };
    const w = mkStrip(this.wallIdx);
    this.wallPos = w.attr;
    this.walls = new THREE.Mesh(w.g, edgeMat);
    const c = mkStrip([this.cutIdx]);
    this.cutPos = c.attr;
    this.cutWall = new THREE.Mesh(c.g, emberMat);
    this.cutWall.visible = false; // no seam before the cut
    this.group.add(this.walls, this.cutWall);
    this.deform(0);
  }

  deform(t: number) {
    const p = this.pos.array as Float32Array;
    const b = this.base;
    const n = p.length / 3;
    for (let k = 0; k < n; k++) {
      const x = b[k * 4];
      const y = b[k * 4 + 1];
      const z0 = b[k * 4 + 2];
      const s = b[k * 4 + 3];
      const lip = 1 - s;
      let z = z0 + this.curl * lip * lip * lip * 1.1;
      z += this.flutter * Math.sin(x * 1.25 + t * 8 + (this.sign > 0 ? 0 : 1.7)) * lip * 0.14;
      // curling lip also draws the edge slightly back toward the half
      const pull = this.curl * lip * lip * 0.18 * this.sign;
      p[k * 3] = x;
      p[k * 3 + 1] = y + pull;
      p[k * 3 + 2] = z;
    }
    this.pos.needsUpdate = true;
    this.surface.geometry.computeVertexNormals();
    this.writeStrip(this.wallPos, this.wallIdx);
    this.writeStrip(this.cutPos, [this.cutIdx]);
  }

  private writeStrip(attr: THREE.BufferAttribute, lists: number[][]) {
    const p = this.pos.array as Float32Array;
    const out = attr.array as Float32Array;
    let o = 0;
    lists.forEach((l) => {
      for (const k of l) {
        out[o++] = p[k * 3];
        out[o++] = p[k * 3 + 1];
        out[o++] = p[k * 3 + 2];
        out[o++] = p[k * 3];
        out[o++] = p[k * 3 + 1];
        out[o++] = p[k * 3 + 2] - THICK;
      }
    });
    attr.needsUpdate = true;
  }

  step(dt: number) {
    this.vel.addScaledVector(this.acc, dt);
    this.vel.multiplyScalar(Math.pow(0.55, dt)); // air drag
    this.group.position.addScaledVector(this.vel, dt);
    this.group.rotation.x += this.ang.x * dt;
    this.group.rotation.y += this.ang.y * dt;
    this.group.rotation.z += this.ang.z * dt;
  }

  dispose() {
    this.surface.geometry.dispose();
    this.walls.geometry.dispose();
    this.cutWall.geometry.dispose();
  }
}

export class PaperSheet {
  group = new THREE.Group();
  top: Half;
  bottom: Half;
  surfMat: THREE.MeshStandardMaterial;
  edgeMat: THREE.MeshBasicMaterial;
  emberMat: THREE.MeshBasicMaterial;
  split = false;
  W: number;
  H: number;
  cut: (x: number) => number;

  constructor(W: number, H: number, line: CutLine, map: THREE.Texture) {
    this.W = W;
    this.H = H;
    this.cut = (x: number) => line.y0 + line.slope * x + 0.012 * Math.sin(x * 7.3) + 0.006 * Math.sin(x * 23.1 + 1.3);
    this.surfMat = new THREE.MeshStandardMaterial({
      map,
      roughness: 0.62,
      metalness: 0,
      side: THREE.DoubleSide,
      emissive: new THREE.Color(0xffffff),
      emissiveMap: map,
      emissiveIntensity: 0,
      shadowSide: THREE.FrontSide,
      transparent: true, // fixed up front: toggling later forces a recompile
    });
    this.edgeMat = new THREE.MeshBasicMaterial({ color: 0x3a0f1f, side: THREE.DoubleSide, transparent: true });
    this.emberMat = new THREE.MeshBasicMaterial({ color: 0x3a0f1f, side: THREE.DoubleSide, toneMapped: false, transparent: true });
    const pivot = this.cut(0);
    this.top = new Half(1, W, H, this.cut, pivot, this.surfMat, this.edgeMat, this.emberMat);
    this.bottom = new Half(-1, W, H, this.cut, pivot, this.surfMat, this.edgeMat, this.emberMat);
    this.group.add(this.top.group, this.bottom.group);
  }

  standMat: THREE.MeshStandardMaterial | null = null;
  private standGeos: THREE.BufferGeometry[] = [];

  /** Monitor neck + foot under the screen; rides on the bottom half so it falls with it. */
  addStand(neckH: number) {
    const W = this.W;
    const H = this.H;
    const pivot = this.cut(0);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff3a6e,
      roughness: 0.4,
      metalness: 0.05,
      emissive: new THREE.Color(0xff2a66),
      emissiveIntensity: 0.25,
      transparent: true,
    });
    this.standMat = mat;
    const neckW = Math.min(W, H) * 0.14;
    const neck = new RoundedBoxGeometry(neckW, neckH * 0.8, 0.14, 3, 0.03);
    const footW = Math.min(W * 0.36, H * 0.6);
    const footH = neckH * 0.34;
    const foot = new RoundedBoxGeometry(footW, footH, 0.3, 4, footH * 0.48);
    this.standGeos.push(neck, foot);
    const nm = new THREE.Mesh(neck, mat);
    nm.position.set(0, -H / 2 - neckH * 0.4 - pivot, -0.1);
    const fm = new THREE.Mesh(foot, mat);
    fm.position.set(0, -H / 2 - neckH * 0.8 - footH / 2 - pivot, -0.05);
    nm.receiveShadow = fm.receiveShadow = true;
    this.bottom.group.add(nm, fm);
  }

  doSplit() {
    if (this.split) return;
    this.split = true;
    this.top.cutWall.visible = this.bottom.cutWall.visible = true;
    // Top half: lifted by the slash's wake, tips back and sails up out of frame.
    this.top.vel.set(0.3, 4.4, -0.4);
    this.top.acc.set(0.1, 7.5, -1.2);
    this.top.ang.set(-0.75, 0.1, -0.08);
    // Bottom half: drops under gravity, lip flips toward the viewer.
    this.bottom.vel.set(-0.25, -2.8, 1.0);
    this.bottom.acc.set(-0.1, -13, 1.2);
    this.bottom.ang.set(-1.15, -0.1, 0.1);
  }

  update(t: number, dt: number) {
    if (!this.split) return;
    for (const h of [this.top, this.bottom]) {
      // a panel, not paper: it only warps slightly as it breaks apart
      h.curl = Math.min(0.3, h.curl + dt * 0.8);
      h.flutter = Math.min(0.15, h.flutter + dt * 0.6);
      h.step(dt);
      h.deform(t);
    }
  }

  setOpacity(o: number) {
    for (const m of [this.surfMat, this.edgeMat, this.emberMat, this.standMat]) {
      if (!m) continue;
      m.opacity = o;
    }
  }

  dispose() {
    this.top.dispose();
    this.bottom.dispose();
    this.surfMat.dispose();
    this.standMat?.dispose();
    this.standGeos.forEach((g) => g.dispose());
    this.edgeMat.dispose();
    this.emberMat.dispose();
  }
}
