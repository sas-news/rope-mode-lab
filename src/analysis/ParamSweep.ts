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
export type SweepStage = "coarse" | "fine";

export interface ParamSweepCallbacks {
  apply: (key: SweepParamKey, v: number) => void;
  reset: () => void;
  /** Fired when the sweep switches fidelity stages. */
  onStage: (stage: SweepStage) => void;
  onDone: () => void;
}

/**
 * Two-stage 2D grid search. The coarse stage walks the whole configured
 * range at reduced fidelity (fewer particles / iterations, short timing);
 * the fine stage then re-measures a zoomed window around the best coarse
 * cell at full fidelity. Drive phase is not a sweep axis — it is fixed by
 * the target mode's parity (see phaseForMode).
 */
export class ParamSweep {
  cfg: OptimizerConfig;
  state: ParamSweepState = "idle";
  stage: SweepStage = "coarse";
  /** Cells of the *active* stage (coarse during stage 1, fine during 2). */
  cells: GridCell[] = [];
  /** Completed coarse-grid cells, kept for reference. */
  coarseCells: GridCell[] = [];
  ix = -1;
  iy = -1;
  stateTime = 0;
  progress = 0;

  private xsV: number[] = [];
  private ysV: number[] = [];
  private doneWork = 0;

  private ampAcc: number[] = [];
  private purAcc: number[] = [];
  private domHits: number[] = [];
  private rmsAcc = 0;
  private nodeAcc = 0;
  private nodeSamples = 0;
  private n = 0;

  private apply: (key: SweepParamKey, v: number) => void = () => {};
  private reset: () => void = () => {};
  private onStage: (stage: SweepStage) => void = () => {};
  private onDone: () => void = () => {};

  constructor(cfg: OptimizerConfig) {
    this.cfg = cfg;
  }

  /**
   * Phase difference that can excite mode n: odd modes are symmetric and
   * need in-phase drive (0°), even modes are antisymmetric and need
   * counter-phase drive (180°). Sweeping phase cannot beat this pairing.
   */
  static phaseForMode(n: number): number {
    return n % 2 === 1 ? 0 : 180;
  }

  get xs(): number[] {
    return this.xsV;
  }
  get ys(): number[] {
    return this.ysV;
  }
  /** Cells in the active stage's grid. */
  get totalCells(): number {
    return this.xsV.length * this.ysV.length;
  }
  get current(): { x: number; y: number } | null {
    if (this.ix < 0 || this.iy < 0) return null;
    return { x: this.xsV[this.ix], y: this.ysV[this.iy] };
  }
  get running(): boolean {
    return this.state === "settling" || this.state === "measuring";
  }

  private stageTiming(): [number, number] {
    return this.stage === "coarse"
      ? [this.cfg.coarseSettleTime, this.cfg.coarseMeasureTime]
      : [this.cfg.settleTime, this.cfg.measureTime];
  }

  /** Total sim-seconds of work planned (both stages, all cells). */
  private totalWork(): number {
    const c = this.cfg;
    const [cs, cm] = [c.coarseSettleTime, c.coarseMeasureTime];
    return (
      c.xSteps * c.ySteps * (cs + cm) +
      c.fineSteps * c.fineSteps * (c.settleTime + c.measureTime)
    );
  }

  start(cb: ParamSweepCallbacks): void {
    if (this.cfg.xKey === this.cfg.yKey) return; // degenerate axis
    this.apply = cb.apply;
    this.reset = cb.reset;
    this.onStage = cb.onStage;
    this.onDone = cb.onDone;
    this.cells = [];
    this.coarseCells = [];
    this.doneWork = 0;
    this.progress = 0;
    this.stage = "coarse";
    this.xsV = linspace(this.cfg.xStart, this.cfg.xEnd, this.cfg.xSteps);
    this.ysV = linspace(this.cfg.yStart, this.cfg.yEnd, this.cfg.ySteps);
    this.onStage("coarse");
    this.ix = -1;
    this.iy = 0;
    this.state = "settling";
    this.stateTime = 0;
    this.advanceCell();
  }

  stop(): void {
    if (!this.running) return;
    this.state = "done";
    this.onDone();
  }

  /** Records a failed cell (e.g. solver went unstable) and moves on. */
  skipCell(): void {
    if (!this.running) return;
    this.pushCell([], [], 0, -Infinity, 0, 0);
    this.advanceCell();
  }

