import { dampFactor } from "../utils/math";

/**
 * Detects standing-wave nodes/antinodes from the time-averaged transverse
 * amplitude envelope. A node is NOT the instantaneous zero crossing — it is
 * a particle whose mean squared displacement stays small over time while
 * its neighbours move.
 */
export class NodeDetector {
  /** Smoothed amplitude envelope sqrt(E[|u|^2]) per particle. */
  env: Float64Array;
  /** Particle indices of detected interior nodes. */
  nodes: number[] = [];
  /** Particle indices of detected antinodes. */
  antinodes: number[] = [];
  /** Estimated loop count = internalNodes + 1 (0 if no clear signal). */
  loops = 0;

  private work: Float64Array;
  private count: number;
  private updateTimer = 0;
  private readonly interval = 0.25; // s between envelope re-evaluations

  constructor(count: number) {
    this.count = count;
    this.env = new Float64Array(count);
    this.work = new Float64Array(count);
  }

  resize(count: number): void {
    this.count = count;
    this.env = new Float64Array(count);
    this.work = new Float64Array(count);
    this.reset();
  }

  reset(): void {
    this.env.fill(0);
    this.nodes = [];
    this.antinodes = [];
    this.loops = 0;
    this.updateTimer = 0;
  }

  /**
   * @param fluctMag  per-particle fluctuation magnitude (ModeAnalyzer.fluctMag)
   * @param threshold node envelope threshold as fraction of max
   */
  update(fluctMag: Float64Array, dt: number, threshold: number): void {
    const n = this.count;
    const k = dampFactor(dt, 2.0);
    for (let i = 0; i < n; i++) {
      const m2 = fluctMag[i] * fluctMag[i];
      this.env[i] += (m2 - this.env[i]) * k;
    }

    this.updateTimer += dt;
    if (this.updateTimer < this.interval) return;
    this.updateTimer = 0;

    // sqrt -> amplitude envelope, then light spatial smoothing (x2).
    const e = this.env, w = this.work;
    for (let i = 0; i < n; i++) w[i] = Math.sqrt(e[i]);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 1; i < n - 1; i++) {
        w[i] = 0.25 * w[i - 1] + 0.5 * w[i] + 0.25 * w[i + 1];
      }
    }

    let maxE = 0;
    for (let i = 1; i < n - 1; i++) if (w[i] > maxE) maxE = w[i];
    if (maxE < 1e-4) {
      this.nodes = [];
      this.antinodes = [];
      this.loops = 0;
      return;
    }

    // Interior local minima (over a +-2 window) below threshold.
    const thresh = threshold * maxE;
    const minima: number[] = [];
    for (let i = 2; i < n - 2; i++) {
      if (w[i] >= thresh) continue;
      if (
        w[i] <= w[i - 1] && w[i] <= w[i + 1] &&
        w[i] <= w[i - 2] && w[i] <= w[i + 2] &&
        (w[i] < w[i - 1] || w[i] < w[i + 1] || w[i] < w[i - 2] || w[i] < w[i + 2])
      ) {
        // Merge with previous minimum if too close (plateau).
        const prev = minima[minima.length - 1];
        if (prev !== undefined && i - prev <= 3) {
          if (w[i] < w[prev]) minima[minima.length - 1] = i;
        } else {
          minima.push(i);
        }
      }
    }
    this.nodes = minima;
    this.loops = minima.length + 1;

    // Antinodes: local maxima of the envelope.
    const maxima: number[] = [];
    for (let i = 1; i < n - 1; i++) {
      if (w[i] >= w[i - 1] && w[i] >= w[i + 1] && w[i] > thresh) {
        maxima.push(i);
      }
    }
    this.antinodes = maxima;
  }
}
