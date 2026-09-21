import { LongRopeSimulation } from "../src/simulation/LongRopeSimulation";
import { ModeAnalyzer } from "../src/analysis/ModeAnalyzer";
import { NodeDetector } from "../src/analysis/NodeDetector";
import { cloneConfig } from "../src/utils/config";
import { DEFAULT_CONFIG } from "../src/simulation/types";

interface Res {
  phase: number;
  f: number;
  radius: number;
  mass: number;
  dom: number;
  a3: number;
  p3: number;
  a1: number;
  nodes: number;
  unstable: boolean;
}

const results: Res[] = [];
const t0 = Date.now();

for (const phase of [0, 60, 120, 180]) {
  for (const mass of [1.2, 2.5]) {
    for (const radius of [0.2, 0.4]) {
      for (const f of [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5]) {
        const cfg = cloneConfig(DEFAULT_CONFIG);
        cfg.sim.frequency = f;
        cfg.sim.phaseDeg = phase;
        cfg.sim.radius = radius;
        cfg.sim.ropeMass = mass;
        cfg.sim.damping = 0.15;
        const sim = new LongRopeSimulation(cfg.sim);
        const an = new ModeAnalyzer(sim.rope.count);
        const det = new NodeDetector(sim.rope.count);
        const dt = 1 / 60;
        for (let k = 0; k < 60 * 11; k++) {
          sim.advance(dt);
          an.update(sim.rope.positions, dt, 6);
          det.update(an.fluctMag, dt, 0.42);
        }
        results.push({
          phase, f, radius, mass,
          dom: an.dominant,
          a3: an.amplitudes[3],
          p3: an.purities[3],
          a1: an.amplitudes[1],
          nodes: det.nodes.length,
          unstable: sim.unstable,
        });
      }
    }
  }
  console.log(`phase ${phase} done (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}

// Best by mode-3 purity and by mode-3 amplitude
const byP3 = [...results].sort((a, b) => b.p3 - a.p3).slice(0, 10);
const byA3 = [...results].sort((a, b) => b.a3 - a.a3).slice(0, 10);
const dom3 = results.filter((r) => r.dom === 3);

console.log("\n=== runs where dominant == 3 ===");
for (const r of dom3) console.log(JSON.stringify(r));
console.log("\n=== top 10 by mode-3 purity ===");
for (const r of byP3)
  console.log(`ph=${r.phase} f=${r.f} R=${r.radius} m=${r.mass} p3=${r.p3.toFixed(2)} a3=${r.a3.toFixed(2)} a1=${r.a1.toFixed(2)} dom=${r.dom} nodes=${r.nodes}`);
console.log("\n=== top 10 by mode-3 amplitude ===");
for (const r of byA3)
  console.log(`ph=${r.phase} f=${r.f} R=${r.radius} m=${r.mass} p3=${r.p3.toFixed(2)} a3=${r.a3.toFixed(2)} a1=${r.a1.toFixed(2)} dom=${r.dom} nodes=${r.nodes}`);
