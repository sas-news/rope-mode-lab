import { describe, expect, it } from "vitest";
import { NodeDetector } from "../src/analysis/NodeDetector";

const N = 121;

/** Feeds a static |sin(n*pi*x)| envelope into the detector. */
function detect(nMode: number): NodeDetector {
  const det = new NodeDetector(N);
  const fluct = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    fluct[i] = 0.5 * Math.abs(Math.sin((nMode * Math.PI * i) / (N - 1)));
  }
  for (let f = 0; f < 300; f++) det.update(fluct, 1 / 60, 0.42);
  return det;
}

describe("NodeDetector", () => {
  it("finds 1 internal node for a mode-2 envelope", () => {
    const det = detect(2);
    expect(det.nodes.length).toBe(1);
    // node should sit near the rope centre
    expect(det.nodes[0] / (N - 1)).toBeGreaterThan(0.4);
    expect(det.nodes[0] / (N - 1)).toBeLessThan(0.6);
    expect(det.loops).toBe(2);
  });

  it("finds 2 internal nodes for a mode-3 envelope", () => {
    const det = detect(3);
    expect(det.nodes.length).toBe(2);
    const f = det.nodes.map((i) => i / (N - 1)).sort();
    expect(f[0]).toBeGreaterThan(0.25);
    expect(f[0]).toBeLessThan(0.42);
    expect(f[1]).toBeGreaterThan(0.58);
    expect(f[1]).toBeLessThan(0.75);
    expect(det.loops).toBe(3);
  });

  it("finds no nodes for a mode-1 envelope", () => {
    const det = detect(1);
    expect(det.nodes.length).toBe(0);
  });
});
