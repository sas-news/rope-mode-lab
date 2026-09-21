import { ModeAnalyzer } from "./ModeAnalyzer";
import { SweepConfig } from "../simulation/types";

export interface SweepSample {
  freq: number;
  /** Time-averaged modal amplitudes (1-indexed). */
  amps: number[];
  /** Time-averaged modal purities (1-indexed). */
  purities: number[];
  /** Most frequently dominant mode during measurement. */
  dominant: number;
  rms: number;
  /** Average detected node count. */
  nodeCount: number;
}

export type SweepState = "idle" | "settling" | "measuring" | "done";

/**
 * Steps the drive frequency through a range, letting transients decay
 * (settleTime) before measuring modal response (measureTime).
 */
export class FrequencySweep {
  cfg: SweepConfig;
  state: SweepState = "idle";
  samples: SweepSample[] = [];
  currentFreq = 0;
  currentIndex = -1;
  stateTime = 0;
  /** Wall-time progress 0..1 for the UI. */
  progress = 0;

  private ampAcc: number[] = [];
  private purAcc: number[] = [];
  private rmsAcc = 0;
  private nodeAcc = 0;
  private nodeSamples = 0;
  private dominantHits: number[] = [];
  private measureSamples = 0;
  private setFrequency: (hz: number) => void = () => {};
  private onDone: () => void = () => {};

  constructor(cfg: SweepConfig) {
    this.cfg = cfg;
  }

  get frequencies(): number[] {
    const { startHz, endHz, steps } = this.cfg;
    const out: number[] = [];
    const n = Math.max(2, Math.round(steps));
    for (let i = 0; i < n; i++) out.push(startHz + ((endHz - startHz) * i) / (n - 1));
    return out;
  }

  start(setFrequency: (hz: number) => void, onDone: () => void): void {
    this.setFrequency = setFrequency;
    this.onDone = onDone;
    this.samples = [];
    this.currentIndex = -1;
    this.state = "settling";
    this.stateTime = 0;
    this.progress = 0;
    this.advanceFreq();
  }

  stop(): void {
    if (this.state === "done" || this.state === "idle") return;
    this.state = "done";
    this.onDone();
  }

  private advanceFreq(): void {
    const freqs = this.frequencies;
    this.currentIndex++;
    if (this.currentIndex >= freqs.length) {
      this.state = "done";
      this.onDone();
      return;
    }
    this.currentFreq = freqs[this.currentIndex];
    this.setFrequency(this.currentFreq);
    this.state = "settling";
    this.stateTime = 0;
  }

  /**
   * @param nodeCount current detected node count (0 if detection off)
   */
  update(dt: number, analyzer: ModeAnalyzer, nodeCount: number): void {
    if (this.state === "idle" || this.state === "done") return;
    this.stateTime += dt;
    const freqs = this.frequencies;
    const total =
      freqs.length * (this.cfg.settleTime + this.cfg.measureTime);
    this.progress = Math.min(
      1,
      (this.currentIndex * (this.cfg.settleTime + this.cfg.measureTime) +
        this.stateTime) / Math.max(total, 1e-9),
    );

    if (this.state === "settling") {
      if (this.stateTime >= this.cfg.settleTime) {
        this.state = "measuring";
        this.stateTime = 0;
        this.ampAcc = new Array(analyzer.maxMode + 1).fill(0);
        this.purAcc = new Array(analyzer.maxMode + 1).fill(0);
        this.dominantHits = new Array(analyzer.maxMode + 1).fill(0);
        this.rmsAcc = 0;
        this.nodeAcc = 0;
        this.nodeSamples = 0;
        this.measureSamples = 0;
      }
      return;
    }

    // measuring
    this.measureSamples++;
    this.rmsAcc += analyzer.rms;
    if (nodeCount > 0) {
      this.nodeAcc += nodeCount;
      this.nodeSamples++;
    }
    for (let m = 1; m <= analyzer.maxMode; m++) {
      this.ampAcc[m] += analyzer.amplitudes[m];
      this.purAcc[m] += analyzer.purities[m];
    }
    if (analyzer.dominant > 0) this.dominantHits[analyzer.dominant]++;

    if (this.stateTime >= this.cfg.measureTime && this.measureSamples > 0) {
      const s = this.measureSamples;
      let dom = 0, best = -1;
      for (let m = 1; m <= analyzer.maxMode; m++) {
        if (this.dominantHits[m] > best) {
          best = this.dominantHits[m];
          dom = m;
        }
      }
      this.samples.push({
        freq: this.currentFreq,
        amps: this.ampAcc.map((v) => v / s),
        purities: this.purAcc.map((v) => v / s),
        dominant: dom,
        rms: this.rmsAcc / s,
        nodeCount: this.nodeSamples > 0 ? this.nodeAcc / this.nodeSamples : 0,
      });
      this.advanceFreq();
    }
  }

  /** Best measured frequency for a target mode (by amplitude). */
  bestFrequency(mode: number): SweepSample | null {
    let best: SweepSample | null = null;
    for (const s of this.samples) {
      if (s.amps[mode] !== undefined && (best === null || s.amps[mode] > best.amps[mode])) {
        best = s;
      }
    }
    return best;
  }
}
