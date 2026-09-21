import * as THREE from "three";

/**
 * Renders the particle rope as a smooth tube. A single BufferGeometry is
 * preallocated and updated in place each frame using parallel-transport
 * frames — no per-frame allocation, one draw call.
 */
export class RopeRenderer {
  readonly mesh: THREE.Mesh;
  private readonly radial = 8;
  private count: number;
  private radius: number;
  private posAttr: THREE.BufferAttribute;
  private nrmAttr: THREE.BufferAttribute;
  private readonly normal = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private readonly binormal = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();

  constructor(count: number, radius: number) {
    this.count = count;
    this.radius = radius;
    const geo = this.buildGeometry(count);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffa14d,
      roughness: 0.55,
      metalness: 0.05,
      emissive: 0x201005,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    this.nrmAttr = geo.getAttribute("normal") as THREE.BufferAttribute;
  }

  private buildGeometry(count: number): THREE.BufferGeometry {
    const radial = this.radial;
    const verts = count * radial;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(verts * 3), 3),
    );
    geo.setAttribute(
      "normal",
      new THREE.BufferAttribute(new Float32Array(verts * 3), 3),
    );
    const idx: number[] = [];
    for (let i = 0; i < count - 1; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * radial + j;
        const b = i * radial + ((j + 1) % radial);
        const c = (i + 1) * radial + j;
        const d = (i + 1) * radial + ((j + 1) % radial);
        idx.push(a, c, b, b, c, d);
      }
    }
    geo.setIndex(idx);
    return geo;
  }

  setRadius(r: number): void {
    this.radius = r;
  }

  /** Rebuild buffers when the particle count changes. */
  rebuild(count: number, radius: number): void {
    this.count = count;
    this.radius = radius;
    this.mesh.geometry.dispose();
    const geo = this.buildGeometry(count);
    this.mesh.geometry = geo;
    this.posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    this.nrmAttr = geo.getAttribute("normal") as THREE.BufferAttribute;
  }

  update(p: Float32Array): void {
    const n = this.count;
    const radial = this.radial;
    const posArr = this.posAttr.array as Float32Array;
    const nrmArr = this.nrmAttr.array as Float32Array;
    const r = this.radius;

    // Seed frame: pick a normal perpendicular to the first tangent.
    this.tangent.set(p[3] - p[0], p[4] - p[1], p[5] - p[2]).normalize();
    this.normal.set(0, 1, 0);
    if (Math.abs(this.tangent.y) > 0.9) this.normal.set(0, 0, 1);
    this.normal
      .addScaledVector(this.tangent, -this.normal.dot(this.tangent))
      .normalize();

    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const prev = Math.max(0, i - 1) * 3;
      const next = Math.min(n - 1, i + 1) * 3;
      this.tangent
        .set(p[next] - p[prev], p[next + 1] - p[prev + 1], p[next + 2] - p[prev + 2])
        .normalize();
      // Parallel transport: remove tangential component, renormalise.
      const d = this.normal.dot(this.tangent);
      this.tmp.copy(this.normal).addScaledVector(this.tangent, -d);
      const l = this.tmp.length();
      if (l > 1e-6) {
        this.normal.copy(this.tmp).divideScalar(l);
      } else {
        // Degenerate: rebuild from any perpendicular.
        this.normal.set(0, 1, 0);
        if (Math.abs(this.tangent.y) > 0.9) this.normal.set(0, 0, 1);
        this.normal
          .addScaledVector(this.tangent, -this.normal.dot(this.tangent))
          .normalize();
      }
      this.binormal.crossVectors(this.tangent, this.normal);

      const ringBase = i * radial * 3;
      for (let j = 0; j < radial; j++) {
        const a = (j / radial) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const nx = this.normal.x * ca + this.binormal.x * sa;
        const ny = this.normal.y * ca + this.binormal.y * sa;
        const nz = this.normal.z * ca + this.binormal.z * sa;
        const vi = ringBase + j * 3;
        posArr[vi] = p[i3] + nx * r;
        posArr[vi + 1] = p[i3 + 1] + ny * r;
        posArr[vi + 2] = p[i3 + 2] + nz * r;
        nrmArr[vi] = nx;
        nrmArr[vi + 1] = ny;
        nrmArr[vi + 2] = nz;
      }
    }
    this.posAttr.needsUpdate = true;
    this.nrmAttr.needsUpdate = true;
  }
}
