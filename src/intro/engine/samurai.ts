import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createLamellarTexture } from "./textures";

/**
 * Procedural armoured samurai with a two-bone IK rig.
 * Space conventions (root-local): +Y up, figure faces +Z, HIS right hand is -X.
 * The katana is driven by a single "grip" transform; both arms solve IK to it.
 */

export interface SamuraiPose {
  raise: number; // 0 idle → 1 hasso (raised)
  wind: number; // 0 raised → 1 coiled (arc start)
  slash: number; // 0..1 along the horizontal arc
  settle: number; // 0..1 follow-through relax after the slash
}

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

export const BLADE_LEN = 0.98;
const ARC_CENTER = new THREE.Vector3(0.0, 1.3, 0.1);
const ARC_R = 0.42;
export const PHI0 = THREE.MathUtils.degToRad(-140);
export const PHI1 = THREE.MathUtils.degToRad(128);

type Grip = { pos: THREE.Vector3; dir: THREE.Vector3; edge: THREE.Vector3; twist: number };

function basisQuat(dir: THREE.Vector3, edgeHint: THREE.Vector3) {
  const y = dir.clone().normalize();
  const z = edgeHint.clone().sub(y.clone().multiplyScalar(edgeHint.dot(y))).normalize();
  const x = new THREE.Vector3().crossVectors(y, z).normalize();
  const m = new THREE.Matrix4().makeBasis(x, y, z);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

export function arcGrip(phi: number, u: number): Grip {
  const s = Math.sin(phi);
  const c = Math.cos(phi);
  return {
    // a rising-to-falling diagonal plane so the arc reads as a crescent, not a flat line
    pos: new THREE.Vector3(ARC_CENTER.x + ARC_R * s, ARC_CENTER.y + THREE.MathUtils.lerp(0.14, -0.12, u), ARC_CENTER.z + ARC_R * c),
    dir: new THREE.Vector3(s, THREE.MathUtils.lerp(0.32, -0.34, u), c).normalize(),
    edge: new THREE.Vector3(c, 0, -s),
    twist: THREE.MathUtils.lerp(-0.55, 0.6, u),
  };
}

const IDLE: Grip = {
  pos: new THREE.Vector3(-0.17, 1.0, 0.3),
  dir: new THREE.Vector3(-0.45, -0.72, 0.52).normalize(),
  edge: new THREE.Vector3(0, -0.2, 1),
  twist: 0.05,
};
const RAISED: Grip = {
  pos: new THREE.Vector3(-0.27, 1.6, 0.16),
  dir: new THREE.Vector3(0.18, 0.93, -0.3).normalize(),
  edge: new THREE.Vector3(0, 0.3, 1),
  twist: -0.18,
};

function lerpGrip(a: Grip, b: Grip, t: number): Grip {
  const qa = basisQuat(a.dir, a.edge);
  const qb = basisQuat(b.dir, b.edge);
  const q = qa.clone().slerp(qb, t);
  const dir = UP.clone().applyQuaternion(q);
  const edge = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
  return { pos: a.pos.clone().lerp(b.pos, t), dir, edge, twist: THREE.MathUtils.lerp(a.twist, b.twist, t) };
}

export function gripForPose(p: SamuraiPose): Grip {
  if (p.slash > 0) {
    const u = p.slash;
    const g = arcGrip(THREE.MathUtils.lerp(PHI0, PHI1, u), u);
    if (p.settle > 0) {
      // relax into a low, extended zanshin
      const end: Grip = {
        pos: new THREE.Vector3(0.36, 1.12, 0.12),
        dir: new THREE.Vector3(0.8, -0.35, 0.45).normalize(),
        edge: new THREE.Vector3(0.3, 0, -0.9),
        twist: 0.4,
      };
      return lerpGrip(g, end, p.settle);
    }
    return g;
  }
  if (p.wind > 0) return lerpGrip(RAISED, arcGrip(PHI0, 0), p.wind);
  return lerpGrip(IDLE, RAISED, p.raise);
}

export class Samurai {
  root = new THREE.Group();
  materials: THREE.Material[] = [];
  private geos: THREE.BufferGeometry[] = [];
  private textures: THREE.Texture[] = [];

  private hips = new THREE.Group();
  private torso = new THREE.Group();
  private head = new THREE.Group();
  private katana = new THREE.Group();
  bladeMat!: THREE.MeshStandardMaterial;

  private rUpper!: THREE.Mesh;
  private rFore!: THREE.Mesh;
  private lUpper!: THREE.Mesh;
  private lFore!: THREE.Mesh;
  private rHand!: THREE.Mesh;
  private lHand!: THREE.Mesh;
  private rSode!: THREE.Group;
  private lSode!: THREE.Group;
  private rElbow!: THREE.Mesh;
  private lElbow!: THREE.Mesh;

  private readonly upperLen = 0.3;
  private readonly foreLen = 0.29;

  constructor(envMap: THREE.Texture | null) {
    const lam = createLamellarTexture();
    this.textures.push(lam);

    const lacquer = this.mat(
      new THREE.MeshStandardMaterial({ color: 0x141418, roughness: 0.28, metalness: 0.35, envMap, envMapIntensity: 0.25 })
    );
    const lamMat = this.mat(
      new THREE.MeshStandardMaterial({ map: lam, roughness: 0.4, metalness: 0.25, envMap, envMapIntensity: 0.2, side: THREE.DoubleSide })
    );
    const gold = this.mat(new THREE.MeshStandardMaterial({ color: 0xc19a4b, roughness: 0.28, metalness: 1, envMap, envMapIntensity: 0.6 }));
    const crimson = this.mat(new THREE.MeshStandardMaterial({ color: 0x5e0d12, roughness: 0.85 }));
    const cloth = this.mat(new THREE.MeshStandardMaterial({ color: 0x17171d, roughness: 0.95 }));
    const leather = this.mat(new THREE.MeshStandardMaterial({ color: 0x1d1512, roughness: 0.7 }));
    const iron = this.mat(new THREE.MeshStandardMaterial({ color: 0x1b1b1f, roughness: 0.45, metalness: 0.85, envMap, envMapIntensity: 0.35 }));
    this.bladeMat = this.mat(
      new THREE.MeshStandardMaterial({
        color: 0xdfe5ec,
        roughness: 0.14,
        metalness: 1,
        envMap,
        envMapIntensity: 1.3,
        emissive: new THREE.Color(0x9fd4ff),
        emissiveIntensity: 0,
      })
    ) as THREE.MeshStandardMaterial;

    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
      this.geos.push(geo);
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // ---------- hips, skirt, legs ----------
    this.hips.position.set(0, 0.9, 0);
    this.root.add(this.hips);
    add(this.hips, new THREE.CylinderGeometry(0.175, 0.18, 0.09, 24), crimson, 0, 0.02, 0);
    // kusazuri — 5 flaring plates
    for (let i = 0; i < 5; i++) {
      const center = -Math.PI * 0.8 + i * (Math.PI * 0.4);
      const g = new THREE.CylinderGeometry(0.19, 0.3, 0.36, 10, 1, true, center + Math.PI - 0.36, 0.72);
      const m = add(this.hips, g, lamMat, 0, -0.17, 0);
      m.rotation.y = Math.PI;
    }
    // hakama legs
    // wide, grounded stance in hakama
    const legGeo = new THREE.CylinderGeometry(0.1, 0.2, 0.95, 18);
    legGeo.translate(0, -0.475, 0);
    const lLeg = add(this.hips, legGeo, cloth, 0.1, -0.02, 0);
    lLeg.rotation.set(-0.08, 0, 0.26);
    const rLeg = add(this.hips, legGeo, cloth, -0.1, -0.02, 0.04);
    rLeg.rotation.set(0.12, 0, -0.24);
    const footGeo = new THREE.BoxGeometry(0.1, 0.06, 0.26);
    add(this.hips, footGeo, leather, 0.34, -0.9, -0.05).rotation.y = 0.4;
    add(this.hips, footGeo, leather, -0.33, -0.9, 0.14).rotation.y = -0.3;

    // ---------- torso ----------
    this.torso.position.set(0, 0.06, 0);
    this.hips.add(this.torso);
    const doPts = [
      new THREE.Vector2(0.15, 0),
      new THREE.Vector2(0.16, 0.08),
      new THREE.Vector2(0.21, 0.24),
      new THREE.Vector2(0.245, 0.38),
      new THREE.Vector2(0.235, 0.47),
      new THREE.Vector2(0.16, 0.54),
      new THREE.Vector2(0.07, 0.56),
    ];
    const doGeo = new THREE.LatheGeometry(doPts, 28);
    const doMesh = add(this.torso, doGeo, lamMat);
    doMesh.scale.set(1, 1, 0.78);
    // chest plate (munaita) + gilt trim
    add(this.torso, new THREE.BoxGeometry(0.3, 0.07, 0.04), lacquer, 0, 0.44, 0.15);
    add(this.torso, new THREE.BoxGeometry(0.31, 0.012, 0.045), gold, 0, 0.475, 0.152);
    // agemaki bow on back
    add(this.torso, new THREE.TorusGeometry(0.04, 0.012, 8, 16), crimson, 0, 0.32, -0.18);
    // neck
    add(this.torso, new THREE.CylinderGeometry(0.055, 0.065, 0.1, 12), leather, 0, 0.58, 0);

    // ---------- head & kabuto ----------
    this.head.position.set(0, 0.69, 0.0);
    this.torso.add(this.head);
    add(this.head, new THREE.SphereGeometry(0.095, 20, 16), leather);
    const bowl = add(this.head, new THREE.SphereGeometry(0.132, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2), lacquer, 0, 0.015, -0.005);
    bowl.scale.set(1, 0.9, 1.08);
    // vertical ridges (suji)
    {
      // 16 ridges merged into one draw call
      const parts: THREE.BufferGeometry[] = [];
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < 16; i++) {
        const g = new THREE.TorusGeometry(0.133, 0.0035, 4, 20, Math.PI / 2);
        m4.compose(
          new THREE.Vector3(0, 0.015, -0.005),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (i / 16) * Math.PI * 2, Math.PI / 2)),
          new THREE.Vector3(0.9, 1, 1.08)
        );
        g.applyMatrix4(m4);
        parts.push(g);
      }
      const merged = mergeGeometries(parts)!;
      parts.forEach((g) => g.dispose());
      add(this.head, merged, iron).castShadow = false;
    }
    add(this.head, new THREE.TorusGeometry(0.134, 0.006, 6, 40), gold, 0, 0.016, -0.005).rotation.x = Math.PI / 2;
    add(this.head, new THREE.CylinderGeometry(0.018, 0.024, 0.02, 12), gold, 0, 0.135, -0.005);
    // visor
    const visor = add(this.head, new THREE.CylinderGeometry(0.14, 0.17, 0.012, 28, 1, false, -1.25, 2.5), lacquer, 0, 0.012, 0.012);
    visor.rotation.x = 0.18;
    // shikoro (neck guard) — three flaring rows
    for (let i = 0; i < 3; i++) {
      const g = new THREE.CylinderGeometry(0.135 + i * 0.035, 0.175 + i * 0.04, 0.06, 26, 1, true, Math.PI - 2.15, 4.3);
      add(this.head, g, lamMat, 0, -0.02 - i * 0.052, -0.012);
    }
    // fukigaeshi (turned-back wings)
    const wingGeo = new THREE.BoxGeometry(0.09, 0.07, 0.012);
    const wl = add(this.head, wingGeo, lacquer, 0.16, -0.01, 0.07);
    wl.rotation.set(0, -1.0, 0.1);
    const wr = add(this.head, wingGeo, lacquer, -0.16, -0.01, 0.07);
    wr.rotation.set(0, 1.0, -0.1);
    // kuwagata (twin horns)
    const horn = new THREE.Shape();
    horn.moveTo(0, 0);
    horn.quadraticCurveTo(0.05, 0.12, 0.03, 0.3);
    horn.quadraticCurveTo(0.016, 0.14, -0.014, 0.0);
    horn.lineTo(0, 0);
    const hornGeo = new THREE.ExtrudeGeometry(horn, { depth: 0.006, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 1, curveSegments: 16 });
    const hl = add(this.head, hornGeo, gold, 0.03, 0.06, 0.13);
    hl.rotation.set(-0.12, 0, -0.18);
    const hr = add(this.head, hornGeo, gold, -0.03, 0.06, 0.13);
    hr.rotation.set(-0.12, Math.PI, 0.18);
    hr.position.z = 0.136;
    // menpo (face mask) + throat guard
    const menpo = add(this.head, new THREE.SphereGeometry(0.1, 24, 12, -Math.PI * 0.35 + Math.PI / 2, Math.PI * 0.7, Math.PI * 0.45, Math.PI * 0.4), iron, 0, 0, 0.012);
    menpo.scale.set(1.05, 1.1, 1.1);
    menpo.rotation.y = Math.PI;
    add(this.head, new THREE.CylinderGeometry(0.075, 0.13, 0.12, 22, 1, true, -1.3, 2.6), lamMat, 0, -0.13, 0.015);

    // ---------- arms (root space, IK) ----------
    const upperGeo = new THREE.CylinderGeometry(0.055, 0.047, 1, 12);
    upperGeo.translate(0, 0.5, 0);
    const foreGeo = new THREE.CylinderGeometry(0.047, 0.038, 1, 12);
    foreGeo.translate(0, 0.5, 0);
    this.geos.push(upperGeo, foreGeo);
    const mk = (g: THREE.BufferGeometry, m: THREE.Material) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.castShadow = true;
      this.root.add(mesh);
      return mesh;
    };
    this.rUpper = mk(upperGeo, cloth);
    this.lUpper = mk(upperGeo, cloth);
    this.rFore = mk(foreGeo, lamMat);
    this.lFore = mk(foreGeo, lamMat);
    const elbowGeo = new THREE.SphereGeometry(0.05, 12, 10);
    this.geos.push(elbowGeo);
    this.rElbow = mk(elbowGeo, iron);
    this.lElbow = mk(elbowGeo, iron);
    const handGeo = new THREE.BoxGeometry(0.075, 0.085, 0.06);
    this.geos.push(handGeo);
    this.rHand = mk(handGeo, leather);
    this.lHand = mk(handGeo, leather);

    // sode (large shoulder guards)
    const mkSode = (side: 1 | -1) => {
      const g = new THREE.Group();
      const center = side === -1 ? -Math.PI / 2 : Math.PI / 2;
      const geo = new THREE.CylinderGeometry(0.13, 0.17, 0.3, 12, 1, true, center - 0.85, 1.7);
      geo.translate(0, -0.15, 0);
      this.geos.push(geo);
      const m = new THREE.Mesh(geo, lamMat);
      m.castShadow = true;
      g.add(m);
      const trim = new THREE.Mesh(new THREE.CylinderGeometry(0.131, 0.131, 0.014, 12, 1, true, center - 0.85, 1.7), gold);
      this.geos.push(trim.geometry);
      g.add(trim);
      this.root.add(g);
      return g;
    };
    this.rSode = mkSode(-1);
    this.lSode = mkSode(1);

    // ---------- katana ----------
    this.buildKatana(add, gold, iron, leather);
    this.root.add(this.katana);

    // Only large silhouettes cast shadows; tiny parts cost a shadow draw for no visible gain.
    this.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.geometry.computeBoundingSphere();
      if ((m.geometry.boundingSphere?.radius ?? 1) < 0.06) m.castShadow = false;
    });

    // slight contrapposto stance
    this.root.rotation.order = "YXZ";
  }

  private mat<T extends THREE.Material>(m: T): T {
    m.transparent = true;
    this.materials.push(m);
    return m;
  }

  private buildKatana(
    add: (p: THREE.Object3D, g: THREE.BufferGeometry, m: THREE.Material, x?: number, y?: number, z?: number) => THREE.Mesh,
    gold: THREE.Material,
    iron: THREE.Material,
    leather: THREE.Material
  ) {
    const k = this.katana;
    add(k, new THREE.BoxGeometry(0.03, 0.27, 0.036), leather, 0, -0.115, 0); // tsuka
    add(k, new THREE.BoxGeometry(0.034, 0.02, 0.04), gold, 0, -0.255, 0); // kashira
    const tsuba = add(k, new THREE.CylinderGeometry(0.048, 0.048, 0.009, 20), iron, 0, 0.03, 0);
    tsuba.scale.set(0.85, 1, 1);
    add(k, new THREE.BoxGeometry(0.012, 0.03, 0.036), gold, 0, 0.05, 0); // habaki

    // curved blade: shape in (edge=z, length=y), extruded in x
    const L = BLADE_LEN;
    const w = 0.031;
    const sori = 0.028;
    const back = (v: number) => -w / 2 - sori * Math.pow(v / L, 2);
    const shape = new THREE.Shape();
    const steps = 24;
    shape.moveTo(w / 2, 0);
    for (let i = 1; i <= steps; i++) {
      const v = (i / steps) * (L - 0.05);
      shape.lineTo(w / 2 - sori * Math.pow(v / L, 2), v);
    }
    shape.quadraticCurveTo(w / 2 - sori * 0.95, L - 0.01, back(L) + 0.004, L); // kissaki
    for (let i = steps; i >= 0; i--) {
      const v = (i / steps) * (L - 0.02);
      shape.lineTo(back(v), v);
    }
    const bladeGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.0025, bevelSize: 0.003, bevelSegments: 2 });
    bladeGeo.translate(0, 0, -0.003);
    bladeGeo.rotateY(-Math.PI / 2); // shape x (edge side) → local +z
    const blade = add(k, bladeGeo, this.bladeMat, 0, 0.065, 0);
    blade.castShadow = true;
  }

  private solveArm(
    shoulder: THREE.Vector3,
    target: THREE.Vector3,
    pole: THREE.Vector3,
    upper: THREE.Mesh,
    fore: THREE.Mesh,
    elbowMesh: THREE.Mesh
  ) {
    const a = this.upperLen;
    const b = this.foreLen;
    const toT = target.clone().sub(shoulder);
    let d = toT.length();
    const dir = toT.clone().normalize();
    d = Math.min(d, a + b - 0.001);
    const cosA = (a * a + d * d - b * b) / (2 * a * d);
    const angA = Math.acos(THREE.MathUtils.clamp(cosA, -1, 1));
    const toPole = pole.clone().sub(shoulder);
    const perp = toPole.sub(dir.clone().multiplyScalar(toPole.dot(dir))).normalize();
    const elbow = shoulder
      .clone()
      .add(dir.clone().multiplyScalar(Math.cos(angA) * a))
      .add(perp.multiplyScalar(Math.sin(angA) * a));
    const hand = shoulder.clone().add(dir.clone().multiplyScalar(d));
    const place = (m: THREE.Mesh, p: THREE.Vector3, q: THREE.Vector3) => {
      const v = q.clone().sub(p);
      m.position.copy(p);
      m.scale.set(1, v.length(), 1);
      m.quaternion.setFromUnitVectors(UP, v.normalize());
    };
    place(upper, shoulder, elbow);
    place(fore, elbow, hand);
    elbowMesh.position.copy(elbow);
    return hand;
  }

  /** Root-local grip position and blade direction for a pose (used for trails & cut alignment). */
  sample(p: SamuraiPose) {
    return gripForPose(p);
  }

  update(time: number, p: SamuraiPose) {
    const g = gripForPose(p);

    // body: breathing, weight shift, twist into the cut
    const breathe = Math.sin(time * 1.6) * 0.5 + 0.5;
    this.torso.scale.set(1 + breathe * 0.012, 1 + breathe * 0.008, 1 + breathe * 0.015);
    this.torso.rotation.y = g.twist * 0.75;
    this.hips.rotation.y = g.twist * 0.3;
    this.hips.position.y = 0.9 - p.raise * 0.02 - p.wind * 0.05 + p.slash * 0.02 - p.settle * 0.04;
    this.torso.rotation.x = 0.04 + p.wind * 0.06 - p.slash * 0.05;
    this.head.rotation.y = -g.twist * 0.55 + Math.sin(time * 0.7) * 0.03;
    this.head.rotation.x = -0.05 + p.raise * 0.05;

    this.root.updateMatrixWorld(true);
    const rootInv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    const toRoot = (v: THREE.Vector3) => v.applyMatrix4(this.torso.matrixWorld).applyMatrix4(rootInv);
    const rShoulder = toRoot(new THREE.Vector3(-0.235, 0.47, 0));
    const lShoulder = toRoot(new THREE.Vector3(0.235, 0.47, 0));

    // katana
    const q = basisQuat(g.dir, g.edge);
    this.katana.position.copy(g.pos);
    this.katana.quaternion.copy(q);

    const lTarget = g.pos.clone().sub(g.dir.clone().multiplyScalar(0.14));
    const rPole = rShoulder.clone().add(new THREE.Vector3(-0.35, -0.45, -0.25));
    const lPole = lShoulder.clone().add(new THREE.Vector3(0.35, -0.45, -0.25));
    this.solveArm(rShoulder, g.pos, rPole, this.rUpper, this.rFore, this.rElbow);
    this.solveArm(lShoulder, lTarget, lPole, this.lUpper, this.lFore, this.lElbow);
    this.rHand.position.copy(g.pos);
    this.rHand.quaternion.copy(q);
    this.lHand.position.copy(lTarget);
    this.lHand.quaternion.copy(q);

    // sode hang between gravity and upper arm direction
    const orientSode = (s: THREE.Group, sh: THREE.Vector3, upper: THREE.Mesh) => {
      const armDir = UP.clone().applyQuaternion(upper.quaternion);
      const hang = DOWN.clone().lerp(armDir, 0.45).normalize();
      s.position.copy(sh).add(new THREE.Vector3(0, 0.035, 0));
      const qy = new THREE.Quaternion().setFromAxisAngle(UP, this.torso.rotation.y + this.hips.rotation.y);
      s.quaternion.setFromUnitVectors(DOWN, hang).multiply(qy);
    };
    orientSode(this.rSode, rShoulder, this.rUpper);
    orientSode(this.lSode, lShoulder, this.lUpper);
  }

  /** World-space blade base/tip for a pose (root must have up-to-date matrixWorld). */
  bladeWorld(p: SamuraiPose, extend = 1) {
    const g = gripForPose(p);
    const base = g.pos.clone().add(g.dir.clone().multiplyScalar(0.12)).applyMatrix4(this.root.matrixWorld);
    const tip = g.pos
      .clone()
      .add(g.dir.clone().multiplyScalar((0.065 + BLADE_LEN) * extend))
      .applyMatrix4(this.root.matrixWorld);
    return { base, tip };
  }

  setOpacity(o: number) {
    // Materials are created transparent (see constructor) so fading never triggers a
    // shader recompile mid-animation — that recompile was a visible hitch.
    for (const m of this.materials) {
      m.opacity = o;
      m.depthWrite = o > 0.5;
    }
  }

  dispose() {
    this.geos.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.textures.forEach((t) => t.dispose());
  }
}
