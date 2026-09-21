import { OptimizerConfig, SweepParamKey } from "../simulation/types";

/** Minimal structural view of ModeAnalyzer (also satisfied by test stubs). */
export interface Metrics {
  amplitudes: ArrayLike<number>;
  purities: ArrayLike<number>;
  dominant: number;
  rms: number;
  maxMode: number;
}

export interface GridCell {
  x: number;
  y: number;
  /** Time-averaged modal amplitudes (1-indexed). */
  amps: number[];
  purities: number[];
  /** Objective value the sweep optimises. */
  metric: number;
  dominant: number;
  rms: number;
  nodeCount: number;
}

export type ParamSweepState = "idle" | "settling" | "measuring" | "done";

/**
 * 2D grid search ("optimiser"): steps two sim parameters through ranges and
 * records the modal response at every cell. Each cell = settle + measure.
 */
export class ParamSweep {
  cfg: OptimizerConfig;
  state: ParamSweepState = "idle";
  cells: GridCell[] = [];
  ix = -1;
  iy = -1;
  stateTime = 0;
  progress = 0;

  private ampAcc: number[] = [];
  private purAcc: number[] = [];
  private domHits: number[] = [];
  private rmsAcc = 0;
  private nodeAcc = 0;
  private nodeSamples = 0;
  private n = 0;

  private apply: (key: SweepParamKey, v: number) => void = () => {};
  private reset: () => void = () => {};
  private onDone: () => void = () => {};

  constructor(cfg: OptimizerConfig) {
    this.cfg = cfg;
  }

  get xs(): number[] {
    return linspace(this.cfg.xStart, this.cfg.xEnd, this.cfg.xSteps);
  }
  get ys(): number[] {
    return linspace(this.cfg.yStart, this.cfg.yEnd, this.cfg.ySteps);
  }
  get totalCells(): number {
    return this.xs.length * this.ys.length;
  }
  get current(): { x: number; y: number } | null {
    if (this.ix < 0 || this.iy < 0) return null;
    return { x: this.xs[this.ix], y: this.ys[this.iy] };
  }

  start(
    apply: (key: SweepParamKey, v: number) => void,
    reset: () => void,
    onDone: () => void,
  ): void {
    if (this.cfg.xKey === this.cfg.yKey) return; // degenerate axis
    this.apply = apply;
    this.reset = reset;
    this.onDone = onDone;
    this.cells = [];
    this.ix = -1;
    this.iy = 0;
    this.state = "settling";
    this.stateTime = 0;
    this.progress = 0;
    this.advanceCell();
  }

  stop(): void {
    if (this.state === "idle" || this.state === "done") return;
    this.state = "done";
    this.onDone();
  }

  private advanceCell(): void {
    this.ix++;
    if (this.ix >= this.xs.length) {
      this.ix = 0;
      this.iy++;
    }
    if (this.iy >= this.ys.length) {
      this.state = "done";
      this.progress = 1;
      this.onDone();
      return;
    }
    if (this.cfg.resetEach) this.reset();
    this.apply(this.cfg.xKey, this.xs[this.ix]);
    this.apply(this.cfg.yKey, this.ys[this.iy]);
    this.state = "settling";
    this.stateTime = 0;
  }

  /** @param dt simulated seconds elapsed since last call */
  update(dt: number, m: Metrics, nodeCount: number): void {
    if (this.state === "idle" || this.state === "done") return;
    this.stateTime += dt;
    const per = this.cfg.settleTime + this.cfg.measureTime;
    const idx = this.iy * this.xs.length + this.ix;
    this.progress = Math.min(
      1,
      (idx * per + this.stateTime) / Math.max(this.totalCells * per, 1e-9),
    );

    if (this.state === "settling") {
      if (this.stateTime >= this.cfg.settleTime) {
        this.state = "measuring";
        this.stateTime = 0;
        this.ampAcc = new Array(m.maxMode + 1).fill(0);
        this.purAcc = new Array(m.maxMode + 1).fill(0);
        this.domHits = new Array(m.maxMode + 1).fill(0);
        this.rmsAcc = 0;
        this.nodeAcc = 0;
        this.nodeSamples = 0;
        this.n = 0;
      }
      return;
    }

    this.n++;
    this.rmsAcc += m.rms;
    if (nodeCount > 0) {
      this.nodeAcc += nodeCount;
      this.nodeSamples++;
    }
    const tm = Math.min(this.cfg.targetMode, m.maxMode);
    for (let k = 1; k <= m.maxMode; k++) {
      this.ampAcc[k] += m.amplitudes[k];
      this.purAcc[k] += m.purities[k];
    }
    if (m.dominant > 0) this.domHits[m.dominant]++;

    if (this.stateTime >= this.cfg.measureTime && this.n > 0) {
      const amps = this.ampAcc.map((v) => v / this.n);
      const purs = this.purAcc.map((v) => v / this.n);
      let dom = 0, best = -1;
      for (let k = 1; k <= m.maxMode; k++) {
        if (this.domHits[k] > best) {
          best = this.domHits[k];
          dom = k;
        }
      }
      this.cells.push({
        x: this.xs[this.ix],
        y: this.ys[this.iy],
        amps,
        purities: purs,
        metric: this.cfg.metric === "purity" ? purs[tm] : amps[tm],
        dominant: dom,
        rms: this.rmsAcc / this.n,
        nodeCount: this.nodeSamples > 0 ? this.nodeAcc / this.nodeSamples : 0,
      });
      this.advanceCell();
    }
  }

  /** Cell with the best objective value. */
  bestCell(): GridCell | null {
    let best: GridCell | null = null;
    for (const c of this.cells) {
      if (best === null || c.metric > best.metric) best = c;
    }
    return best;
  }
}

function linspace(a: number, b: number, n: number): number[] {
  const out: number[] = [];
  const k = Math.max(2, Math.round(n));
  for (let i = 0; i < k; i++) out.push(a + ((b - a) * i) / (k - 1));
  return out;
}
