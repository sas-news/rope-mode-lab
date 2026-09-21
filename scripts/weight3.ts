import { LongRopeSimulation } from "../src/simulation/LongRopeSimulation";
import { ModeAnalyzer } from "../src/analysis/ModeAnalyzer";
import { NodeDetector } from "../src/analysis/NodeDetector";
import { cloneConfig } from "../src/utils/config";
import { DEFAULT_CONFIG } from "../src/simulation/types";

/**
 * Two heavy weights at the mode-3 node positions (L/3, 2L/3) should pin
 * them and split the rope into three independently-whirling segments —
 * an in-phase triple loop.
 */
function run(
  f: number,
  weights: [number, number][],
  phase: number,
  kick = 0,
  secs = 16,
) {
  const cfg = cloneConfig(DEFAULT_CONFIG);
  cfg.sim.frequency = f;
  cfg.sim.phaseDeg = phase;
  cfg.sim.radius = 0.35;
  cfg.sim.ropeMass = 1.2;
  cfg.sim.damping = 0.25;
  const sim = new LongRopeSimulation(cfg.sim);
  // Directly apply multiple point masses (bypasses the single-weight config).
  const rope = sim.rope;
  const base = cfg.sim.ropeMass / rope.count;
  if (weights.length) {
    for (let i = 1; i < rope.count - 1; i++) rope.invMass[i] = 1 / base;
    for (const [frac, kg] of weights) {
      const i = Math.min(rope.count - 2, Math.max(1, Math.round(frac * (rope.count - 1))));
      rope.invMass[i] = 1 / (base + kg);
    }
  }
  if (kick > 0) sim.injectMode(kick, 0.5);
  const an = new ModeAnalyzer(rope.count);
  const det = new NodeDetector(rope.count);
  const dt = 1 / 60;
  for (let k = 0; k < 60 * secs; k++) {
    sim.advance(dt);
    // re-assert weights every frame (syncPointMass may overwrite)
    if (weights.length) {
      for (const [frac, kg] of weights) {
        const i = Math.min(rope.count - 2, Math.max(1, Math.round(frac * (rope.count - 1))));
        rope.invMass[i] = 1 / (base + kg);
      }
    }
    if (k >= 60 * (secs - 6)) {
      an.update(rope.positions, dt, 6);
      det.update(an.fluctMag, dt, 0.42);
    }
  }
  const amps = Array.from(an.amplitudes.slice(1, 7)).map((a) => a.toFixed(2)).join(" ");
  console.log(
    `f=${f.toFixed(2)} ph=${phase} kick=n${kick} w=[${weights.map(w => w.join("kg@")).join(",")}] amps:[${amps}] dom=${an.dominant} nodes=${det.nodes.length}`,
  );
}

console.log("=== two pins at 1/3 & 2/3, in-phase ===");
for (const f of [1.5, 2.0, 2.5, 3.0]) run(f, [[1 / 3, 8], [2 / 3, 8]], 0);
console.log("=== same + n3 kick ===");
for (const f of [2.0, 2.5, 3.0]) run(f, [[1 / 3, 8], [2 / 3, 8]], 0, 3);
console.log("=== lighter pins ===");
for (const f of [2.0, 2.5, 3.0]) run(f, [[1 / 3, 2], [2 / 3, 2]], 0);
console.log("=== two pins, anti-phase ===");
for (const f of [2.0, 3.0]) run(f, [[1 / 3, 8], [2 / 3, 8]], 180);
console.log("=== three pins at 1/4,2/4,3/4 in-phase (n=4?) ===");
for (const f of [2.0, 3.0]) run(f, [[0.25, 8], [0.5, 8], [0.75, 8]], 0);
