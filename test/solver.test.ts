import { describe, expect, it } from "vitest";
import { Rope } from "../src/physics/Rope";
import { XPBDSolver } from "../src/physics/XPBDSolver";

const PARAMS = {
  gravity: 0,
  damping: 0,
  airDrag: 0,
  compliance: 0,
  bendingStiffness: 0,
  iterations: 20,
};

describe("XPBDSolver", () => {
  it("does not inject energy with gravity=0 and a taut rope", () => {
    // Rope length exactly equals the endpoint gap: already at rest.
    const rope = new Rope(21, 2.0, 1.0);
    rope.layout(-1, 1.2, 0, 1, 1.2, 0);
    const solver = new XPBDSolver(rope);
    solver.rebuildConstraints(0, 0);
    const a = [-1, 1.2, 0];
    const b = [1, 1.2, 0];
    for (let s = 0; s < 120; s++) solver.step(1 / 240, a, b, PARAMS, 0.5);

    let maxV = 0;
    for (let i = 0; i < rope.count * 3; i++) {
      maxV = Math.max(maxV, Math.abs(rope.velocities[i]));
    }
    expect(maxV).toBeLessThan(1e-4);
    expect(solver.unstable).toBe(false);
  });

  it("keeps endpoints glued to the driver targets", () => {
    const rope = new Rope(11, 2.0, 0.5);
    rope.layout(-1, 1, 0, 1, 1, 0);
    const solver = new XPBDSolver(rope);
    const a = [-1, 1.1, 0.05];
    const b = [1, 0.9, -0.05];
    for (let s = 0; s < 30; s++) {
      solver.step(1 / 240, a, b, { ...PARAMS, gravity: 9.81 }, 0.25);
    }
    const e = (rope.count - 1) * 3;
    expect(rope.positions[0]).toBeCloseTo(a[0], 6);
    expect(rope.positions[1]).toBeCloseTo(a[1], 6);
    expect(rope.positions[2]).toBeCloseTo(a[2], 6);
    expect(rope.positions[e]).toBeCloseTo(b[0], 6);
    expect(rope.positions[e + 1]).toBeCloseTo(b[1], 6);
    expect(rope.positions[e + 2]).toBeCloseTo(b[2], 6);
  });

  it("keeps segment lengths near rest under gravity (inextensible)", () => {
    const rope = new Rope(31, 3.0, 1.0);
    rope.layout(-1, 1.3, 0, 1, 1.3, 0);
    const solver = new XPBDSolver(rope);
    const a = [-1, 1.3, 0];
    const b = [1, 1.3, 0];
    for (let s = 0; s < 600; s++) {
      solver.step(1 / 240, a, b, { ...PARAMS, gravity: 9.81, damping: 0.5 }, 0.33);
    }
    expect(solver.unstable).toBe(false);
    const rest = rope.segmentLength;
    let worst = 0;
    for (let i = 0; i + 1 < rope.count; i++) {
      const i3 = i * 3;
      const d = Math.hypot(
        rope.positions[i3 + 3] - rope.positions[i3],
        rope.positions[i3 + 4] - rope.positions[i3 + 1],
        rope.positions[i3 + 5] - rope.positions[i3 + 2],
      );
      worst = Math.max(worst, Math.abs(d - rest) / rest);
    }
    expect(worst).toBeLessThan(0.05); // <5% stretch
  });
});
