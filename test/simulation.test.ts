import { describe, expect, it } from "vitest";
import { LongRopeSimulation } from "../src/simulation/LongRopeSimulation";
import { ModeAnalyzer } from "../src/analysis/ModeAnalyzer";
import { NodeDetector } from "../src/analysis/NodeDetector";
import { cloneConfig } from "../src/utils/config";
import { DEFAULT_CONFIG } from "../src/simulation/types";

/** Runs the sim headlessly for `seconds`, feeding the analyzer each frame. */
function run(seconds: number, mutate?: (sim: LongRopeSimulation) => void) {
  const cfg = cloneConfig(DEFAULT_CONFIG);
  const sim = new LongRopeSimulation(cfg.sim);
  mutate?.(sim);
  const an = new ModeAnalyzer(sim.rope.count);
  const det = new NodeDetector(sim.rope.count);
  const frameDt = 1 / 60;
  const frames = Math.round(seconds / frameDt);
  for (let f = 0; f < frames; f++) {
    sim.advance(frameDt);
    an.update(sim.rope.positions, frameDt, 6);
    det.update(an.fluctMag, frameDt, 0.42);
  }
  return { sim, an, det };
}

describe("LongRopeSimulation (headless)", () => {
  it("stays stable and finite for 10 s of in-phase drive", () => {
    const { sim } = run(10);
    expect(sim.unstable).toBe(false);
    for (let i = 0; i < sim.rope.count * 3; i++) {
      expect(Number.isFinite(sim.rope.positions[i])).toBe(true);
    }
  });

  it("the rope actually moves when driven (nonzero RMS displacement)", () => {
    const { an } = run(8);
    expect(an.rms).toBeGreaterThan(0.02);
  });

  it("stays stable under 180° counter-phase drive", () => {
    const { sim } = run(10, (s) => {
      s.params.phaseDeg = 180;
      s.params.frequency = 1.7;
      s.params.radius = 0.4;
      s.updateDrivers();
      s.reset();
    });
    expect(sim.unstable).toBe(false);
  });

  it("stays stable at high frequency / stiff settings", () => {
    const { sim } = run(6, (s) => {
      s.params.frequency = 4.0;
      s.params.radius = 0.6;
      s.params.bendingStiffness = 0.8;
      s.params.damping = 0.1;
      s.updateDrivers();
      s.reset();
    });
    expect(sim.unstable).toBe(false);
  });

  it("a paused simulation does not advance", () => {
    const cfg = cloneConfig(DEFAULT_CONFIG);
    const sim = new LongRopeSimulation(cfg.sim);
    sim.paused = true;
    const before = sim.rope.positions.slice();
    sim.advance(1 / 60);
    expect(sim.rope.positions).toEqual(before);
    expect(sim.simTime).toBe(0);
  });
});