  private pushCell(
    amps: number[],
    purities: number[],
    dominant: number,
    metric: number,
    rms: number,
    nodeCount: number,
  ): void {
    this.cells.push({
      x: this.xsV[this.ix],
      y: this.ysV[this.iy],
      amps,
      purities,
      metric,
      dominant,
      rms,
      nodeCount,
    });
    const [s, m] = this.stageTiming();
    this.doneWork += s + m;
  }

  private advanceCell(): void {
    this.ix++;
    if (this.ix >= this.xsV.length) {
      this.ix = 0;
      this.iy++;
    }
    if (this.iy >= this.ysV.length) {
      if (this.stage === "coarse") {
        this.beginFineStage();
        return;
      }
      this.finish();
      return;
    }
    if (this.cfg.resetEach) this.reset();
    this.apply(this.cfg.xKey, this.xsV[this.ix]);
    this.apply(this.cfg.yKey, this.ysV[this.iy]);
    this.state = "settling";
    this.stateTime = 0;
  }

  /** Zooms around the best coarse cell and re-runs at full fidelity. */
  private beginFineStage(): void {
    this.coarseCells = this.cells;
    this.cells = [];
    const best = bestOf(this.coarseCells);
    if (!best) {
      this.finish();
      return;
    }
    const sx =
      this.xsV.length > 1
        ? Math.abs(this.xsV[this.xsV.length - 1] - this.xsV[0]) /
          (this.xsV.length - 1)
        : 1;
    const sy =
      this.ysV.length > 1
        ? Math.abs(this.ysV[this.ysV.length - 1] - this.ysV[0]) /
          (this.ysV.length - 1)
        : 1;
    // Window = best cell ± one coarse spacing, clamped to the scan range.
    const xLo = Math.min(this.cfg.xStart, this.cfg.xEnd);
    const xHi = Math.max(this.cfg.xStart, this.cfg.xEnd);
    const yLo = Math.min(this.cfg.yStart, this.cfg.yEnd);
    const yHi = Math.max(this.cfg.yStart, this.cfg.yEnd);
    const x0 = clamp(best.x - sx, xLo, xHi);
    const x1 = clamp(best.x + sx, xLo, xHi);
    const y0 = clamp(best.y - sy, yLo, yHi);
    const y1 = clamp(best.y + sy, yLo, yHi);

    this.stage = "fine";
    this.xsV = linspace(x0, x1, this.cfg.fineSteps);
    this.ysV = linspace(y0, y1, this.cfg.fineSteps);
    this.onStage("fine");
    this.ix = -1;
    this.iy = 0;
    this.advanceCell();
  }

  private finish(): void {
    this.state = "done";
    this.progress = 1;
    this.onDone();
  }

  /** @param dt simulated seconds elapsed since last call */
  update(dt: number, m: Metrics, nodeCount: number): void {
    if (!this.running) return;
    this.stateTime += dt;
    const [settle, measure] = this.stageTiming();
    this.progress = Math.min(
      1,
      (this.doneWork + Math.min(this.stateTime, settle + measure)) /
        Math.max(this.totalWork(), 1e-9),
    );

    if (this.state === "settling") {
      if (this.stateTime >= settle) {
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

    if (this.stateTime >= measure && this.n > 0) {
      const amps = this.ampAcc.map((v) => v / this.n);
      const purs = this.purAcc.map((v) => v / this.n);
      let dom = 0, best = -1;
      for (let k = 1; k <= m.maxMode; k++) {
        if (this.domHits[k] > best) {
          best = this.domHits[k];
          dom = k;
        }
      }
      this.pushCell(
        amps,
        purs,
        dom,
        this.cfg.metric === "purity" ? purs[tm] : amps[tm],
        this.rmsAcc / this.n,
        this.nodeSamples > 0 ? this.nodeAcc / this.nodeSamples : 0,
      );
      this.advanceCell();
    }
  }

  /**
   * Cell with the best objective value. Once fine-stage cells exist they
   * take precedence — they were measured at full fidelity.
   */
  bestCell(): GridCell | null {
    if (this.cells.length > 0) return bestOf(this.cells);
    return bestOf(this.coarseCells);
  }
}

function bestOf(cells: GridCell[]): GridCell | null {
  let best: GridCell | null = null;
  for (const c of cells) {
    if (best === null || c.metric > best.metric) best = c;
  }
  return best;
}

function linspace(a: number, b: number, n: number): number[] {
  const out: number[] = [];
  const k = Math.max(2, Math.round(n));
  for (let i = 0; i < k; i++) out.push(a + ((b - a) * i) / (k - 1));
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
