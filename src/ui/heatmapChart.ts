import { ParamSweep } from "../analysis/ParamSweep";
import { SweepParamKey } from "../simulation/types";

export const PARAM_LABELS: Record<SweepParamKey, string> = {
  frequency: "Freq Hz",
  phaseDeg: "Phase °",
  radius: "Radius m",
  damping: "Damping",
  airDrag: "AirDrag",
  ropeMass: "Mass kg",
  ropeLength: "RopeLen m",
  handleDistance: "Handles m",
  handleHeight: "Height m",
  gravity: "Gravity",
  bendingStiffness: "BendStiff",
  compliance: "Compliance",
  particleCount: "Particles",
  iterations: "Iterations",
};

/** Inferno-ish colour map t∈[0,1] -> css rgb. */
function heat(t: number): string {
  const stops = [
    [13, 8, 35],
    [80, 18, 90],
    [185, 50, 80],
    [245, 110, 40],
    [252, 210, 90],
    [252, 255, 200],
  ];
  const x = Math.min(0.9999, Math.max(0, t)) * (stops.length - 1);
  const i = Math.floor(x);
  const f = x - i;
  const a = stops[i], b = stops[i + 1];
  const r = Math.round(a[0] + (b[0] - a[0]) * f);
  const g = Math.round(a[1] + (b[1] - a[1]) * f);
  const bl = Math.round(a[2] + (b[2] - a[2]) * f);
  return `rgb(${r},${g},${bl})`;
}

/** Heatmap panel for the 2D parameter sweep. Click a cell to apply it. */
export class HeatmapChart {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private infoEl: HTMLElement;
  private sweep: ParamSweep | null = null;

  constructor(
    root: HTMLElement,
    onClose: () => void,
    private onPickCell: (x: number, y: number) => void,
  ) {
    this.el = document.createElement("div");
    this.el.className = "sweep-panel";
    this.el.style.display = "none";
    this.canvas = document.createElement("canvas");
    this.canvas.width = 380;
    this.canvas.height = 260;
    this.canvas.style.cursor = "crosshair";
    const head = document.createElement("div");
    head.className = "sweep-head";
    head.innerHTML = `<span>Parameter Optimizer</span>`;
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

    this.canvas.addEventListener("click", (e) => {
      if (!this.sweep) return;
      const cell = this.cellFromEvent(e);
      if (cell) this.onPickCell(cell.x, cell.y);
    });
  }

  show(): void {
    this.el.style.display = "block";
  }

  private layout() {
    return { padL: 52, padR: 14, padT: 14, padB: 34, W: this.canvas.width, H: this.canvas.height };
  }

  private cellFromEvent(e: MouseEvent): { x: number; y: number } | null {
    const s = this.sweep!;
    const { padL, padR, padT, padB, W, H } = this.layout();
    const rect = this.canvas.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * this.canvas.width;
    const py = ((e.clientY - rect.top) / rect.height) * this.canvas.height;
    const cw = (W - padL - padR) / s.xs.length;
    const ch = (H - padT - padB) / s.ys.length;
    const ix = Math.floor((px - padL) / cw);
    const iy = Math.floor((py - padT) / ch);
    if (ix < 0 || iy < 0 || ix >= s.xs.length || iy >= s.ys.length) return null;
    return { x: s.xs[ix], y: s.ys[iy] };
  }

  draw(sweep: ParamSweep): void {
    this.sweep = sweep;
    const { ctx } = this;
    const { padL, padR, padT, padB, W, H } = this.layout();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "rgba(10,13,20,0.9)";
    ctx.fillRect(0, 0, W, H);
    if (sweep.cells.length === 0) {
      this.show();
      return;
    }
    this.show();

    const xs = sweep.xs, ys = sweep.ys;
    const cw = (W - padL - padR) / xs.length;
    const ch = (H - padT - padB) / ys.length;

    // map cell -> metric
    const map = new Map<string, number>();
    let max = 1e-9;
    for (const c of sweep.cells) {
      map.set(`${c.x}|${c.y}`, c.metric);
      if (c.metric > max) max = c.metric;
    }

    for (let iy = 0; iy < ys.length; iy++) {
      for (let ix = 0; ix < xs.length; ix++) {
        const v = map.get(`${xs[ix]}|${ys[iy]}`);
        ctx.fillStyle =
          v === undefined
            ? "rgba(30,36,55,0.6)"
            : heat(v / max);
        ctx.fillRect(padL + ix * cw, padT + iy * ch, cw - 1, ch - 1);
      }
    }

    // best marker
    const best = sweep.bestCell();
    if (best) {
      const bx = xs.indexOf(best.x), by = ys.indexOf(best.y);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.strokeRect(padL + bx * cw, padT + by * ch, cw - 1, ch - 1);
      ctx.lineWidth = 1;
    }

    // axis ticks
    ctx.fillStyle = "#66739a";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";
    const nx = Math.min(5, xs.length);
    for (let i = 0; i < nx; i++) {
      const ix = Math.round((i * (xs.length - 1)) / Math.max(nx - 1, 1));
      ctx.fillText(fmt(xs[ix]), padL + (ix + 0.5) * cw, H - 20);
    }
    ctx.textAlign = "right";
    const ny = Math.min(5, ys.length);
    for (let i = 0; i < ny; i++) {
      const iy = Math.round((i * (ys.length - 1)) / Math.max(ny - 1, 1));
      ctx.fillText(fmt(ys[iy]), padL - 5, padT + (iy + 0.5) * ch + 3);
    }
    ctx.textAlign = "center";
    ctx.fillStyle = "#9fb4e8";
    ctx.fillText(PARAM_LABELS[sweep.cfg.xKey], padL + (W - padL - padR) / 2, H - 6);
    ctx.save();
    ctx.translate(12, padT + (H - padT - padB) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(PARAM_LABELS[sweep.cfg.yKey], 0, 0);
    ctx.restore();

    const c = sweep.cfg;
    const metricName = c.metric === "purity" ? "purity" : "amp";
    const done = sweep.state === "done";
    this.infoEl.textContent = best
      ? `${done ? "Best" : "Best so far"}: ${PARAM_LABELS[c.xKey]}=${fmt(best.x)}, ` +
        `${PARAM_LABELS[c.yKey]}=${fmt(best.y)} → mode${c.targetMode} ${metricName} ` +
        `${c.metric === "purity" ? (best.metric * 100).toFixed(1) + "%" : best.metric.toFixed(3) + " m"} ` +
        `· nodes≈${best.nodeCount.toFixed(1)} · クリックで適用`
      : "";
  }
}

function fmt(v: number): string {
  return Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2).replace(/\.?0+$/, "");
}
