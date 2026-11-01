import * as THREE from "three";
import { createArmourTextures } from "./textures";
import { V, xf, along, scaleUV, ell, band, trim, lacedRows, sweep, roundRect, plate, Kit } from "./samurai-kit";
import { type SamuraiPose, UP, DOWN, BLADE_LEN, basisQuat, gripForPose } from "./samurai-rig";

/**
 * Procedural armoured samurai with a two-bone IK rig, modelled on a laced
 * yoroi: lacquered riveted dō, crimson-laced kusazuri, sode and shikoro,
 * kabuto with kuwagata and menpo, mail-and-splint sleeves, haidate, suneate,
 * hakama, waraji, and the daishō at the hip.
 * Space conventions (root-local): +Y up, figure faces +Z, HIS right hand is -X.
 * The katana is driven by a single "grip" transform; both arms solve IK to it.
 */

export { BLADE_LEN, PHI0, PHI1, arcGrip, gripForPose, type SamuraiPose } from "./samurai-rig";

const DO_Z = 0.8; // the cuirass is wider than it is deep

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

  // Arm bones: each segment's +Y runs along the bone, +Z toward the elbow's outside.
  private rUpper = new THREE.Group();
  private rFore = new THREE.Group();
  private lUpper = new THREE.Group();
  private lFore = new THREE.Group();
  private rHand = new THREE.Group();
  private lHand = new THREE.Group();
  private rSode = new THREE.Group();
  private lSode = new THREE.Group();

  private readonly upperLen = 0.3;
  private readonly foreLen = 0.29;

  constructor(envMap: THREE.Texture | null) {
    const tx = createArmourTextures();
    this.textures.push(...tx.all);

    // urushi: deep black lacquer with a clear coat, so every plate carries a crisp highlight
    const lacquer = this.mat(
      new THREE.MeshPhysicalMaterial({ color: 0x0c0c10, roughness: 0.34, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1, envMap, envMapIntensity: 0.7, side: THREE.DoubleSide })
    );
    const lames = this.mat(
      new THREE.MeshStandardMaterial({ map: tx.lames, bumpMap: tx.lamesBump, bumpScale: 2, roughness: 0.45, metalness: 0.15, envMap, envMapIntensity: 0.45, side: THREE.DoubleSide })
    );
    const gold = this.mat(new THREE.MeshStandardMaterial({ color: 0xcfa557, roughness: 0.24, metalness: 1, envMap, envMapIntensity: 1 }));
    const cord = this.mat(new THREE.MeshStandardMaterial({ color: 0x8e1219, roughness: 0.7, bumpMap: tx.clothBump, bumpScale: 1 }));
    const cloth = this.mat(
      new THREE.MeshStandardMaterial({ map: tx.cloth, bumpMap: tx.clothBump, bumpScale: 1, roughness: 0.92, side: THREE.DoubleSide })
    );
    const mail = this.mat(
      new THREE.MeshStandardMaterial({ map: tx.mail, bumpMap: tx.mailBump, bumpScale: 1.5, roughness: 0.42, metalness: 0.85, envMap, envMapIntensity: 0.6 })
    );
    const iron = this.mat(new THREE.MeshStandardMaterial({ color: 0x202026, roughness: 0.34, metalness: 0.9, envMap, envMapIntensity: 0.75, side: THREE.DoubleSide }));
    const glove = this.mat(new THREE.MeshStandardMaterial({ color: 0x2a1c14, roughness: 0.66 }));
    const shade = this.mat(new THREE.MeshStandardMaterial({ color: 0x050404, roughness: 1 }));
    const hair = this.mat(new THREE.MeshStandardMaterial({ color: 0xb9b2a6, roughness: 0.8 }));
    const eyes = this.mat(new THREE.MeshStandardMaterial({ color: 0x1a0600, emissive: new THREE.Color(0xff5a1e), emissiveIntensity: 0.9 }));
    const straw = this.mat(new THREE.MeshStandardMaterial({ color: 0x8f7546, roughness: 0.95, bumpMap: tx.clothBump, bumpScale: 2 }));
    const ito = this.mat(new THREE.MeshStandardMaterial({ map: tx.ito, roughness: 0.72 }));
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

    const k = new Kit();
    const fwd = V(0, 0, 1);

    // ---------- hips: hakama, haidate, suneate, waraji, kusazuri, obi, daishō ----------
    this.hips.position.set(0, 0.9, 0);
    this.root.add(this.hips);

    // wide, grounded stance; the right foot (-X) a little forward
    const legs = [
      { s: -1, hip: V(-0.1, -0.05, 0.03), knee: V(-0.21, -0.47, 0.13), ankle: V(-0.3, -0.83, 0.11), yaw: -0.3 },
      { s: 1, hip: V(0.1, -0.05, -0.01), knee: V(0.21, -0.47, 0.02), ankle: V(0.31, -0.83, -0.07), yaw: 0.4 },
    ];
    // hakama radius from the waist (t = 0) to where it is gathered under the knee guard (t = 1)
    const prof = [0.12, 0.15, 0.175, 0.185, 0.16, 0.105, 0.072];
    const hakamaR = (t: number) => {
      const f = t * (prof.length - 1);
      const i = Math.min(prof.length - 2, Math.floor(f));
      const u = f - i;
      return prof[i] + (prof[i + 1] - prof[i]) * u * u * (3 - 2 * u);
    };
    for (const L of legs) {
      const gather = L.knee.clone().lerp(L.ankle, 0.14);
      const mid = L.hip.clone().lerp(L.knee, 0.5).add(V(L.s * 0.025, 0, 0.01));
      k.put(
        this.hips,
        cloth,
        sweep([V(L.s * 0.06, 0.06, 0), L.hip, mid, L.knee, gather], 30, 36, (t, a) => {
          // deep pleats that fade into the waistband, crumpled where the cloth is gathered
          const pleats = (0.06 * Math.sin(7 * a + t * 2) + 0.03 * Math.sin(12 * a + 1.3)) * Math.min(1, t * 3);
          const crumple = t > 0.7 ? ((t - 0.7) / 0.3) * 0.07 * Math.sin(11 * a + 0.5) : 0;
          return hakamaR(t) * (1 + pleats + crumple);
        }, fwd)
      );

      // haidate: laced thigh guards over the front of the hakama
      const thigh = along(L.knee, L.hip, fwd);
      const T = L.knee.distanceTo(L.hip);
      for (const g of lacedRows(4, T * 0.98, 0.085, 0.2, 0.008, -1.15, 2.3)) k.put(this.hips, lames, g, thigh);

      // suneate: three iron splints on a cloth gaiter, gilt hinges, a lacquered knee guard
      const top = L.knee.clone().lerp(L.ankle, 0.1);
      const shin = along(L.ankle, top, fwd);
      const S = top.distanceTo(L.ankle);
      k.put(this.hips, cloth, new THREE.CylinderGeometry(0.056, 0.047, S, 16, 1, true).translate(0, S / 2, 0), shin);
      for (const c of [-0.85, 0, 0.85]) k.put(this.hips, iron, band(0.066, 0.058, S * 0.8, c - 0.4, 0.8).translate(0, S * 0.47, 0), shin);
      for (const c of [-0.425, 0.425]) k.put(this.hips, gold, band(0.067, 0.059, S * 0.8, c - 0.03, 0.06).translate(0, S * 0.47, 0), shin);
      for (const y of [0.16, 0.8]) k.put(this.hips, cord, trim(0.058, 0.006, 1.2, Math.PI * 2 - 2.4).translate(0, S * y, 0), shin);
      k.put(this.hips, lacquer, band(0.098, 0.08, 0.14, -0.85, 1.7).translate(0, S + 0.02, 0), shin);
      k.put(this.hips, gold, trim(0.098, 0.004, -0.85, 1.7).translate(0, S + 0.09, 0), shin);

      // tabi and straw waraji
      const foot = xf(L.ankle.x + Math.sin(L.yaw) * 0.05, -0.865, L.ankle.z + Math.cos(L.yaw) * 0.05, 0, L.yaw, 0);
      k.put(this.hips, cloth, ell(0.046, 0.034, 0.115).translate(0, -0.006, 0.01), foot);
      k.put(this.hips, straw, plate(roundRect(0.095, 0.25, 0.04), 0.008).rotateX(Math.PI / 2).translate(0, -0.03, 0.02), foot);
      for (const z of [-0.02, 0.05]) k.put(this.hips, cord, new THREE.TorusGeometry(0.043, 0.005, 5, 12, Math.PI).translate(0, -0.03, z), foot);
    }

    // kusazuri: seven laced panels, the side ones flaring wide over the stance
    const panels: [number, number, number][] = [
      [-0.45, 0.86, 0.02],
      [0.45, 0.86, 0.02],
      [-1.32, 0.9, 0.03],
      [1.32, 0.9, 0.03],
      [-2.25, 0.95, 0.02],
      [2.25, 0.95, 0.02],
      [Math.PI, 0.95, 0.018],
    ];
    for (const [c, w, flare] of panels) {
      for (const g of lacedRows(5, 0.04, 0.072, 0.205, flare, c - w / 2, w)) k.put(this.hips, lames, g.scale(1, 1, 0.86));
    }
    // uwa-obi with its knot and hanging ends
    k.put(this.hips, cord, new THREE.TorusGeometry(0.19, 0.016, 8, 48).rotateX(Math.PI / 2).scale(1, 1, 0.84).translate(0, 0.055, 0));
    k.put(this.hips, cord, ell(0.03, 0.022, 0.02).translate(0.035, 0.05, 0.165));
    for (const dx of [0.025, 0.05])
      k.put(this.hips, cord, sweep([V(dx, 0.04, 0.17), V(dx + 0.01, -0.03, 0.19), V(dx + 0.005, -0.1, 0.2)], 8, 6, (t) => 0.008 * (1 - t * 0.4)));

    // daishō on the left hip, edge up: the katana's empty saya and the wakizashi
    const ellR = (rx: number, ry: number) => (_t: number, a: number) => 1 / Math.hypot(Math.cos(a) / rx, Math.sin(a) / ry);
    const saya = [V(0.13, 0.07, 0.22), V(0.2, 0.03, 0.02), V(0.26, -0.06, -0.28), V(0.3, -0.16, -0.6)];
    k.put(this.hips, lacquer, sweep(saya, 20, 10, ellR(0.018, 0.011), V(0, 1, 0)));
    const sayaCurve = new THREE.CatmullRomCurve3(saya, false, "centripetal");
    const mouth = sayaCurve.getPointAt(0);
    k.put(this.hips, gold, new THREE.TorusGeometry(0.017, 0.004, 5, 16).rotateX(Math.PI / 2).scale(1.05, 1, 0.68), along(mouth, mouth.clone().add(sayaCurve.getTangentAt(0)), V(0, 1, 0)));
    const tip = sayaCurve.getPointAt(1);
    k.put(this.hips, gold, ell(0.019, 0.026, 0.012), along(tip, tip.clone().add(sayaCurve.getTangentAt(1)), V(0, 1, 0)));
    k.put(this.hips, cord, sweep([V(0.165, 0.045, 0.13), V(0.205, -0.07, 0.12), V(0.23, -0.1, 0.02), V(0.22, 0.0, -0.07)], 14, 6, () => 0.0055));
    const waki = [V(0.085, 0.075, 0.2), V(0.15, 0.03, 0.0), V(0.2, -0.04, -0.3)];
    k.put(this.hips, lacquer, sweep(waki, 14, 10, ellR(0.016, 0.01), V(0, 1, 0)));
    {
      const base = V(0.08, 0.078, 0.21);
      const end = V(0.035, 0.11, 0.34);
      const m = along(base, end, V(0, 1, 0));
      const L = base.distanceTo(end);
      k.put(this.hips, ito, scaleUV(new THREE.CylinderGeometry(0.013, 0.014, L, 12).scale(1, 1, 1.25).translate(0, L / 2, 0), 1, 1.2), m);
      k.put(this.hips, iron, new THREE.CylinderGeometry(0.034, 0.034, 0.007, 20).scale(0.85, 1, 1), m);
      k.put(this.hips, gold, new THREE.CylinderGeometry(0.015, 0.013, 0.014, 12).scale(1, 1, 1.25).translate(0, L, 0), m);
    }

    // ---------- torso: riveted lacquer dō, chest and back plates, straps ----------
    this.torso.position.set(0, 0.06, 0);
    this.hips.add(this.torso);
    const doProf = [0.165, 0.18, 0.205, 0.226, 0.238, 0.24];
    const doR = (y: number) => {
      const f = THREE.MathUtils.clamp(y / 0.08, 0, doProf.length - 1.001);
      const i = Math.floor(f);
      return doProf[i] + (doProf[i + 1] - doProf[i]) * (f - i);
    };
    const rivet = new THREE.SphereGeometry(0.0045, 6, 4);
    for (let i = 0; i < 5; i++) {
      const yb = i * 0.08;
      const yt = yb + 0.088;
      const rB = doR(yb) + 0.013;
      const rT = doR(yt) - 0.002;
      k.put(this.torso, lacquer, new THREE.CylinderGeometry(rT, rB, yt - yb, 48, 1, true).translate(0, (yb + yt) / 2, 0).scale(1, 1, DO_Z));
      k.put(this.torso, gold, trim(rB, 0.0028, 0, Math.PI * 2).translate(0, yb + 0.002, 0).scale(1, 1, DO_Z));
      for (let j = 0; j < 32; j++) {
        const th = (j / 32) * Math.PI * 2;
        k.put(this.torso, gold, rivet.clone().translate(Math.sin(th) * rB, yb + 0.016, Math.cos(th) * rB * DO_Z));
      }
    }
    rivet.dispose();
    // munaita (chest plate) and oshitsuke (back plate), laced panels under the arms
    k.put(this.torso, lacquer, band(0.205, 0.244, 0.1, -0.8, 1.6).translate(0, 0.45, 0).scale(1, 1, DO_Z));
    k.put(this.torso, gold, trim(0.205, 0.0045, -0.8, 1.6).translate(0, 0.5, 0).scale(1, 1, DO_Z));
    k.put(this.torso, lacquer, band(0.2, 0.244, 0.12, Math.PI - 0.9, 1.8).translate(0, 0.46, 0).scale(1, 1, DO_Z));
    k.put(this.torso, gold, trim(0.2, 0.0045, Math.PI - 0.9, 1.8).translate(0, 0.52, 0).scale(1, 1, DO_Z));
    k.put(this.torso, lames, band(0.2, 0.236, 0.1, 0.8, Math.PI - 1.7).translate(0, 0.45, 0).scale(1, 1, DO_Z));
    k.put(this.torso, lames, band(0.2, 0.236, 0.1, Math.PI + 0.9, Math.PI - 1.7).translate(0, 0.45, 0).scale(1, 1, DO_Z));
    // padded yoke closing the top of the dō, collar cord, neck
    k.put(this.torso, glove, new THREE.CylinderGeometry(0.088, 0.215, 0.05, 36, 1, true).translate(0, 0.528, 0).scale(1, 1, DO_Z + 0.05));
    k.put(this.torso, cord, new THREE.TorusGeometry(0.086, 0.011, 6, 28).rotateX(Math.PI / 2).translate(0, 0.553, 0));
    k.put(this.torso, shade, new THREE.CylinderGeometry(0.055, 0.065, 0.12, 14).translate(0, 0.6, 0));
    // agemaki bow on the back
    k.put(this.torso, cord, ell(0.018, 0.016, 0.014).translate(0, 0.33, -0.203));
    for (const s of [-1, 1]) {
      k.put(this.torso, cord, new THREE.TorusGeometry(0.028, 0.0075, 6, 16).scale(1.3, 0.8, 1).translate(s * 0.04, 0.335, -0.205));
      k.put(this.torso, cord, sweep([V(s * 0.008, 0.32, -0.21), V(s * 0.03, 0.24, -0.216), V(s * 0.045, 0.16, -0.212)], 8, 6, () => 0.0075));
    }

    // ---------- head: kabuto, menpo, shikoro ----------
    this.head.position.set(0, 0.69, 0.0);
    this.torso.add(this.head);
    k.put(this.head, shade, ell(0.085, 0.1, 0.088, 18, 14)); // the face, lost in the visor's shadow
    const bowl = xf(0, 0.015, -0.005, 0, 0, 0, 1, 0.92, 1.08);
    k.put(this.head, lacquer, new THREE.SphereGeometry(0.135, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), bowl);
    for (let i = 0; i < 24; i++) {
      k.put(this.head, iron, new THREE.TorusGeometry(0.1362, 0.0032, 4, 18, Math.PI / 2).rotateZ(Math.PI / 2).rotateY((i / 24) * Math.PI * 2), bowl);
    }
    k.put(this.head, gold, new THREE.TorusGeometry(0.136, 0.0065, 6, 48).rotateX(Math.PI / 2), bowl);
    k.put(this.head, gold, new THREE.CylinderGeometry(0.016, 0.026, 0.022, 16).translate(0, 0.14, -0.005));
    k.put(this.head, gold, new THREE.TorusGeometry(0.02, 0.004, 5, 16).rotateX(Math.PI / 2).translate(0, 0.142, -0.005));
    // mabizashi (visor) with a gilt edge
    const visor = xf(0, 0.012, -0.005, 0, 0, 0, 1, 1, 1.08);
    k.put(this.head, lacquer, band(0.137, 0.182, 0.032, -1.3, 2.6), visor);
    k.put(this.head, gold, trim(0.182, 0.0035, -1.3, 2.6).translate(0, -0.016, 0), visor);
    // kuwagata-dai, the two sweeping kuwagata and a mon between them
    k.put(this.head, gold, plate(roundRect(0.058, 0.036, 0.01), 0.006), xf(0, 0.052, 0.128, -0.35, 0, 0));
    for (const s of [-1, 1]) {
      const h = new THREE.Shape();
      h.moveTo(s * 0.016, 0);
      h.quadraticCurveTo(s * 0.105, 0.12, s * 0.09, 0.34); // outer edge, out to the point
      h.quadraticCurveTo(s * 0.045, 0.15, -s * 0.01, 0); // inner edge, back to the root
      k.put(this.head, gold, plate(h, 0.004), xf(s * 0.02, 0.065, 0.135, -0.32, 0, 0));
    }
    k.put(this.head, gold, new THREE.CylinderGeometry(0.014, 0.014, 0.008, 24).rotateX(Math.PI / 2), xf(0, 0.054, 0.14, -0.35, 0, 0));
    // shikoro: five laced rows flaring out over the shoulders, open at the face
    for (const g of lacedRows(5, 0, 0.05, 0.14, 0.026, 0.95, Math.PI * 2 - 1.9)) k.put(this.head, lames, g, xf(0, 0, -0.01, 0, 0, 0, 1, 1, 1.06));
    // fukigaeshi: the top rows turned back beside the face, each with a gilt mon
    for (const s of [-1, 1]) {
      const th0 = s > 0 ? 0.55 : -1.2;
      const wing = xf(0, -0.03, -0.01, 0, 0, s * -0.18, 1, 1, 1.06);
      k.put(this.head, lacquer, band(0.15, 0.205, 0.075, th0, 0.65), wing);
      k.put(this.head, gold, trim(0.15, 0.0035, th0, 0.65).translate(0, 0.0375, 0), wing);
      const mid = th0 + 0.325;
      k.put(this.head, gold, new THREE.CylinderGeometry(0.012, 0.012, 0.004, 16).rotateX(Math.PI / 2).translate(0, 0, 0.181).rotateY(mid), wing);
    }
    // menpo: lacquered half-mask with a nose, a mouth slit and a white horsehair moustache
    k.put(this.head, lacquer, new THREE.SphereGeometry(0.1, 28, 14, Math.PI / 2 - 1.2, 2.4, Math.PI * 0.5, Math.PI * 0.38), xf(0, -0.032, 0.006, 0, 0, 0, 1.04, 1.12, 1.12));
    k.put(this.head, lacquer, ell(0.011, 0.024, 0.016).rotateX(0.4).translate(0, -0.038, 0.106));
    k.put(this.head, shade, new THREE.BoxGeometry(0.04, 0.009, 0.01).translate(0, -0.088, 0.1));
    k.put(this.head, gold, new THREE.BoxGeometry(0.032, 0.0035, 0.006).translate(0, -0.0905, 0.103));
    for (const s of [-1, 1]) {
      k.put(this.head, hair, sweep([V(s * 0.005, -0.064, 0.114), V(s * 0.028, -0.071, 0.109), V(s * 0.052, -0.071, 0.094), V(s * 0.068, -0.059, 0.077)], 10, 6, (t) => 0.0062 * (1 - 0.7 * t)));
      k.put(this.head, eyes, ell(0.012, 0.0036, 0.004).rotateZ(s * 0.2).translate(s * 0.032, -0.014, 0.087));
    }
    // yodare-kake: laced throat guard under the mask
    for (const g of lacedRows(2, -0.118, 0.04, 0.074, 0.012, -1.15, 2.3)) k.put(this.head, lames, g, xf(0, 0, 0.004, 0, 0, 0, 1, 1, 1.15));

    // ---------- arms: mail sleeves, splinted forearms, elbow cops, gloved fists ----------
    const a = this.upperLen;
    const b = this.foreLen;
    const arms: [THREE.Group, THREE.Group, THREE.Group, THREE.Group, number][] = [
      [this.rUpper, this.rFore, this.rHand, this.rSode, -1],
      [this.lUpper, this.lFore, this.lHand, this.lSode, 1],
    ];
    for (const [up, fore, hand, sode, s] of arms) {
      this.root.add(up, fore, hand, sode);
      // a pleated cloth sleeve, a little full at the bicep, with mail showing at the inside of the arm
      k.put(up, cloth, sweep([V(0, 0, 0), V(0, a * 0.5, 0.004), V(0, a, 0)], 10, 18, (t, ang) => (0.05 + 0.012 * Math.sin(t * Math.PI)) * (1 + 0.07 * Math.sin(6 * ang + t * 3)), V(0, 0, 1)));
      k.put(up, mail, band(0.06, 0.06, a * 0.7, Math.PI - 0.7, 1.4, 0.06).translate(0, a * 0.5, 0));
      // hiji-gane: a shallow iron cup over the point of the elbow
      k.put(up, iron, new THREE.SphereGeometry(0.04, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.32).rotateX(Math.PI / 2).translate(0, a, 0.012));

      k.put(fore, mail, scaleUV(new THREE.CylinderGeometry(0.037, 0.045, b, 14, 1, true).translate(0, b / 2, 0), 4.5, 4.8));
      for (const c of [-0.95, 0, 0.95]) k.put(fore, iron, band(0.044, 0.052, b * 0.72, c - 0.33, 0.66).translate(0, b * 0.5, 0));
      for (const c of [-0.95, 0, 0.95]) {
        for (const e of [-0.33, 0.3]) k.put(fore, gold, band(0.0445, 0.0525, b * 0.72, c + e, 0.03).translate(0, b * 0.5, 0));
      }
      k.put(fore, cord, new THREE.TorusGeometry(0.04, 0.006, 6, 20).rotateX(Math.PI / 2).translate(0, b * 0.9, 0));

      // fist around the tsuka (katana frame: +Y along the blade, +Z the edge); the
      // fingers wrap the edge side, the lacquered tekko covers the back of the hand
      const hy = s < 0 ? -0.03 : -0.02;
      k.put(hand, glove, ell(0.045, 0.05, 0.046, 14, 10).translate(0, hy, -0.012));
      for (let f = 0; f < 4; f++) k.put(hand, glove, trim(0.026, 0.0105, -0.625 * Math.PI, 1.25 * Math.PI).translate(0, hy - 0.033 + f * 0.022, 0.002));
      k.put(hand, lacquer, band(0.05, 0.052, 0.07, Math.PI - 0.8, 1.6).translate(0, hy, -0.008));
      k.put(hand, gold, trim(0.05, 0.0025, Math.PI - 0.8, 1.6).translate(0, hy + 0.035, -0.008));

      // sode: a lacquered top plate and six laced rows hanging from the shoulder
      const c = (s * Math.PI) / 2;
      k.put(sode, lacquer, band(0.124, 0.132, 0.034, c - 0.85, 1.7).translate(0, -0.012, 0));
      k.put(sode, gold, trim(0.124, 0.004, c - 0.85, 1.7).translate(0, 0.005, 0));
      for (const g of lacedRows(6, -0.025, 0.056, 0.13, 0.008, c - 0.82, 1.64)) k.put(sode, lames, g);
    }

    // ---------- katana ----------
    this.buildKatana(k, gold, iron, ito);
    this.root.add(this.katana);

    k.build((g) => this.geos.push(g));

    // slight contrapposto stance
    this.root.rotation.order = "YXZ";
  }

  private mat<T extends THREE.Material>(m: T): T {
    m.transparent = true;
    // Double-sided transparent materials otherwise draw twice (back, then front).
    m.forceSinglePass = true;
    this.materials.push(m);
    return m;
  }

  private buildKatana(k: Kit, gold: THREE.Material, iron: THREE.Material, ito: THREE.Material) {
    const kt = this.katana;
    // tsuka: oval, wrapped in black ito over white same, with gilt fuchi, kashira and menuki
    k.put(kt, ito, scaleUV(new THREE.CylinderGeometry(0.0155, 0.0165, 0.25, 14).scale(1, 1, 1.25).translate(0, -0.115, 0), 1, 2));
    k.put(kt, gold, new THREE.CylinderGeometry(0.018, 0.018, 0.014, 16).scale(1, 1, 1.25).translate(0, 0.012, 0));
    k.put(kt, gold, new THREE.CylinderGeometry(0.0175, 0.0155, 0.018, 16).scale(1, 1, 1.25).translate(0, -0.248, 0));
    for (const s of [-1, 1]) k.put(kt, gold, ell(0.004, 0.018, 0.007).translate(s * 0.016, -0.1, 0));
    // tsuba with a gilt rim, seppa either side, habaki
    k.put(kt, iron, new THREE.CylinderGeometry(0.046, 0.046, 0.008, 28).scale(0.85, 1, 1).translate(0, 0.03, 0));
    k.put(kt, gold, trim(0.046, 0.0028, 0, Math.PI * 2).scale(0.85, 1, 1).translate(0, 0.03, 0));
    for (const y of [0.023, 0.037]) k.put(kt, gold, new THREE.CylinderGeometry(0.02, 0.02, 0.004, 16).scale(1, 1, 1.25).translate(0, y, 0));
    k.put(kt, gold, new THREE.BoxGeometry(0.012, 0.03, 0.036).translate(0, 0.052, 0));

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
    k.put(kt, this.bladeMat, bladeGeo.translate(0, 0.065, 0));
  }

  /** Two-bone IK: places the upper arm and forearm so the hand reaches `target`, elbow toward `pole`. */
  private solveArm(shoulder: THREE.Vector3, target: THREE.Vector3, pole: THREE.Vector3, upper: THREE.Object3D, fore: THREE.Object3D) {
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
      .add(perp.clone().multiplyScalar(Math.sin(angA) * a));
    const hand = shoulder.clone().add(dir.clone().multiplyScalar(d));
    const place = (o: THREE.Object3D, p: THREE.Vector3, q: THREE.Vector3) => {
      o.position.copy(p);
      o.quaternion.setFromRotationMatrix(along(p, q, perp));
    };
    place(upper, shoulder, elbow);
    place(fore, elbow, hand);
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
    this.solveArm(rShoulder, g.pos, rPole, this.rUpper, this.rFore);
    this.solveArm(lShoulder, lTarget, lPole, this.lUpper, this.lFore);
    this.rHand.position.copy(g.pos);
    this.rHand.quaternion.copy(q);
    this.lHand.position.copy(lTarget);
    this.lHand.quaternion.copy(q);

    // sode hang between gravity and upper arm direction
    const orientSode = (s: THREE.Group, sh: THREE.Vector3, upper: THREE.Object3D) => {
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
