import { ModeAnalyzer } from "../analysis/ModeAnalyzer";

const MODE_COLORS = [
  "#8ab4ff", "#51e88a", "#ffb84d", "#ff6b8a", "#c08aff", "#5fd9e0",
  "#e0e05f", "#ff9a5f",
];

/** Canvas bar chart of the modal spectrum. */
export class ModeSpectrum {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(width = 252, height = 132) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.className = "spectrum";
    this.ctx = this.canvas.getContext("2d")!;
  }

  draw(an: ModeAnalyzer, maxMode: number): void {
    const { ctx, canvas } = this;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(10,13,20,0.72)";
    ctx.fillRect(0, 0, W, H);

    const m = Math.min(maxMode, an.maxMode);
    const rowH = Math.min(18, (H - 20) / m);
    const barW = W - 86;
    const scaleMax = Math.max(0.15, ...Array.from(an.amplitudes.slice(1, m + 1)));

    ctx.font = "11px 'SF Mono', Consolas, monospace";
    ctx.textBaseline = "middle";
    for (let i = 1; i <= m; i++) {
      const y = 8 + (i - 1) * rowH + rowH / 2;
      const a = an.amplitudes[i];
      const w = Math.max(1.5, (a / scaleMax) * barW);
      const isDom = i === an.dominant;
      ctx.fillStyle = isDom ? MODE_COLORS[(i - 1) % 8] : "rgba(120,140,190,0.5)";
      ctx.fillRect(38, y - rowH * 0.32, w, rowH * 0.64);
      ctx.fillStyle = isDom ? "#eaf0ff" : "#7f8db3";
      ctx.fillText(`n=${i}`, 6, y);
      ctx.fillStyle = isDom ? "#dfe7ff" : "#66739a";
      ctx.textAlign = "right";
      ctx.fillText(`${a.toFixed(2)}m`, W - 4, y);
      ctx.textAlign = "left";
    }

    const dom = an.dominant;
    const purity = dom > 0 ? an.purities[dom] : 0;
    ctx.fillStyle = "#9fb4e8";
    ctx.fillText(
      dom > 0
        ? `dominant: mode ${dom}  purity ${(purity * 100).toFixed(0)}%`
        : "dominant: —",
      6,
      H - 8,
    );
  }
}
