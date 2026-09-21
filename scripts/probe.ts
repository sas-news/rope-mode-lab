import { LongRopeSimulation } from "../src/simulation/LongRopeSimulation";
import { ModeAnalyzer } from "../src/analysis/ModeAnalyzer";
import { NodeDetector } from "../src/analysis/NodeDetector";
import { cloneConfig } from "../src/utils/config";
import { DEFAULT_CONFIG } from "../src/simulation/types";

for (const phase of [0, 180]) {
  console.log("--- phase", phase, "---");
  for (const f of [0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0, 3.4, 3.8]) {
    const cfg = cloneConfig(DEFAULT_CONFIG);
    cfg.sim.frequency = f;
    cfg.sim.phaseDeg = phase;
    cfg.sim.radius = 0.4;
    const sim = new LongRopeSimulation(cfg.sim);
    const an = new ModeAnalyzer(sim.rope.count);
    const det = new NodeDetector(sim.rope.count);
    const dt = 1 / 60;
    for (let k = 0; k < 60 * 14; k++) {
      sim.advance(dt);
      an.update(sim.rope.positions, dt, 6);
      det.update(an.fluctMag, dt, 0.42);
    }
    const amps = Array.from(an.amplitudes.slice(1, 7))
      .map((a) => a.toFixed(2))
      .join(" ");
    console.log(
      "f=" + f.toFixed(1),
      "amps:", amps,
      "dom:", an.dominant,
      "nodes:", det.nodes.length,
      "rms:", an.rms.toFixed(3),
      sim.unstable ? "UNSTABLE" : "",
    );
  }
}
