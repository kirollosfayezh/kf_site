/** The katana's grip along the cut arc, and the poses between idle, raised and the swing. */
import * as THREE from "three";

export interface SamuraiPose {
  raise: number; // 0 idle → 1 hasso (raised)
  wind: number; // 0 raised → 1 coiled (arc start)
  slash: number; // 0..1 along the horizontal arc
  settle: number; // 0..1 follow-through relax after the slash
}

export const UP = new THREE.Vector3(0, 1, 0);
export const DOWN = new THREE.Vector3(0, -1, 0);

export const BLADE_LEN = 0.98;
export const ARC_CENTER = new THREE.Vector3(0.0, 1.3, 0.1);
export const ARC_R = 0.42;
export const PHI0 = THREE.MathUtils.degToRad(-140);
export const PHI1 = THREE.MathUtils.degToRad(128);

export type Grip = { pos: THREE.Vector3; dir: THREE.Vector3; edge: THREE.Vector3; twist: number };

export function basisQuat(dir: THREE.Vector3, edgeHint: THREE.Vector3) {
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

export const IDLE: Grip = {
  pos: new THREE.Vector3(-0.17, 1.0, 0.3),
  dir: new THREE.Vector3(-0.45, -0.72, 0.52).normalize(),
  edge: new THREE.Vector3(0, -0.2, 1),
  twist: 0.05,
};
export const RAISED: Grip = {
  pos: new THREE.Vector3(-0.27, 1.6, 0.16),
  dir: new THREE.Vector3(0.18, 0.93, -0.3).normalize(),
  edge: new THREE.Vector3(0, 0.3, 1),
  twist: -0.18,
};

export function lerpGrip(a: Grip, b: Grip, t: number): Grip {
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

// ---------- geometry helpers ----------
