import { dampFactor } from "../utils/math";

const MAX_MODES = 8;

/**
 * Decomposes the rope's transverse motion into spatial modes
 * sin(n*pi*i/(N-1)) for n = 1..maxMode.
 *
 * The displacement is measured in a 2D basis perpendicular to the line
 * between the two endpoints, so both Y and Z motion (i.e. rotation of the
 * rope) contribute. A slow per-particle running mean is subtracted first,
 * which removes static sag and the steady rotating offset — the projection
 * then describes the *modal* motion rather than the resting shape.
 *
 * The modal amplitude â_n combines the two transverse axes:
 *   â_n = (2/(N-1)) * sqrt( (Σ u1_i s_i)^2 + (Σ u2_i s_i)^2 )
 * which is invariant to rotation of the pattern in the transverse plane.
 */
export class ModeAnalyzer {
  maxMode = MAX_MODES;

  /** Smoothed modal amplitudes (1-indexed, metres). */
  readonly amplitudes = new Float64Array(MAX_MODES + 1);
  /** Instantaneous (unsmoothed) modal amplitudes. */
  readonly instant = new Float64Array(MAX_MODES + 1);
  /** Energy-normalised purity per mode: â_n^2 / Σ â_k^2. */
  readonly purities = new Float64Array(MAX_MODES + 1);
  dominant = 0;
  /** RMS of |fluctuation| across particles (m). */
  rms = 0;

  /** Per-particle magnitude of the fluctuation (for node detection). */
  fluctMag: Float64Array;

  private meanU1: Float64Array;
  private meanU2: Float64Array;
  private count: number;
  /** sin(m*pi*i/(N-1)) lookup, layout [i*(MAX+1) + m], rebuilt on resize. */
  private sinTable: Float64Array;
  private acc1 = new Float64Array(MAX_MODES + 1);
  private acc2 = new Float64Array(MAX_MODES + 1);

  constructor(count: number) {
    this.count = count;
    this.meanU1 = new Float64Array(count);
    this.meanU2 = new Float64Array(count);
    this.fluctMag = new Float64Array(count);
    this.sinTable = this.buildSinTable(count);
  }

  private buildSinTable(count: number): Float64Array {
    const t = new Float64Array(count * (MAX_MODES + 1));
    for (let i = 0; i < count; i++) {
      const arg = i / (count - 1);
      for (let m = 1; m <= MAX_MODES; m++) {
        t[i * (MAX_MODES + 1) + m] = Math.sin(m * Math.PI * arg);
      }
    }
    return t;
  }

  resize(count: number): void {
    this.count = count;
    this.meanU1 = new Float64Array(count);
    this.meanU2 = new Float64Array(count);
    this.fluctMag = new Float64Array(count);
    this.sinTable = this.buildSinTable(count);
    this.reset();
  }

  reset(): void {
    this.meanU1.fill(0);
    this.meanU2.fill(0);
    this.fluctMag.fill(0);
    this.amplitudes.fill(0);
    this.instant.fill(0);
    this.purities.fill(0);
    this.dominant = 0;
    this.rms = 0;
  }

  /**
   * @param positions rope positions (xyz interleaved)
   * @param dt        analysis update interval (frame dt)
   * @param maxMode   highest mode number to project (1..MAX_MODES)
   */
  update(positions: Float32Array, dt: number, maxMode = MAX_MODES): void {
    const mm = Math.min(Math.max(1, Math.round(maxMode)), MAX_MODES);
    const n = this.count;
    const p = positions;
    const e3 = (n - 1) * 3;

    // Baseline between the (moving) endpoints.
    const ax = p[0], ay = p[1], az = p[2];
    const bx = p[e3], by = p[e3 + 1], bz = p[e3 + 2];
    let ex = bx - ax, ey = by - ay, ez = bz - az;
    const el = Math.hypot(ex, ey, ez) || 1;
    ex /= el; ey /= el; ez /= el;

    // Transverse 2D basis perpendicular to the baseline.
    // e1 = normalize(e x tmp); e2 = e x e1.
    const useY = Math.abs(ey) < 0.9;
    const tx = useY ? 0 : 0, ty = useY ? 1 : 0, tz = useY ? 0 : 1;
    let e1x = ey * tz - ez * ty;
    let e1y = ez * tx - ex * tz;
    let e1z = ex * ty - ey * tx;
    const n1 = Math.hypot(e1x, e1y, e1z) || 1;
    e1x /= n1; e1y /= n1; e1z /= n1;
    const e2x = ey * e1z - ez * e1y;
    const e2y = ez * e1x - ex * e1z;
    const e2z = ex * e1y - ey * e1x;

    const meanK = dampFactor(dt, 2.5);
    const ampK = dampFactor(dt, 0.6);

    // Per-particle transverse displacement -> fluctuation.
    const acc1 = this.acc1, acc2 = this.acc2;
    acc1.fill(0);
    acc2.fill(0);
    const sinTable = this.sinTable;
    let rmsAcc = 0;

    for (let i = 1; i < n - 1; i++) {
      const i3 = i * 3;
      const t = i / (n - 1);
      // Point on baseline.
      const cx = ax + (bx - ax) * t;
      const cy = ay + (by - ay) * t;
      const cz = az + (bz - az) * t;
      // Displacement minus its component along the baseline.
      let dx = p[i3] - cx, dy = p[i3 + 1] - cy, dz = p[i3 + 2] - cz;
      const along = dx * ex + dy * ey + dz * ez;
      dx -= along * ex; dy -= along * ey; dz -= along * ez;
      const u1 = dx * e1x + dy * e1y + dz * e1z;
      const u2 = dx * e2x + dy * e2y + dz * e2z;

      // Remove slowly-varying mean (sag, steady rotation offset).
      this.meanU1[i] += (u1 - this.meanU1[i]) * meanK;
      this.meanU2[i] += (u2 - this.meanU2[i]) * meanK;
      const f1 = u1 - this.meanU1[i];
      const f2 = u2 - this.meanU2[i];
      const mag = Math.hypot(f1, f2);
      this.fluctMag[i] = mag;
      rmsAcc += mag * mag;

      // Project onto each sine mode (table lookup — no Math.sin here).
      const row = i * (MAX_MODES + 1);
      for (let m = 1; m <= mm; m++) {
        const s = sinTable[row + m];
        acc1[m] += f1 * s;
        acc2[m] += f2 * s;
      }
    }
    this.fluctMag[0] = 0;
    this.fluctMag[n - 1] = 0;
    this.rms = Math.sqrt(rmsAcc / Math.max(1, n - 2));

    const norm = 2 / (n - 1);
    let sumSq = 0;
    for (let m = 1; m <= mm; m++) {
      const a = norm * Math.hypot(acc1[m], acc2[m]);
      this.instant[m] = a;
      this.amplitudes[m] += (a - this.amplitudes[m]) * ampK;
      sumSq += a * a;
    }
    let best = 0, bestA = 0;
    for (let m = 1; m <= mm; m++) {
      this.purities[m] = sumSq > 1e-12 ? (this.instant[m] ** 2) / sumSq : 0;
      if (this.amplitudes[m] > bestA) {
        bestA = this.amplitudes[m];
        best = m;
      }
    }
    // Require a minimal amplitude before claiming a mode — otherwise the
    // label would flap around while the rope hangs nearly still.
    this.dominant = bestA > 0.02 ? best : 0;
  }
}
