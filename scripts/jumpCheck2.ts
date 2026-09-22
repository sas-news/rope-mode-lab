import { LongRopeSimulation } from "../src/simulation/LongRopeSimulation";
import { ModeAnalyzer } from "../src/analysis/ModeAnalyzer";
import { NodeDetector } from "../src/analysis/NodeDetector";
import { ClearanceTracker } from "../src/analysis/Clearance";
import { ParamSweep, SweepStage } from "../src/analysis/ParamSweep";
import { cloneConfig } from "../src/utils/config";
import { DEFAULT_CONFIG, SweepParamKey } from "../src/simulation/types";

/** Headless jump-metric optimizer run. */
const cfg = cloneConfig(DEFAULT_CONFIG);
cfg.optimizer.xKey = "frequency";
cfg.optimizer.xStart = 0.5;
cfg.optimizer.xEnd = 2.5;
cfg.optimizer.xSteps = 7;
cfg.optimizer.yKey = "radius";
cfg.optimizer.yStart = 0.3;
cfg.optimizer.yEnd = 0.9;
cfg.optimizer.ySteps = 5;
cfg.optimizer.fineSteps = 5;
cfg.optimizer.targetMode = 1;
cfg.optimizer.metric = "jump";
cfg.optimizer.coarseSettleTime = 1.2;
cfg.optimizer.coarseMeasureTime = 1.5;
cfg.optimizer.settleTime = 2.5;
cfg.optimizer.measureTime = 3;

const COARSE = { particleCount: 61, iterations: 14, physicsDt: 1 / 160 };
const sim = new LongRopeSimulation(cfg.sim);
const saved = {
  particleCount: cfg.sim.particleCount,
  iterations: cfg.sim.iterations,
  physicsDt: cfg.sim.physicsDt,
};
const analyzer = new ModeAnalyzer(sim.rope.count);
const nodes = new NodeDetector(sim.rope.count);
const jump = new ClearanceTracker(sim.rope.count);

function applyParam(key: SweepParamKey, v: number) {
  (cfg.sim as unknown as Record<string, number>)[key] = v;
  if (key === "ropeLength" || key === "particleCount" || key === "ropeMass") {
    sim.rebuild();
    analyzer.resize(sim.rope.count);
    nodes.resize(sim.rope.count);
    jump.resize(sim.rope.count);
  } else {
    sim.updateDrivers();
  }
}

cfg.sim.phaseDeg = ParamSweep.phaseForMode(cfg.optimizer.targetMode);
cfg.sim.separateFrequencies = false;
sim.updateDrivers();

const sw = new ParamSweep(cfg.optimizer);
sw.start({
  apply: applyParam,
  reset: () => {
    sim.reset();
    analyzer.reset();
    nodes.reset();
    jump.reset();
  },
  onStage: (st: SweepStage) => {
    const f = st === "coarse" ? COARSE : saved;
    applyParam("particleCount", f.particleCount);
    applyParam("iterations", f.iterations);
    applyParam("physicsDt", f.physicsDt);
  },
  onDone: () => {},
});

const t0 = performance.now();
const CHUNK = 0.05;
while (sw.running) {
  sim.advance(CHUNK);
  jump.update(sim.rope.positions, sim.rope.count, CHUNK);
  analyzer.update(sim.rope.positions, CHUNK, 6);
  nodes.update(analyzer.fluctMag, CHUNK, 0.42);
  sw.update(CHUNK, analyzer, nodes.nodes.length, jump);
  if (sim.unstable) sw.skipCell();
}
const wall = (performance.now() - t0) / 1000;
console.log(`wall: ${wall.toFixed(1)}s  coarse:${sw.coarseCells.length} fine:${sw.cells.length}`);

const show = (c: (typeof sw.cells)[number], tag: string) =>
  console.log(
    `${tag} f=${c.x.toFixed(2)} L=${c.y.toFixed(2)} a1=${c.amps[1]?.toFixed(2)} ` +
      `jump=${c.metric.toFixed(3)} clear=${c.clearance.toFixed(2)}m minY=${c.minY.toFixed(2)} contact=${(c.contactFrac * 100).toFixed(0)}% dom=${c.dominant}`,
  );

console.log("\n--- top 5 fine cells by jump ---");
[...sw.cells].sort((a, b) => b.metric - a.metric).slice(0, 5).forEach(c => show(c, " "));
console.log("\n--- bottom 3 fine cells ---");
[...sw.cells].sort((a, b) => a.metric - b.metric).slice(0, 3).forEach(c => show(c, " "));
const b = sw.bestCell()!;
show(b, "BEST");
