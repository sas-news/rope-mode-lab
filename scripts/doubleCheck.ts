import { LongRopeSimulation } from "../src/simulation/LongRopeSimulation";
import { ModeAnalyzer } from "../src/analysis/ModeAnalyzer";
import { ClearanceTracker } from "../src/analysis/Clearance";
import { cloneConfig } from "../src/utils/config";
import { DEFAULT_CONFIG } from "../src/simulation/types";

for (const [f, r, L] of [[1.1, 0.6, 8.5], [1.1, 0.7, 8.5], [1.2, 0.6, 8.5], [0.9, 0.6, 8.5]] as const) {
  const cfg = cloneConfig(DEFAULT_CONFIG);
  cfg.sim.frequency = f; cfg.sim.radius = r; cfg.sim.ropeLength = L;
  cfg.sim.phaseDeg = 180;
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
  console.log(`f=${f} r=${r} L=${L} → dom=${an.dominant} a1=${an.amplitudes[1].toFixed(2)} a2=${an.amplitudes[2].toFixed(2)} contact=${(cl.contactFrac*100).toFixed(0)}% opening=${cl.maxOpening.toFixed(2)}m`);
}
