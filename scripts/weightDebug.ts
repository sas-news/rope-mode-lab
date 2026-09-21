import { LongRopeSimulation } from "../src/simulation/LongRopeSimulation";
import { cloneConfig } from "../src/utils/config";
import { DEFAULT_CONFIG } from "../src/simulation/types";

const cfg = cloneConfig(DEFAULT_CONFIG);
cfg.sim.frequency = 1.5;
cfg.sim.phaseDeg = 0;
cfg.sim.pointMassEnabled = true;
cfg.sim.pointMassPos = 0.5;
cfg.sim.pointMassKg = 8;
const sim = new LongRopeSimulation(cfg.sim);
const N = sim.rope.count;
const wi = Math.round(0.5 * (N - 1));
console.log("N:", N, "wi:", wi, "invMass[wi]:", sim.rope.invMass[wi].toFixed(4), "base:", (1 / (cfg.sim.ropeMass / N)).toFixed(2));
const dt = 1 / 60;
let minY = 99, maxY = -99;
for (let k = 0; k < 60 * 10; k++) {
  sim.advance(dt);
  const y = sim.rope.positions[wi * 3 + 1];
  if (k > 300) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  if (k % 120 === 0) {
    console.log(`t=${(k / 60).toFixed(1)}s wpos=(${sim.rope.positions[wi * 3].toFixed(2)}, ${y.toFixed(2)}, ${sim.rope.positions[wi * 3 + 2].toFixed(2)})`);
  }
}
console.log(`weighted particle y-range over last 5s: ${minY.toFixed(3)}..${maxY.toFixed(3)}`);
