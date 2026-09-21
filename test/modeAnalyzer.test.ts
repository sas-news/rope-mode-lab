import { describe, expect, it } from "vitest";
import { ModeAnalyzer } from "../src/analysis/ModeAnalyzer";

const N = 61;
const GAP = 7;
const H = 1.35;

/**
 * Builds positions where the rope rotates as a pure spatial mode n:
 * transverse offset = A * sin(n*pi*t) * (y-hat*cos θ, z-hat*sin θ).
 */
function buildPositions(nMode: number, theta: number, amp = 0.6): Float32Array {
  const p = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const s = Math.sin(nMode * Math.PI * t);
    p[i * 3] = -GAP / 2 + GAP * t;
    p[i * 3 + 1] = H + amp * s * Math.cos(theta);
    p[i * 3 + 2] = amp * s * Math.sin(theta);
  }
  return p;
}

function runAnalyzer(nMode: number): ModeAnalyzer {
  const an = new ModeAnalyzer(N);
  const dt = 1 / 60;
  const omega = 2 * Math.PI * 1.4;
  for (let f = 0; f < 300; f++) {
    const theta = omega * f * dt;
    an.update(buildPositions(nMode, theta), dt, 6);
  }
  return an;
}

describe("ModeAnalyzer", () => {
  it.each([1, 2, 3, 4])("identifies a rotating mode %i shape", (m) => {
    const an = runAnalyzer(m);
    expect(an.dominant).toBe(m);
    // amplitude should recover the imposed 0.6 m
    expect(an.amplitudes[m]).toBeGreaterThan(0.4);
    // purity should be high for a pure input
    expect(an.purities[m]).toBeGreaterThan(0.85);
  });

  it("reports ~zero amplitude for a perfectly still straight rope", () => {
    const an = new ModeAnalyzer(N);
    const p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      p[i * 3] = -GAP / 2 + (GAP * i) / (N - 1);
      p[i * 3 + 1] = H;
    }
    for (let f = 0; f < 60; f++) an.update(p, 1 / 60, 6);
    expect(an.dominant).toBe(0);
    expect(an.rms).toBeLessThan(1e-6);
  });
});
