import { describe, expect, it } from "vitest";
import { Rope } from "../src/physics/Rope";
import { LongRopeSimulation } from "../src/simulation/LongRopeSimulation";
import { cloneConfig } from "../src/utils/config";
import { DEFAULT_CONFIG } from "../src/simulation/types";

describe("point mass (おもり)", () => {
  it("assigns inverse mass to the nearest particle only", () => {
    const r = new Rope(21, 2, 1);
    const idx = r.setPointMass(0.5, 4);
    expect(idx).toBe(10);
    const baseInv = 1 / (1 / 21);
    expect(r.invMass[10]).toBeCloseTo(1 / (1 / 21 + 4));
    // neighbours keep base mass, endpoints stay pinned
    expect(r.invMass[9]).toBeCloseTo(baseInv);
    expect(r.invMass[0]).toBe(0);
    expect(r.invMass[20]).toBe(0);
    // removing restores uniform mass
    r.setPointMass(0.5, 0);
    expect(r.invMass[10]).toBeCloseTo(baseInv);
  });

  it("a very heavy particle sinks and pins (quasi-node)", () => {
    const cfg = cloneConfig(DEFAULT_CONFIG);
    cfg.sim.frequency = 1.2;
    cfg.sim.pointMassEnabled = true;
    cfg.sim.pointMassPos = 0.5;
    cfg.sim.pointMassKg = 8;
    const sim = new LongRopeSimulation(cfg.sim);
    const wi = Math.round(0.5 * (sim.rope.count - 1));
    for (let k = 0; k < 60 * 8; k++) sim.advance(1 / 60);
    const y = sim.rope.positions[wi * 3 + 1];
    // it should have sunk well below the handle height
    expect(y).toBeLessThan(0.5);
    expect(sim.unstable).toBe(false);
  });
});
