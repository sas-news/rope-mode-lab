import { LongRopeSimulation } from "../src/simulation/LongRopeSimulation";
import { ModeAnalyzer } from "../src/analysis/ModeAnalyzer";
import { NodeDetector } from "../src/analysis/NodeDetector";
import { cloneConfig } from "../src/utils/config";
import { DEFAULT_CONFIG } from "../src/simulation/types";

/**
 * Extreme-weight experiment: a heavy enough point mass should act as a
 * quasi-fixed point, splitting the rope into two shorter whirling segments.
 */
function run(f: number, wPos: number, wKg: number, phase: number, kick = 0, secs = 14) {
  const cfg = cloneConfig(DEFAULT_CONFIG);
  cfg.sim.frequency = f;
  cfg.sim.phaseDeg = phase;
  cfg.sim.radius = 0.35;
  cfg.sim.ropeMass = 1.2;
  cfg.sim.damping = 0.25;
  cfg.sim.pointMassEnabled = wKg > 0;
  cfg.sim.pointMassPos = wPos;
  cfg.sim.pointMassKg = wKg;
  const sim = new LongRopeSimulation(cfg.sim);
  if (kick > 0) sim.injectMode(kick, 0.5);
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
  // weighted particle's actual motion (fixedness check)
  const wi = Math.round(wPos * (rope.count - 1));
  console.log(
    `f=${f.toFixed(2)} ph=${phase} w=${wKg}kg@${wPos.toFixed(2)} kick=n${kick} amps:[${amps}] dom=${an.dominant} nodes=${det.nodes.length} wEnv=${an.fluctMag[wi].toFixed(3)}`,
  );
}

console.log("=== very heavy center weight, in-phase ===");
for (const f of [1.0, 1.5, 2.0, 2.5]) run(f, 0.5, 8, 0);
console.log("=== very heavy center weight, anti-phase ===");
for (const f of [1.0, 1.5, 2.0]) run(f, 0.5, 8, 180);
console.log("=== heavy weight at 1/3, in-phase (mode-3 node loading) ===");
for (const f of [1.5, 2.0, 2.5, 3.0]) run(f, 1 / 3, 8, 0);
console.log("=== heavy weight at 1/3 + n3 kick, in-phase ===");
for (const f of [2.0, 2.5, 3.0]) run(f, 1 / 3, 8, 0, 3);
console.log("=== heavy weight at 1/4, in-phase (mode-4 node) ===");
for (const f of [2.0, 2.5, 3.0]) run(f, 0.25, 8, 0, 4);
