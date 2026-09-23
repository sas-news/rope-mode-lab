import { LongRopeSimulation } from "../src/simulation/LongRopeSimulation";
import { ModeAnalyzer } from "../src/analysis/ModeAnalyzer";
import { ClearanceTracker, clearanceScore, groundScore } from "../src/analysis/Clearance";
import { cloneConfig } from "../src/utils/config";
import { DEFAULT_CONFIG } from "../src/simulation/types";
import { PRESETS } from "../src/simulation/presets";

/** Full-fidelity verification of every preset. */
for (const [key, preset] of Object.entries(PRESETS)) {
  const cfg = cloneConfig(DEFAULT_CONFIG);
  preset.apply(cfg);
  const sim = new LongRopeSimulation(cfg.sim);
  const an = new ModeAnalyzer(sim.rope.count);
  const jump = new ClearanceTracker(sim.rope.count);
  const dt = 1 / 120;
  for (let t = 0; t < 8; t += dt) {
    sim.advance(dt);
    an.update(sim.rope.positions, dt, 6);
  }
  jump.reset();
  let slipAcc = 0, slipN = 0;
  for (let t = 0; t < 5; t += dt) {
    sim.advance(dt);
    an.update(sim.rope.positions, dt, 6);
    jump.update(sim.rope.positions, sim.rope.count, dt);
    const pos = sim.rope.positions, vel = sim.rope.velocities;
    for (let i = 1; i < sim.rope.count - 1; i++) {
      const i3 = i * 3;
      if (pos[i3 + 1] <= cfg.sim.ropeRadius + 1e-3) {
        slipAcc += Math.hypot(vel[i3], vel[i3 + 2]);
        slipN++;
      }
    }
  }
  const dom = an.dominant;
  const score =
    (an.amplitudes[dom] ?? 0) *
    groundScore(jump.minY, 0, jump.contactFrac) *
    clearanceScore(jump.maxOpening, 1.7);
  console.log(
    `${key.padEnd(9)} mu=${cfg.sim.floorFriction.toFixed(2)} dom=${dom} ` +
      `amp=${(an.amplitudes[dom] ?? 0).toFixed(2)} pur=${(an.purities[dom] ?? 0).toFixed(2)} ` +
      `open=${jump.maxOpening.toFixed(2)}m contact=${(jump.contactFrac * 100).toFixed(0)}% ` +
      `slip=${(slipN ? slipAcc / slipN : 0).toFixed(2)}m/s jump=${score.toFixed(2)}` +
      (sim.unstable ? " UNSTABLE" : ""),
  );
}
