import { LongRopeSimulation } from "../src/simulation/LongRopeSimulation";
import { ModeAnalyzer } from "../src/analysis/ModeAnalyzer";
import { ClearanceTracker } from "../src/analysis/Clearance";
import { cloneConfig } from "../src/utils/config";
import { DEFAULT_CONFIG } from "../src/simulation/types";

function run(f: number, r: number, L: number) {
  const cfg = cloneConfig(DEFAULT_CONFIG);
  cfg.sim.frequency = f;
  cfg.sim.radius = r;
  cfg.sim.ropeLength = L;
  cfg.sim.phaseDeg = 0;
  const sim = new LongRopeSimulation(cfg.sim);
  const an = new ModeAnalyzer(sim.rope.count);
  const cl = new ClearanceTracker(sim.rope.count);
  cl.reset();
  const dt = 1 / 60;
  for (let k = 0; k < 60 * 14; k++) {
    sim.advance(dt);
    if (k >= 60 * 8) {
      an.update(sim.rope.positions, dt, 6);
      cl.update(sim.rope.positions, sim.rope.count, dt);
    }
  }
  console.log(
    `f=${f.toFixed(2)} r=${r.toFixed(2)} L=${L.toFixed(1)} → ` +
      `contact=${(cl.contactFrac * 100).toFixed(0)}% ` +
      `opening=${cl.maxOpening.toFixed(2)}m a1=${an.amplitudes[1].toFixed(2)}`,
  );
}

for (const L of [8.0, 8.5, 9.0]) {
  for (const r of [0.8, 0.85, 0.9]) run(1.2, r, L);
}
run(1.1, 0.85, 8.5);
run(1.3, 0.85, 8.5);
