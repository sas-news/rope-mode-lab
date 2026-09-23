import { LongRopeSimulation } from "../src/simulation/LongRopeSimulation";
import { ModeAnalyzer } from "../src/analysis/ModeAnalyzer";
import { ClearanceTracker, clearanceScore, groundScore } from "../src/analysis/Clearance";
import { cloneConfig } from "../src/utils/config";
import { DEFAULT_CONFIG } from "../src/simulation/types";

/**
 * Headless scan of the floor-friction coefficient: how much does the rope
 * slide, how wide is the loop opening, is it still jumpable?
 */
function measure(
  over: Partial<(typeof DEFAULT_CONFIG)["sim"]>,
  settle = 6,
  window = 4,
) {
  const cfg = cloneConfig(DEFAULT_CONFIG);
  Object.assign(cfg.sim, over);
  const sim = new LongRopeSimulation(cfg.sim);
  const an = new ModeAnalyzer(sim.rope.count);
  const jump = new ClearanceTracker(sim.rope.count);
  const dt = 1 / 120;
  for (let t = 0; t < settle; t += dt) {
    sim.advance(dt);
    an.update(sim.rope.positions, dt, 4);
  }
  jump.reset();
  // Shape/stick diagnostics the modal metrics do not capture.
  let slipAcc = 0, slipN = 0, kinkAcc = 0, kinkN = 0, bunchMax = 0;
  for (let t = 0; t < window; t += dt) {
    sim.advance(dt);
    an.update(sim.rope.positions, dt, 4);
    jump.update(sim.rope.positions, sim.rope.count, dt);
    const pos = sim.rope.positions, vel = sim.rope.velocities;
    const n = sim.rope.count;
    for (let i = 1; i < n - 1; i++) {
      const i3 = i * 3;
      if (pos[i3 + 1] <= cfg.sim.ropeRadius + 1e-3) {
        slipAcc += Math.hypot(vel[i3], vel[i3 + 2]);
        slipN++;
      }
    }
    // Segment-to-segment turn angle: kinks mean the rope is being pinned.
    for (let i = 1; i < n - 1; i++) {
      const a = i * 3, b = (i - 1) * 3, c = (i + 1) * 3;
      const ux = pos[a] - pos[b], uy = pos[a + 1] - pos[b + 1], uz = pos[a + 2] - pos[b + 2];
      const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const lu = Math.hypot(ux, uy, uz), lv = Math.hypot(vx, vy, vz);
      if (lu < 1e-6 || lv < 1e-6) continue;
      const cosang = (ux * vx + uy * vy + uz * vz) / (lu * lv);
      kinkAcc += Math.acos(Math.min(1, Math.max(-1, cosang)));
      kinkN++;
    }
    // Bunching: how far particle x-positions drift from even spacing.
    const x0 = pos[0], x1 = pos[(n - 1) * 3];
    for (let i = 1; i < n - 1; i++) {
      const want = x0 + ((x1 - x0) * i) / (n - 1);
      bunchMax = Math.max(bunchMax, Math.abs(pos[i * 3] - want));
    }
  }
  const g = groundScore(jump.minY, 0, jump.contactFrac);
  const c = clearanceScore(jump.maxOpening, cfg.optimizer.personHeight);
  const amp = an.amplitudes[1] ?? 0;
  return {
    unstable: sim.unstable,
    amp,
    dominant: an.dominant,
    purity: an.purities[an.dominant] ?? 0,
    opening: jump.maxOpening,
    contact: jump.contactFrac,
    minY: jump.minY,
    jump: amp * g * c,
    slip: slipN ? slipAcc / slipN : 0,
    kink: kinkN ? (kinkAcc / kinkN) * (180 / Math.PI) : 0,
    bunch: bunchMax,
  };
}

const row = (tag: string, r: ReturnType<typeof measure>) =>
  console.log(
    `${tag.padEnd(34)} a1=${r.amp.toFixed(2)} dom=${r.dominant} pur=${r.purity.toFixed(2)} ` +
      `open=${r.opening.toFixed(2)}m contact=${(r.contact * 100).toFixed(0)}% ` +
      `jump=${r.jump.toFixed(3)} slip=${r.slip.toFixed(2)}m/s kink=${r.kink.toFixed(2)}° ` +
      `bunch=${r.bunch.toFixed(2)}m${r.unstable ? " UNSTABLE" : ""}`,
  );

const mus = [0, 0.05, 0.12, 0.25, 0.5, 1.0];
console.log("--- friction scan @ default (f=1.1, r=0.85, L=8.5) ---");
for (const mu of mus) row(`mu=${mu}`, measure({ floorFriction: mu }));

console.log("\n--- friction scan @ short hands (r=0.35, dragging case) ---");
for (const mu of mus) {
  row(`r=0.35 mu=${mu}`, measure({ floorFriction: mu, radius: 0.35 }));
}

console.log("\n--- friction x rope length @ mu=0.05 ---");
for (const L of [8.0, 8.5, 9.0, 9.5]) {
  for (const mu of [0.0, 0.08, 0.3]) {
    row(`L=${L} mu=${mu}`, measure({ floorFriction: mu, ropeLength: L }));
  }
}

console.log("\n--- counter-phase double loop ---");
for (const mu of [0, 0.08, 0.3, 1.0]) {
  row(
    `double mu=${mu}`,
    measure({ floorFriction: mu, phaseDeg: 180, radius: 0.7, damping: 0.3 }),
  );
}
