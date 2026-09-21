export interface HistorySample {
  t: number;
  freqL: number;
  freqR: number;
  dominant: number;
  purity: number;
  nodeCount: number;
  loops: number;
  rms: number;
}

/** Ring-buffer history of high-level metrics, exportable as CSV. */
export class History {
  samples: HistorySample[] = [];
  enabled = false;
  private timer = 0;
  private readonly interval = 0.1;
  private readonly cap = 60000;

  reset(): void {
    this.samples = [];
    this.timer = 0;
  }

  push(dt: number, s: HistorySample): void {
    if (!this.enabled) return;
    this.timer += dt;
    if (this.timer < this.interval) return;
    this.timer = 0;
    if (this.samples.length >= this.cap) this.samples.shift();
    this.samples.push(s);
  }

  toCSV(): string {
    const head = "t,freqL,freqR,dominantMode,purity,nodeCount,loops,rms";
    const rows = this.samples.map(
      (s) =>
        `${s.t.toFixed(2)},${s.freqL.toFixed(3)},${s.freqR.toFixed(3)},` +
        `${s.dominant},${s.purity.toFixed(4)},${s.nodeCount},${s.loops},${s.rms.toFixed(4)}`,
    );
    return [head, ...rows].join("\n");
  }
}
