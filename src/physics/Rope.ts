/**
 * Particle-based rope state. Positions/velocities live in flat Float32Arrays
 * (x,y,z interleaved) so the hot loop performs no allocations.
 */
export class Rope {
  readonly count: number;
  readonly length: number;
  readonly segmentLength: number;
  readonly mass: number;

  positions: Float32Array;
  prevPositions: Float32Array;
  velocities: Float32Array;
  /** 0 for pinned endpoints, 1/m for free particles. */
  invMass: Float32Array;

  constructor(count: number, length: number, mass: number) {
    this.count = count;
    this.length = length;
    this.mass = mass;
    this.segmentLength = length / (count - 1);

    this.positions = new Float32Array(count * 3);
    this.prevPositions = new Float32Array(count * 3);
    this.velocities = new Float32Array(count * 3);
    this.invMass = new Float32Array(count);

    const m = mass / count;
    for (let i = 0; i < count; i++) this.invMass[i] = 1 / m;
    this.invMass[0] = 0;
    this.invMass[count - 1] = 0;
  }

  /**
   * Lay the rope between two endpoints with a catenary-like sag (sine shape)
   * whose arc length matches the rope length. This avoids an initial
   * constraint-violation snap when the rope is longer than the handle gap.
   */
  layout(
    ax: number, ay: number, az: number,
    bx: number, by: number, bz: number,
  ): void {
    const n = this.count;
    const gap = Math.hypot(bx - ax, by - ay, bz - az);
    const L = this.length;

    // Find sag so that arc length of (straight + sag*sin(pi t)) == L.
    let sag = 0;
    if (L > gap + 1e-9) {
      const arcLen = (s: number) => {
        // Numerically integrate the sagging curve length.
        const M = 256;
        let acc = 0;
        let px = ax, py = ay, pz = az;
        for (let k = 1; k <= M; k++) {
          const t = k / M;
          const droop = s * Math.sin(Math.PI * t);
          const x = ax + (bx - ax) * t;
          const y = ay + (by - ay) * t - droop;
          const z = az + (bz - az) * t;
          acc += Math.hypot(x - px, y - py, z - pz);
          px = x; py = y; pz = z;
        }
        return acc;
      };
      let lo = 0, hi = L; // sag can't exceed hanging fully folded
      for (let it = 0; it < 48; it++) {
        const mid = 0.5 * (lo + hi);
        if (arcLen(mid) < L) lo = mid; else hi = mid;
      }
      sag = 0.5 * (lo + hi);
    }

    // Walk along the curve placing particles exactly segmentLength apart.
    // `acc` tracks arc length up to the cursor (px,py,pz); `target` is the
    // arc-length position the next particle must sit at.
    const M = 2048;
    let target = this.segmentLength;
    let acc = 0;
    let px = ax, py = ay, pz = az;
    this.positions[0] = ax; this.positions[1] = ay; this.positions[2] = az;
    let idx = 1;
    for (let k = 1; k <= M && idx < n - 1; k++) {
      const t = k / M;
      const droop = sag * Math.sin(Math.PI * t);
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t - droop;
      const z = az + (bz - az) * t;
      let remaining = Math.hypot(x - px, y - py, z - pz);
      while (idx < n - 1 && acc + remaining >= target) {
        const need = target - acc;
        const f = need / remaining;
        const ix = px + (x - px) * f;
        const iy = py + (y - py) * f;
        const iz = pz + (z - pz) * f;
        const i3 = idx * 3;
        this.positions[i3] = ix;
        this.positions[i3 + 1] = iy;
        this.positions[i3 + 2] = iz;
        idx++;
        acc = target;
        target += this.segmentLength;
        px = ix; py = iy; pz = iz;
        remaining = Math.hypot(x - px, y - py, z - pz);
      }
      acc += remaining;
      px = x; py = y; pz = z;
    }
    // Fill any stragglers (rounding) by straight lerp toward the end.
    while (idx < n - 1) {
      const i3 = idx * 3;
      const t = idx / (n - 1);
      this.positions[i3] = ax + (bx - ax) * t;
      this.positions[i3 + 1] = ay + (by - ay) * t - sag * Math.sin(Math.PI * t);
      this.positions[i3 + 2] = az + (bz - az) * t;
      idx++;
    }
    const e3 = (n - 1) * 3;
    this.positions[e3] = bx; this.positions[e3 + 1] = by; this.positions[e3 + 2] = bz;

    this.prevPositions.set(this.positions);
    this.velocities.fill(0);
  }
}
