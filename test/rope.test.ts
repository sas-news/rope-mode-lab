import { describe, expect, it } from "vitest";
import { Rope } from "../src/physics/Rope";

describe("Rope.layout", () => {
  it("places endpoints exactly at the handles", () => {
    const r = new Rope(51, 9, 1);
    r.layout(-3.5, 1.35, 0, 3.5, 1.35, 0);
    expect(r.positions[0]).toBeCloseTo(-3.5);
    expect(r.positions[1]).toBeCloseTo(1.35);
    const e = 50 * 3;
    expect(r.positions[e]).toBeCloseTo(3.5);
    expect(r.positions[e + 1]).toBeCloseTo(1.35);
  });

  it("produces segment lengths close to L/(N-1) when sagging", () => {
    const r = new Rope(61, 9, 1);
    r.layout(-3.5, 1.35, 0, 3.5, 1.35, 0); // gap 7 < L 9 -> must sag
    const rest = r.segmentLength;
    let worst = 0;
    for (let i = 0; i + 1 < r.count; i++) {
      const i3 = i * 3;
      const d = Math.hypot(
        r.positions[i3 + 3] - r.positions[i3],
        r.positions[i3 + 4] - r.positions[i3 + 1],
        r.positions[i3 + 5] - r.positions[i3 + 2],
      );
      worst = Math.max(worst, Math.abs(d - rest) / rest);
    }
    expect(worst).toBeLessThan(0.02);
    // midpoint must actually sag below the endpoint line
    const mid = 30 * 3;
    expect(r.positions[mid + 1]).toBeLessThan(1.0);
  });
});
