import { FrequencySweep } from "../analysis/FrequencySweep";

const COLORS = ["#8ab4ff", "#51e88a", "#ffb84d", "#ff6b8a", "#c08aff", "#5fd9e0"];

/** Draws the frequency-sweep result (modal amplitude vs drive frequency). */
export class SweepChart {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private infoEl: HTMLElement;

  constructor(root: HTMLElement, onClose: () => void) {
    this.el = document.createElement("div");
    this.el.className = "sweep-panel";
    this.el.style.display = "none";
    this.canvas = document.createElement("canvas");
    this.canvas.width = 360;
    this.canvas.height = 190;
    const head = document.createElement("div");
    head.className = "sweep-head";
    head.innerHTML = `<span>Frequency Sweep</span>`;
    const close = document.createElement("button");
    close.textContent = "✕";
    close.addEventListener("click", () => {
      this.el.style.display = "none";
      onClose();
    });
    head.appendChild(close);
    this.infoEl = document.createElement("div");
    this.infoEl.className = "sweep-info";
    this.el.append(head, this.canvas, this.infoEl);
    root.appendChild(this.el);
    this.ctx = this.canvas.getContext("2d")!;
  }

  get visible(): boolean {
    return this.el.style.display !== "none";
  }

  show(): void {
    this.el.style.display = "block";
  }

  draw(sweep: FrequencySweep, modes: number[]): void {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    const padL = 42, padR = 10, padT = 12, padB = 26;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(10,13,20,0.85)";
    ctx.fillRect(0, 0, W, H);
    const samples = sweep.samples;
    if (samples.length === 0) {
      this.infoEl.textContent = "";
      return;
    }
    this.show();

    const fMin = samples[0].freq;
    const fMax = samples[samples.length - 1].freq;
    let aMax = 0.01;
    for (const s of samples) {
      for (const m of modes) aMax = Math.max(aMax, s.amps[m] ?? 0);
    }
    const x = (f: number) => padL + ((f - fMin) / Math.max(fMax - fMin, 1e-9)) * (W - padL - padR);
    const y = (a: number) => H - padB - (a / aMax) * (H - padT - padB);

    // axes
    ctx.strokeStyle = "#2a3350";
    ctx.strokeRect(padL, padT, W - padL - padR, H - padT - padB);
    ctx.fillStyle = "#66739a";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    for (let i = 0; i <= 4; i++) {
      const f = fMin + ((fMax - fMin) * i) / 4;
      ctx.fillText(f.toFixed(1), x(f), H - 10);
    }
    ctx.textAlign = "right";
    for (let i = 0; i <= 3; i++) {
      const a = (aMax * i) / 3;
      ctx.fillText(a.toFixed(2), padL - 4, y(a) + 3);
    }
    ctx.textAlign = "left";

    // curves
    for (const m of modes) {
      ctx.strokeStyle = COLORS[(m - 1) % COLORS.length];
      ctx.lineWidth = m === sweep.cfg.targetMode ? 2.2 : 1.2;
      ctx.beginPath();
      samples.forEach((s, i) => {
        const px = x(s.freq), py = y(s.amps[m] ?? 0);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      });
      ctx.stroke();
      // legend
      ctx.fillStyle = COLORS[(m - 1) % COLORS.length];
      ctx.fillText(`n=${m}`, padL + 6 + (m - 1) * 30, padT + 8);
    }
    ctx.lineWidth = 1;

    // best marker
    const best = sweep.bestFrequency(sweep.cfg.targetMode);
    if (best) {
      ctx.strokeStyle = "#ffffff";
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x(best.freq), padT);
      ctx.lineTo(x(best.freq), H - padB);
      ctx.stroke();
      ctx.setLineDash([]);
      const tm = sweep.cfg.targetMode;
      this.infoEl.textContent =
        `Best mode ${tm}: ${best.freq.toFixed(2)} Hz · ` +
        `amp ${best.amps[tm]?.toFixed(3) ?? "0"} m · ` +
        `purity ${((best.purities[tm] ?? 0) * 100).toFixed(1)}% · ` +
        `nodes≈${best.nodeCount.toFixed(1)}`;
    }
  }
}
