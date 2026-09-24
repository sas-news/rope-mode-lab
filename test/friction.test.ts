import { describe, expect, it } from "vitest";
import { Rope } from "../src/physics/Rope";
import { XPBDSolver, floorFrictionKeep } from "../src/physics/XPBDSolver";
import { PRESETS } from "../src/simulation/presets";
import { cloneConfig } from "../src/utils/config";
import { DEFAULT_CONFIG } from "../src/simulation/types";

const BASE = {
  gravity: 9.81,
  damping: 0,
  airDrag: 0,
  compliance: 0,
  bendingStiffness: 0,
  iterations: 20,
  floorCollision: true,
  floorOffset: 0.014,
  floorFriction: 0,
};

/** Mean sliding speed of the rope section lying on the floor. */
function slidingSpeed(friction: number): number {
  const rope = new Rope(41, 5.0, 1.0);
  rope.layout(-1.5, 0.4, 0, 1.5, 0.4, 0);
  const solver = new XPBDSolver(rope);
  const h = 1 / 240;
  const p = { ...BASE, floorFriction: friction };
  // Let the slack settle onto the floor, then shove the rope sideways.
  const a = [-1.5, 0.4, 0], b = [1.5, 0.4, 0];
  for (let s = 0; s < 480; s++) solver.step(h, a, b, p, 0.2);
  for (let i = 1; i < rope.count - 1; i++) rope.velocities[i * 3 + 2] = 3;
  for (let s = 0; s < 24; s++) solver.step(h, a, b, p, 0.2);

  let sum = 0, n = 0;
  for (let i = 1; i < rope.count - 1; i++) {
    const i3 = i * 3;
    if (rope.positions[i3 + 1] <= p.floorOffset + 1e-4) {
      sum += Math.hypot(rope.velocities[i3], rope.velocities[i3 + 2]);
      n++;
    }
  }
  expect(n).toBeGreaterThan(0);
  return sum / n;
}

describe("floor friction", () => {
  it("is timestep independent", () => {
    const halfAt240 = floorFrictionKeep(0.3, 1 / 240) ** 2;
    const oneAt120 = floorFrictionKeep(0.3, 1 / 120);
    expect(halfAt240).toBeCloseTo(oneAt120, 10);
  });

  it("keeps everything at mu=0 and stops sliding at mu=1", () => {
    expect(floorFrictionKeep(0, 1 / 240)).toBe(1);
    expect(floorFrictionKeep(1, 1 / 240)).toBeLessThan(0.65);
    // Out-of-range values are clamped.
    expect(floorFrictionKeep(-1, 1 / 240)).toBe(1);
    expect(floorFrictionKeep(5, 1 / 240)).toBe(floorFrictionKeep(1, 1 / 240));
  });

  it("higher mu slows the rope section resting on the floor", () => {
    const free = slidingSpeed(0);
    const mid = slidingSpeed(0.2);
    const stuck = slidingSpeed(1);
    expect(mid).toBeLessThan(free);
    expect(stuck).toBeLessThan(mid);
    expect(stuck).toBeLessThan(free * 0.5);
  });

  it("the default configuration is low friction", () => {
    expect(DEFAULT_CONFIG.sim.floorFriction).toBeLessThan(0.2);
  });

  it("floor presets differ only in friction", () => {
    const slick = cloneConfig(DEFAULT_CONFIG);
    const sticky = cloneConfig(DEFAULT_CONFIG);
    PRESETS.slick.apply(slick);
    PRESETS.sticky.apply(sticky);
    expect(slick.sim.floorFriction).toBeLessThan(0.05);
    expect(sticky.sim.floorFriction).toBeGreaterThan(0.5);
    slick.sim.floorFriction = sticky.sim.floorFriction;
    expect(slick).toEqual(sticky);
  });
});
