import { LongRopeSimulation } from "../src/simulation/LongRopeSimulation";
import { ModeAnalyzer } from "../src/analysis/ModeAnalyzer";
import { NodeDetector } from "../src/analysis/NodeDetector";
import { ParamSweep, SweepStage } from "../src/analysis/ParamSweep";
import { cloneConfig } from "../src/utils/config";
import { DEFAULT_CONFIG, SweepParamKey } from "../src/simulation/types";

/**
 * Headless replica of the app's optimizer loop: same two-stage sweep,
 * same fidelity swap, wall-clock timed.
 */
const cfg = cloneConfig(DEFAULT_CONFIG);
cfg.optimizer.xKey = "frequency";
cfg.optimizer.xStart = 0.6;
cfg.optimizer.xEnd = 4.0;
cfg.optimizer.xSteps = 7;
cfg.optimizer.yKey = "handleDistance";
cfg.optimizer.yStart = 6.0;
cfg.optimizer.yEnd = 8.5;
cfg.optimizer.ySteps = 5;
cfg.optimizer.fineSteps = 5;
cfg.optimizer.targetMode = 2; // → phase auto 180°
cfg.optimizer.metric = "amp";
cfg.optimizer.coarseSettleTime = 1.0;
cfg.optimizer.coarseMeasureTime = 1.2;
cfg.optimizer.settleTime = 2.0;
cfg.optimizer.measureTime = 2.5;

const COARSE = { particleCount: 61, iterations: 14, physicsDt: 1 / 160 };
const sim = new LongRopeSimulation(cfg.sim);
const saved = {
  particleCount: cfg.sim.particleCount,
  iterations: cfg.sim.iterations,
  physicsDt: cfg.sim.physicsDt,
};
const analyzer = new ModeAnalyzer(sim.rope.count);
const nodes = new NodeDetector(sim.rope.count);

function applyParam(key: SweepParamKey, v: number) {
  (cfg.sim as unknown as Record<string, number>)[key] = v;
  if (key === "ropeLength" || key === "particleCount" || key === "ropeMass") {
    sim.rebuild();
    analyzer.resize(sim.rope.count);
    nodes.resize(sim.rope.count);
  } else {
    sim.updateDrivers();
  }
}

// phase auto-fix by parity
cfg.sim.phaseDeg = ParamSweep.phaseForMode(cfg.optimizer.targetMode);
cfg.sim.separateFrequencies = false;
sim.updateDrivers();

const sw = new ParamSweep(cfg.optimizer);
let stages: SweepStage[] = [];
sw.start({
  apply: applyParam,
  reset: () => {
    sim.reset();
    analyzer.reset();
    nodes.reset();
  },
  onStage: (st) => {
    stages.push(st);
    const f = st === "coarse" ? COARSE : saved;
    applyParam("particleCount", f.particleCount);
    applyParam("iterations", f.iterations);
    applyParam("physicsDt", f.physicsDt);
  },
  onDone: () => {},
});

const t0 = performance.now();
let simSeconds = 0;
const CHUNK = 0.05;
while (sw.running) {
  sim.advance(CHUNK);
  simSeconds += CHUNK;
  const pos = sim.rope.positions;
  analyzer.update(pos, CHUNK, 6);
  nodes.update(analyzer.fluctMag, CHUNK, 0.42);
  sw.update(CHUNK, analyzer, nodes.nodes.length);
  if (sim.unstable) sw.skipCell();
}
const wall = (performance.now() - t0) / 1000;

console.log(`stages: ${stages.join(" → ")}`);
console.log(`coarse cells: ${sw.coarseCells.length}, fine cells: ${sw.cells.length}`);
console.log(`sim-seconds: ${simSeconds.toFixed(0)}  wall: ${wall.toFixed(1)}s  (${(simSeconds / wall).toFixed(1)}× real-time)`);
const b = sw.bestCell()!;
console.log(
  `best: ${cfg.optimizer.xKey}=${b.x.toFixed(2)} ${cfg.optimizer.yKey}=${b.y.toFixed(2)} ` +
    `→ mode2 amp=${b.metric.toFixed(3)}m dom=${b.dominant} nodes=${b.nodeCount.toFixed(1)}`,
);
console.log("fine grid xs:", sw.xs.map(v => v.toFixed(2)).join(", "));
console.log("fine grid ys:", sw.ys.map(v => v.toFixed(2)).join(", "));
// top-3 fine cells
const top = [...sw.cells].sort((p, q) => q.metric - p.metric).slice(0, 3);
for (const c of top) {
  console.log(`  f=${c.x.toFixed(2)} d=${c.y.toFixed(2)} a2=${c.amps[2]?.toFixed(3)} dom=${c.dominant}`);
}
