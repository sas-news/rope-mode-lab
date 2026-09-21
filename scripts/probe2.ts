import { LongRopeSimulation } from "../src/simulation/LongRopeSimulation";
import { ModeAnalyzer } from "../src/analysis/ModeAnalyzer";
import { NodeDetector } from "../src/analysis/NodeDetector";
import { cloneConfig } from "../src/utils/config";
import { DEFAULT_CONFIG } from "../src/simulation/types";

function run(
  f: number,
  phase: number,
  opts: Partial<typeof DEFAULT_CONFIG.sim> = {},
) {
  const cfg = cloneConfig(DEFAULT_CONFIG);
  cfg.sim.frequency = f;
  cfg.sim.phaseDeg = phase;
  Object.assign(cfg.sim, opts);
  const sim = new LongRopeSimulation(cfg.sim);
  const an = new ModeAnalyzer(sim.rope.count);
  const det = new NodeDetector(sim.rope.count);
  const dt = 1 / 60;
  for (let k = 0; k < 60 * 16; k++) {
    sim.advance(dt);
    an.update(sim.rope.positions, dt, 6);
    det.update(an.fluctMag, dt, 0.42);
  }
  const amps = Array.from(an.amplitudes.slice(1, 7))
    .map((a) => a.toFixed(2))
    .join(" ");
  console.log(
    `f=${f.toFixed(1)} ph=${phase}`,
    "amps:", amps,
    "dom:", an.dominant,
    "nodes:", det.nodes.length,
    "rms:", an.rms.toFixed(3),
    sim.unstable ? "UNSTABLE" : "",
    JSON.stringify(opts),
  );
}

console.log("=== high freq, phase 0, low damping ===");
for (const f of [3.0, 3.5, 4.0, 4.5, 5.0]) run(f, 0, { damping: 0.15, radius: 0.45 });
console.log("=== phase 0, heavier rope ===");
for (const f of [2.0, 2.5, 3.0, 3.5]) run(f, 0, { ropeMass: 2.5, damping: 0.2 });
console.log("=== phase 0, smaller radius ===");
for (const f of [2.5, 3.0, 3.5, 4.0]) run(f, 0, { radius: 0.2, damping: 0.15 });
console.log("=== phase 0, more slack ===");
for (const f of [2.0, 2.5, 3.0, 3.5]) run(f, 0, { handleDistance: 6.0, ropeLength: 10, damping: 0.2 });
