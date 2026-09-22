import { describe, expect, it } from "vitest";
import { Metrics, ParamSweep } from "../src/analysis/ParamSweep";
import { OptimizerConfig, SweepParamKey } from "../src/simulation/types";

const cfg: OptimizerConfig = {
  xKey: "frequency",
  yKey: "radius",
  xStart: 0.5,
  xEnd: 1.5,
  xSteps: 3,
  yStart: 0.2,
  yEnd: 0.6,
  ySteps: 2,
  fineSteps: 3,
  settleTime: 0.1,
  measureTime: 0.2,
  coarseSettleTime: 0.05,
  coarseMeasureTime: 0.1,
  targetMode: 2,
  metric: "amp",
  resetEach: true,
};

/** Fake metrics whose mode-2 amplitude encodes the applied params. */
function makeStub(current: Map<SweepParamKey, number>): Metrics {
  const a = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  // metric = x + y so the best cell is the max-x/max-y corner
  a[2] = (current.get("frequency") ?? 0) + (current.get("radius") ?? 0);
  return {
    amplitudes: a,
    purities: [0, 0, 1, 0, 0, 0, 0, 0, 0],
    dominant: 2,
    rms: 0.1,
    maxMode: 6,
  };
}

describe("ParamSweep (coarse→fine)", () => {
  it("fixes drive phase by mode parity", () => {
    expect(ParamSweep.phaseForMode(1)).toBe(0);
    expect(ParamSweep.phaseForMode(3)).toBe(0);
    expect(ParamSweep.phaseForMode(5)).toBe(0);
    expect(ParamSweep.phaseForMode(2)).toBe(180);
    expect(ParamSweep.phaseForMode(4)).toBe(180);
  });

  it("runs coarse then fine stages and zooms around the best cell", () => {
    const current = new Map<SweepParamKey, number>();
    const stages: string[] = [];
    const sw = new ParamSweep(cfg);
    let done = false;
    sw.start({
      apply: (k, v) => current.set(k, v),
      reset: () => {},
      onStage: (s) => stages.push(s),
      onDone: () => (done = true),
    });
    for (let i = 0; i < 2000 && !done; i++) {
      sw.update(0.05, makeStub(current), 1);
    }

    expect(done).toBe(true);
    expect(stages).toEqual(["coarse", "fine"]);
    // coarse: 3 x × 2 y = 6 cells
    expect(sw.coarseCells.length).toBe(6);
    // fine: 3 × 3 = 9 cells
    expect(sw.cells.length).toBe(9);
    // coarse best was the max corner (1.5, 0.6) → fine zooms near it
    const best = sw.bestCell()!;
    expect(best.x).toBeCloseTo(1.5);
    expect(best.y).toBeCloseTo(0.6);
    // zoom window: ± one coarse spacing (x:1.0..1.5clamped, y:0.2..0.6clamped)
    expect(Math.min(...sw.xs)).toBeGreaterThanOrEqual(1.0 - 1e-9);
    expect(Math.max(...sw.xs)).toBeLessThanOrEqual(1.5 + 1e-9);
    expect(Math.min(...sw.ys)).toBeGreaterThanOrEqual(0.2 - 1e-9);
    expect(Math.max(...sw.ys)).toBeLessThanOrEqual(0.6 + 1e-9);
    expect(sw.progress).toBeCloseTo(1);
  });

  it("stop() ends early and reports progress < 1", () => {
    const current = new Map<SweepParamKey, number>();
    const sw = new ParamSweep(cfg);
    sw.start({
      apply: (k, v) => current.set(k, v),
      reset: () => {},
      onStage: () => {},
      onDone: () => {},
    });
    for (let i = 0; i < 10; i++) sw.update(0.05, makeStub(current), 0);
    sw.stop();
    expect(sw.state).toBe("done");
    expect(sw.progress).toBeLessThan(1);
    expect(sw.cells.length).toBeLessThan(6);
  });

  it("refuses to start with identical axes", () => {
    const bad = { ...cfg, yKey: "frequency" as SweepParamKey };
    const sw = new ParamSweep(bad);
    sw.start({
      apply: () => {},
      reset: () => {},
      onStage: () => {},
      onDone: () => {},
    });
    expect(sw.state).toBe("idle");
  });

  it("skipCell records a failed cell and continues", () => {
    const current = new Map<SweepParamKey, number>();
    const sw = new ParamSweep(cfg);
    let done = false;
    sw.start({
      apply: (k, v) => current.set(k, v),
      reset: () => {},
      onStage: () => {},
      onDone: () => (done = true),
    });
    sw.skipCell(); // fails the first coarse cell
    for (let i = 0; i < 2000 && !done; i++) {
      sw.update(0.05, makeStub(current), 1);
    }
    expect(done).toBe(true);
    expect(sw.coarseCells.length).toBe(6);
    expect(sw.coarseCells[0].metric).toBe(-Infinity);
  });
});
