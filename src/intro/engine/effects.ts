import * as THREE from "three";
import { mulberry32 } from "./textures";

/* ------------------------------------------------------------------ */
/* Sword trail: two additive ribbons sampled analytically on the arc   */
/* ------------------------------------------------------------------ */
export class SwordTrail {
  mesh: THREE.Mesh;
  glow: THREE.Mesh;
  private K = 32;
  private pos: THREE.BufferAttribute;
  private gpos: THREE.BufferAttribute;
  mat: THREE.ShaderMaterial;
  gmat: THREE.ShaderMaterial;

  constructor() {
    const K = this.K;
    const mk = () => {
      const p = new Float32Array((K + 1) * 2 * 3);
      const a = new Float32Array((K + 1) * 2 * 2);
      const idx: number[] = [];
      for (let i = 0; i <= K; i++) {
        a.set([i / K, 0, i / K, 1], i * 4);
        if (i < K) {
          const b = i * 2;
          idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        }
      }
      const g = new THREE.BufferGeometry();
      const attr = new THREE.BufferAttribute(p, 3);
      attr.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute("position", attr);
      g.setAttribute("ab", new THREE.BufferAttribute(a, 2));
      g.setIndex(idx);
      return { g, attr };
    };
    const shader = (core: boolean) =>
      new THREE.ShaderMaterial({
        uniforms: { uI: { value: 0 } },
        vertexShader: `attribute vec2 ab; varying vec2 vAB; void main(){ vAB=ab; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `uniform float uI; varying vec2 vAB;
          void main(){
            float along = pow(vAB.x, ${core ? "3.0" : "2.0"});
            float across = smoothstep(0.0, 1.0, vAB.y) * (1.0 - smoothstep(0.9, 1.0, vAB.y));
            vec3 hot = vec3(1.0, 0.97, 0.92);
            vec3 cold = vec3(0.45, 0.72, 1.0);
            vec3 col = mix(cold, hot, ${core ? "vAB.y" : "0.25"});
            float a = along * across * uI * ${core ? "1.0" : "0.16"};
            gl_FragColor = vec4(col * a, a);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
    const a = mk();
    const b = mk();
    this.pos = a.attr;
    this.gpos = b.attr;
    this.mat = shader(true);
    this.gmat = shader(false);
    this.mesh = new THREE.Mesh(a.g, this.mat);
    this.glow = new THREE.Mesh(b.g, this.gmat);
    this.mesh.frustumCulled = false;
    this.glow.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.glow.renderOrder = 9;
  }

  /** sampler(u) → world {base, tip}; u in [from, to]. */
  update(from: number, to: number, sampler: (u: number) => { base: THREE.Vector3; tip: THREE.Vector3 }, intensity: number) {
    const K = this.K;
    const p = this.pos.array as Float32Array;
    const g = this.gpos.array as Float32Array;
    for (let i = 0; i <= K; i++) {
      const u = THREE.MathUtils.lerp(from, to, i / K);
      const { base, tip } = sampler(u);
      // thin crescent hugging the tip path, with a softer halo just around it
      const near = base.clone().lerp(tip, 0.84);
      p.set([near.x, near.y, near.z, tip.x, tip.y, tip.z], i * 6);
      const mid = base.clone().lerp(tip, 0.74);
      const far = base.clone().lerp(tip, 1.03);
      g.set([mid.x, mid.y, mid.z, far.x, far.y, far.z], i * 6);
    }
    this.pos.needsUpdate = true;
    this.gpos.needsUpdate = true;
    this.mat.uniforms.uI.value = intensity;
    this.gmat.uniforms.uI.value = intensity;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.glow.geometry.dispose();
    this.mat.dispose();
    this.gmat.dispose();
  }
}

/* ------------------------------------------------------------------ */
/* Ignition line racing along the cut on the paper                     */
/* ------------------------------------------------------------------ */
export class CutGlow {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  constructor(W: number, cut: (x: number) => number, contactX: number) {
    const N = 200;
    const p = new Float32Array((N + 1) * 2 * 3);
    const uv = new Float32Array((N + 1) * 2 * 2);
    const idx: number[] = [];
    const h = 0.06;
    for (let i = 0; i <= N; i++) {
      const x = -W / 2 + (W * i) / N;
      const y = cut(x);
      p.set([x, y - h, 0.012, x, y + h, 0.012], i * 6);
      uv.set([x, 0, x, 1], i * 4);
      if (i < N) {
        const b = i * 2;
        idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uP: { value: 0 }, uI: { value: 0 }, uC: { value: contactX }, uW: { value: W } },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform float uP; uniform float uI; uniform float uC; uniform float uW; varying vec2 vUv;
        void main(){
          float d = abs(vUv.x - uC);
          float reach = uP * uW;
          float on = 1.0 - smoothstep(reach - 0.4, reach, d);
          float front = exp(-pow((d - reach) * 3.0, 2.0)) * step(0.001, uP) * (1.0 - uP * 0.6);
          float y = abs(vUv.y - 0.5) * 2.0;
          float core = exp(-y * y * 90.0);
          float halo = exp(-y * y * 12.0) * 0.18;
          vec3 hot = vec3(1.0, 0.96, 0.88);
          vec3 ember = vec3(1.0, 0.45, 0.12);
          vec3 col = mix(ember, hot, core);
          float a = (core + halo) * on * uI + front * (core + halo) * 0.8;
          gl_FragColor = vec4(col * a, a);
        }`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.renderOrder = 8;
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

/* ------------------------------------------------------------------ */
/* Particle systems                                                     */
/* ------------------------------------------------------------------ */
const pointsVS = `
  attribute float aSize; attribute float aAlpha; attribute vec3 aColor;
  varying float vA; varying vec3 vC;
  uniform float uScale;
  void main(){
    vA = aAlpha; vC = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const pointsFS = `
  uniform sampler2D uMap; uniform float uI; varying float vA; varying vec3 vC;
  void main(){
    vec4 t = texture2D(uMap, gl_PointCoord);
    float a = t.a * vA * uI;
    gl_FragColor = vec4(vC * a, a);
  }`;

function pointsMaterial(map: THREE.Texture) {
  return new THREE.ShaderMaterial({
    uniforms: { uMap: { value: map }, uI: { value: 1 }, uScale: { value: 300 } },
    vertexShader: pointsVS,
    fragmentShader: pointsFS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

export class Dust {
  points: THREE.Points;
  mat: THREE.ShaderMaterial;
  private base: Float32Array;
  private pos: THREE.BufferAttribute;
  private n: number;
  constructor(n: number, map: THREE.Texture, bounds: THREE.Vector3) {
    this.n = n;
    const r = mulberry32(11);
    const p = new Float32Array(n * 3);
    this.base = new Float32Array(n * 4);
    const size = new Float32Array(n);
    const alpha = new Float32Array(n);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = (r() - 0.5) * bounds.x;
      const y = (r() - 0.5) * bounds.y;
      const z = 0.4 + r() * bounds.z;
      this.base.set([x, y, z, r() * 100], i * 4);
      p.set([x, y, z], i * 3);
      size[i] = 1 + r() * 2.5 + (r() > 0.95 ? 9 : 0); // a few large out-of-focus motes
      alpha[i] = size[i] > 8 ? 0.05 : 0.12 + r() * 0.3;
      col.set([1, 0.86 + r() * 0.1, 0.7 + r() * 0.15], i * 3);
    }
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(p, 3);
    g.setAttribute("position", this.pos);
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    this.mat = pointsMaterial(map);
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
  }
  update(t: number, wind: number) {
    const p = this.pos.array as Float32Array;
    for (let i = 0; i < this.n; i++) {
      const bx = this.base[i * 4];
      const by = this.base[i * 4 + 1];
      const bz = this.base[i * 4 + 2];
      const ph = this.base[i * 4 + 3];
      p[i * 3] = bx + Math.sin(t * 0.13 + ph) * 0.35 + wind * (1 + (ph % 1)) * 2.5;
      p[i * 3 + 1] = by + Math.sin(t * 0.1 + ph * 1.3) * 0.25 + ((t * 0.04 + ph) % 1) * 0.3;
      p[i * 3 + 2] = bz + Math.cos(t * 0.11 + ph) * 0.2;
    }
    this.pos.needsUpdate = true;
  }
  dispose() {
    this.points.geometry.dispose();
    this.mat.dispose();
  }
}

export class Sparks {
  points: THREE.Points;
  mat: THREE.ShaderMaterial;
  private n: number;
  private pos: THREE.BufferAttribute;
  private alpha: THREE.BufferAttribute;
  private vel: Float32Array;
  private life: Float32Array; // delay, age, maxLife
  active = false;
  constructor(n: number, map: THREE.Texture) {
    this.n = n;
    const g = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    this.alpha = new THREE.BufferAttribute(new Float32Array(n), 1);
    const size = new Float32Array(n);
    const col = new Float32Array(n * 3);
    const r = mulberry32(5);
    for (let i = 0; i < n; i++) {
      size[i] = 1.5 + r() * 3.5;
      const hot = r();
      col.set([1, 0.55 + hot * 0.4, 0.2 + hot * 0.6], i * 3);
    }
    g.setAttribute("position", this.pos);
    g.setAttribute("aAlpha", this.alpha);
    g.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    g.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    this.vel = new Float32Array(n * 3);
    this.life = new Float32Array(n * 3);
    this.mat = pointsMaterial(map);
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
  }
  /** Emit along the cut: points distributed on x with ignition delay by distance from contact. */
  emit(W: number, cut: (x: number) => number, contactX: number, sweep: number, toWorld: (v: THREE.Vector3) => THREE.Vector3) {
    const r = mulberry32(99);
    const p = this.pos.array as Float32Array;
    for (let i = 0; i < this.n; i++) {
      const x = (r() - 0.5) * W * 0.98;
      const v = toWorld(new THREE.Vector3(x, cut(x), 0.05));
      p.set([v.x, v.y, v.z], i * 3);
      const dirX = Math.sign(x - contactX) || 1;
      this.vel.set([dirX * (0.3 + r() * 1.8), (r() - 0.3) * 2.6, 0.6 + r() * 3.2], i * 3);
      this.life.set([(Math.abs(x - contactX) / W) * sweep, 0, 0.5 + r() * 0.9], i * 3);
    }
    this.pos.needsUpdate = true;
    this.active = true;
  }
  update(dt: number) {
    if (!this.active) return;
    const p = this.pos.array as Float32Array;
    const a = this.alpha.array as Float32Array;
    for (let i = 0; i < this.n; i++) {
      const L = this.life;
      if (L[i * 3] > 0) {
        L[i * 3] -= dt;
        a[i] = 0;
        continue;
      }
      L[i * 3 + 1] += dt;
      const k = L[i * 3 + 1] / L[i * 3 + 2];
      a[i] = k < 1 ? Math.pow(1 - k, 1.6) : 0;
      this.vel[i * 3 + 1] -= 4.5 * dt;
      p[i * 3] += this.vel[i * 3] * dt;
      p[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      p[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    this.pos.needsUpdate = true;
    this.alpha.needsUpdate = true;
  }
  dispose() {
    this.points.geometry.dispose();
    this.mat.dispose();
  }
}

/** Small torn paper fragments released by the cut. */
export class Shreds {
  mesh: THREE.InstancedMesh;
  private n: number;
  private state: Float32Array; // pos3, vel3, rot3, angvel3, delay
  private dummy = new THREE.Object3D();
  active = false;
  constructor(n: number, mat: THREE.Material) {
    this.n = n;
    const g = new THREE.PlaneGeometry(0.07, 0.035);
    this.mesh = new THREE.InstancedMesh(g, mat, n);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.state = new Float32Array(n * 13);
  }
  emit(W: number, cut: (x: number) => number, contactX: number, sweep: number, toWorld: (v: THREE.Vector3) => THREE.Vector3) {
    const r = mulberry32(42);
    for (let i = 0; i < this.n; i++) {
      const x = (r() - 0.5) * W * 0.95;
      const v = toWorld(new THREE.Vector3(x, cut(x), 0.03));
      const s = this.state;
      const o = i * 13;
      s.set([v.x, v.y, v.z, (r() - 0.5) * 1.2, 0.6 + r() * 1.2, 0.8 + r() * 2.4, r() * 6, r() * 6, r() * 6, (r() - 0.5) * 14, (r() - 0.5) * 14, (r() - 0.5) * 14, (Math.abs(x - contactX) / W) * sweep], o);
    }
    this.active = true;
    this.mesh.visible = true;
  }
  update(dt: number) {
    if (!this.active) return;
    const s = this.state;
    for (let i = 0; i < this.n; i++) {
      const o = i * 13;
      if (s[o + 12] > 0) {
        s[o + 12] -= dt;
        this.dummy.scale.setScalar(0.0001);
      } else {
        s[o + 4] -= 1.6 * dt; // light paper: low effective gravity
        for (let k = 0; k < 3; k++) {
          s[o + 3 + k] *= Math.pow(0.4, dt);
          s[o + k] += s[o + 3 + k] * dt;
          s[o + 6 + k] += s[o + 9 + k] * dt;
        }
        this.dummy.scale.setScalar(1);
      }
      this.dummy.position.set(s[o], s[o + 1], s[o + 2]);
      this.dummy.rotation.set(s[o + 6], s[o + 7], s[o + 8]);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}

export class Smoke {
  group = new THREE.Group();
  private sprites: THREE.Sprite[] = [];
  mat: THREE.SpriteMaterial[] = [];
  private seeds: number[] = [];
  constructor(n: number, map: THREE.Texture, center: THREE.Vector3, spread: number) {
    const r = mulberry32(8);
    for (let i = 0; i < n; i++) {
      const m = new THREE.SpriteMaterial({ map, color: 0x6a6f7a, transparent: true, opacity: 0, depthWrite: false });
      const s = new THREE.Sprite(m);
      const sc = 1.4 + r() * 1.8;
      s.scale.set(sc * 1.6, sc, 1);
      s.position.set(center.x + (r() - 0.5) * spread, center.y + r() * 0.5, center.z + (r() - 0.5) * 1.6);
      s.material.rotation = r() * Math.PI;
      this.group.add(s);
      this.sprites.push(s);
      this.mat.push(m);
      this.seeds.push(r() * 10);
    }
  }
  update(t: number, level: number) {
    this.sprites.forEach((s, i) => {
      const k = this.seeds[i];
      s.position.x += Math.sin(t * 0.2 + k) * 0.0015;
      s.material.rotation += 0.0008 * (i % 2 ? 1 : -1);
      s.material.opacity = level * (0.16 + 0.08 * Math.sin(t * 0.5 + k));
    });
  }
  dispose() {
    this.mat.forEach((m) => m.dispose());
  }
}
