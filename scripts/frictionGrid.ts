import { LongRopeSimulation } from "../src/simulation/LongRopeSimulation";
import { ModeAnalyzer } from "../src/analysis/ModeAnalyzer";
import { ClearanceTracker, clearanceScore, groundScore } from "../src/analysis/Clearance";
import { cloneConfig } from "../src/utils/config";
import { DEFAULT_CONFIG } from "../src/simulation/types";

/** radius x ropeLength grid at low floor friction — hunt a clean loop. */
function measure(over: Partial<(typeof DEFAULT_CONFIG)["sim"]>) {
  const cfg = cloneConfig(DEFAULT_CONFIG);
  Object.assign(cfg.sim, over);
  cfg.sim.particleCount = 81;
  cfg.sim.iterations = 20;
  const sim = new LongRopeSimulation(cfg.sim);
  const an = new ModeAnalyzer(sim.rope.count);
  const jump = new ClearanceTracker(sim.rope.count);
  const dt = 1 / 120;
  for (let t = 0; t < 5; t += dt) {
    sim.advance(dt);
    an.update(sim.rope.positions, dt, 4);
  }
  jump.reset();
  for (let t = 0; t < 3.5; t += dt) {
    sim.advance(dt);
    an.update(sim.rope.positions, dt, 4);
    jump.update(sim.rope.positions, sim.rope.count, dt);
  }
  const amp = an.amplitudes[1] ?? 0;
  const score =
    amp *
    groundScore(jump.minY, 0, jump.contactFrac) *
    clearanceScore(jump.maxOpening, 1.7);
  return {
    score,
    purity: an.purities[1] ?? 0,
    open: jump.maxOpening,
    contact: jump.contactFrac,
    unstable: sim.unstable,
  };
}

const rows: string[] = [];
const best: { tag: string; score: number }[] = [];
for (const mu of [0.02, 0.15]) {
  for (const r of [0.7, 0.8, 0.85, 0.9, 1.0]) {
    for (const L of [8.3, 8.5, 8.7, 9.0]) {
      for (const f of [1.0, 1.1, 1.25]) {
        const m = measure({ floorFriction: mu, radius: r, ropeLength: L, frequency: f });
        const tag = `mu=${mu} r=${r} L=${L} f=${f}`;
        rows.push(
          `${tag.padEnd(32)} score=${m.score.toFixed(3)} pur1=${m.purity.toFixed(2)} ` +
            `open=${m.open.toFixed(2)} contact=${(m.contact * 100).toFixed(0)}%` +
            (m.unstable ? " UNSTABLE" : ""),
        );
        best.push({ tag, score: m.score });
      }
    }
  }
}
rows.forEach((r) => console.log(r));
console.log("\n--- top 8 ---");
best
  .sort((a, b) => b.score - a.score)
  .slice(0, 8)
  .forEach((b) => console.log(`${b.tag}  ${b.score.toFixed(3)}`));
