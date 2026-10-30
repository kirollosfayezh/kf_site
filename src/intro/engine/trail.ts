import * as THREE from "three";

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
