import { describe, expect, it } from "vitest";
import {
  ClearanceTracker,
  clearanceScore,
  groundScore,
  jumpScore,
} from "../src/analysis/Clearance";

function positions(ys: number[]): Float32Array {
  const p = new Float32Array(ys.length * 3);
  ys.forEach((y, i) => (p[i * 3 + 1] = y));
  return p;
}

describe("ClearanceTracker", () => {
  it("tracks per-particle min/max and global floor reach", () => {
    const t = new ClearanceTracker(5, 0, 0.06);
    t.update(positions([1.3, 0.9, 0.2, 0.9, 1.3]), 5, 0.05);
    t.update(positions([1.3, 1.4, 0.8, 1.4, 1.3]), 5, 0.05);
    expect(t.minY).toBeCloseTo(0.2);
    // middle particle swept 0.2..0.8 → opening 0.6
    expect(t.maxOpening).toBeCloseTo(0.6);
    // never got within 0.06 of floor
    expect(t.contactFrac).toBe(0);
  });

  it("counts floor contact fraction", () => {
    const t = new ClearanceTracker(3, 0, 0.06);
    t.update(positions([1.3, 0.01, 1.3]), 3, 0.1); // touching
    t.update(positions([1.3, 0.5, 1.3]), 3, 0.1);  // not
    t.update(positions([1.3, 0.02, 1.3]), 3, 0.1); // touching
    expect(t.contactFrac).toBeCloseTo(2 / 3);
    expect(t.minY).toBeCloseTo(0.01);
  });

  it("reset starts a fresh window", () => {
    const t = new ClearanceTracker(3);
    t.update(positions([1, 0.01, 1]), 3, 0.1);
    t.reset();
    expect(t.minY).toBe(Infinity);
    expect(t.contactFrac).toBe(0);
    t.update(positions([1, 0.9, 1]), 3, 0.1);
    expect(t.minY).toBeCloseTo(0.9);
  });
});

describe("jump scores", () => {
  it("groundScore: touching the floor scores ~1, hovering ~0", () => {
    expect(groundScore(0.01, 0, 0.05)).toBeCloseTo(1, 1);
    expect(groundScore(0.3, 0, 0)).toBeCloseTo(0, 1);
    expect(groundScore(0.5, 0, 0)).toBe(0);
  });

  it("groundScore: constant dragging is penalised", () => {
    const grazing = groundScore(0.01, 0, 0.1);
    const dragging = groundScore(0.01, 0, 0.95);
    expect(dragging).toBeLessThan(grazing * 0.3);
  });

  it("clearanceScore scales with opening vs person height", () => {
    expect(clearanceScore(1.7, 1.7)).toBeCloseTo(1);
    expect(clearanceScore(0.85, 1.7)).toBeCloseTo(0.5);
    expect(clearanceScore(3.4, 1.7)).toBe(1);
  });

  it("jumpScore gates modal amplitude", () => {
    // big mode-1 amplitude but no floor reach or no opening → 0
    expect(jumpScore(0.8, 0, 1)).toBe(0);
    expect(jumpScore(0.8, 1, 0)).toBe(0);
    // partial clearance → partial score (soft gate, not a threshold)
    expect(jumpScore(0.8, 1, 0.3)).toBeCloseTo(0.24);
    // full marks
    expect(jumpScore(0.8, 1, 1)).toBeCloseTo(0.8);
  });
});
