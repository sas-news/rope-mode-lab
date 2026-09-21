import { describe, expect, it } from "vitest";
import { DistanceConstraint } from "../src/physics/constraints/DistanceConstraint";

describe("DistanceConstraint", () => {
  it("pulls two stretched particles back to rest length", () => {
    const pos = new Float32Array([0, 0, 0, 2.0, 0, 0]); // dist 2, rest 1
    const invMass = new Float32Array([1, 1]);
    const c = new DistanceConstraint(0, 1, 1.0, 0);
    const h = 1 / 240;
    for (let i = 0; i < 80; i++) {
      c.resetLambda();
      c.solve(pos, invMass, h);
    }
    const d = Math.hypot(pos[3] - pos[0], pos[4] - pos[1], pos[5] - pos[2]);
    expect(d).toBeCloseTo(1.0, 3);
  });

  it("does not move a pinned particle", () => {
    const pos = new Float32Array([0, 0, 0, 2.0, 0, 0]);
    const invMass = new Float32Array([0, 1]); // i=0 pinned
    const c = new DistanceConstraint(0, 1, 1.0, 0);
    const h = 1 / 240;
    for (let i = 0; i < 80; i++) {
      c.resetLambda();
      c.solve(pos, invMass, h);
    }
    expect(pos[0]).toBe(0);
    const d = Math.hypot(pos[3] - pos[0], pos[4] - pos[1], pos[5] - pos[2]);
    expect(d).toBeCloseTo(1.0, 3);
  });

  it("compliant constraint leaves residual stretch under tension", () => {
    const pos = new Float32Array([0, 0, 0, 1.5, 0, 0]);
    const invMass = new Float32Array([0, 1]);
    const c = new DistanceConstraint(0, 1, 1.0, 0.01); // soft
    const h = 1 / 240;
    c.resetLambda();
    c.solve(pos, invMass, h);
    const d = Math.hypot(pos[3] - pos[0], pos[4] - pos[1], pos[5] - pos[2]);
    // A single soft pass should correct far less than a rigid projection.
    expect(d).toBeGreaterThan(1.4);
    expect(d).toBeLessThan(1.5);
  });
});
