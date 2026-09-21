import { describe, expect, it } from "vitest";
import { Metrics, ParamSweep } from "../src/analysis/ParamSweep";
import { OptimizerConfig, SweepParamKey } from "../src/simulation/types";

const cfg: OptimizerConfig = {
  xKey: "frequency",
  yKey: "phaseDeg",
  xStart: 0.5,
  xEnd: 1.5,
  xSteps: 3,
  yStart: 0,
  yEnd: 90,
  ySteps: 2,
  settleTime: 0.1,
  measureTime: 0.2,
  targetMode: 2,
  metric: "amp",
  resetEach: true,
};

/** Fake metrics whose mode-2 amplitude encodes the applied params. */
function makeStub(current: Map<SweepParamKey, number>): Metrics {
  const a = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  // metric = x + y/1000 so the best cell is the max-x/max-y corner
  a[2] = (current.get("frequency") ?? 0) + (current.get("phaseDeg") ?? 0) / 1000;
  return {
    amplitudes: a,
    purities: [0, 0, 1, 0, 0, 0, 0, 0, 0],
    dominant: 2,
    rms: 0.1,
    maxMode: 6,
  };
}

describe("ParamSweep", () => {
  it("walks the whole grid and finds the best cell", () => {
    const current = new Map<SweepParamKey, number>();
    const applied: string[] = [];
    let resets = 0;
    let done = false;
    const sw = new ParamSweep(cfg);
    sw.start(
      (k, v) => {
        current.set(k, v);
        applied.push(`${k}=${v}`);
      },
      () => resets++,
      () => (done = true),
    );

    for (let i = 0; i < 200 && !done; i++) {
      sw.update(0.05, makeStub(current), 1);
    }

    expect(done).toBe(true);
    expect(sw.state).toBe("done");
    expect(sw.cells.length).toBe(6); // 3 x-values × 2 y-values
    expect(resets).toBe(6); // resetEach -> one reset per cell
    // first cell applies both axes
    expect(applied[0]).toBe("frequency=0.5");
    expect(applied[1]).toBe("phaseDeg=0");

    const best = sw.bestCell()!;
    expect(best.x).toBeCloseTo(1.5);
    expect(best.y).toBeCloseTo(90);
    expect(best.metric).toBeCloseTo(1.5 + 0.09, 3);
    expect(sw.progress).toBeCloseTo(1);
  });

  it("stop() ends early and reports progress < 1", () => {
    const current = new Map<SweepParamKey, number>();
    const sw = new ParamSweep(cfg);
    sw.start((k, v) => current.set(k, v), () => {}, () => {});
    for (let i = 0; i < 10; i++) sw.update(0.05, makeStub(current), 0);
    sw.stop();
    expect(sw.state).toBe("done");
    expect(sw.progress).toBeLessThan(1);
    expect(sw.cells.length).toBeLessThan(6);
  });

  it("refuses to start with identical axes", () => {
    const bad = { ...cfg, yKey: "frequency" as SweepParamKey };
    const sw = new ParamSweep(bad);
    sw.start(() => {}, () => {}, () => {});
    expect(sw.state).toBe("idle");
  });
});
