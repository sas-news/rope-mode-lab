import { LongRopeSimulation } from "../src/simulation/LongRopeSimulation";
import { ModeAnalyzer } from "../src/analysis/ModeAnalyzer";
import { NodeDetector } from "../src/analysis/NodeDetector";
import { cloneConfig } from "../src/utils/config";
import { DEFAULT_CONFIG } from "../src/simulation/types";

/**
 * Point-weight experiment. Hypothesis: a weight at x/L = 1/3 sits on a
 * mode-3 node (harmless to n=3) but loads the mode-1 antinode region,
 * possibly letting n=3 become dominant.
 */
function run(
  f: number,
  kickMode: number,
  wPos: number,
  wKg: number,
  phase: number,
  secs = 16,
) {
  const cfg = cloneConfig(DEFAULT_CONFIG);
  cfg.sim.frequency = f;
  cfg.sim.phaseDeg = phase;
  cfg.sim.radius = 0.35;
  cfg.sim.ropeMass = 1.6;
  cfg.sim.damping = 0.18;
  cfg.sim.pointMassEnabled = wKg > 0;
  cfg.sim.pointMassPos = wPos;
  cfg.sim.pointMassKg = wKg;
  const sim = new LongRopeSimulation(cfg.sim);
  if (kickMode > 0) sim.injectMode(kickMode, 0.5);
  const rope = sim.rope;
  const an = new ModeAnalyzer(rope.count);
  const det = new NodeDetector(rope.count);
  const dt = 1 / 60;
  for (let k = 0; k < 60 * secs; k++) {
    sim.advance(dt);
    if (k >= 60 * (secs - 6)) {
      an.update(rope.positions, dt, 6);
      det.update(an.fluctMag, dt, 0.42);
    }
  }
  const amps = Array.from(an.amplitudes.slice(1, 7)).map((a) => a.toFixed(2)).join(" ");
  console.log(
    `f=${f.toFixed(2)} kick=n${kickMode} w=${wKg}kg@${wPos.toFixed(2)} ph=${phase} amps:[${amps}] dom=${an.dominant} nodes=${det.nodes.length}`,
  );
}

console.log("=== weight@1/3 + n3 kick, phase 0 ===");
for (const kg of [0.5, 1.0, 2.0]) {
  for (const f of [2.5, 3.0, 3.5, 4.0]) run(f, 3, 1 / 3, kg, 0);
}
console.log("=== weight@1/3 without kick (steady drive only) ===");
for (const f of [2.0, 2.5, 3.0]) run(f, 0, 1 / 3, 1.5, 0);
console.log("=== weight positions compared (f=3, kick n3, 1.5kg) ===");
for (const p of [0.25, 1 / 3, 0.5]) run(3.0, 3, p, 1.5, 0);
console.log("=== control: no weight, kick n3, f=3 ===");
run(3.0, 3, 0.33, 0, 0);
