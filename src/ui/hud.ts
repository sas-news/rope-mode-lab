import { ModeSpectrum } from "./modeSpectrum";

export interface HudStats {
  fps: number;
  stepsPerSec: number;
  freqL: number;
  freqR: number;
  phaseDeg: number;
  ropeLength: number;
  dominant: number;
  dominantPurity: number;
  nodeCount: number;
  loops: number;
  rms: number;
  paused: boolean;
  unstable: boolean;
  sweepText: string;
  recording: boolean;
}

export interface HudActions {
  togglePause(): void;
  reset(): void;
  setView(v: "perspective" | "side" | "top" | "front"): void;
  shareURL(): void;
  exportCSV(): void;
}

const jaFont =
  "'Segoe UI', 'Hiragino Kaku Gothic ProN', 'Yu Gothic UI', Meiryo, sans-serif";

/** DOM overlay: title, live stats, spectrum, transport buttons, warning. */
export class Hud {
  private statsEl: HTMLElement;
  private pauseBtn: HTMLButtonElement;
  private warnEl: HTMLElement;
  private sweepEl: HTMLElement;
  private recordBtn: HTMLButtonElement;
  readonly spectrum = new ModeSpectrum();

  constructor(root: HTMLElement, actions: HudActions) {
    const panel = document.createElement("div");
    panel.className = "hud-panel";
    panel.innerHTML = `
      <h1>Long Rope Mode Lab</h1>
      <p class="blurb">大縄跳びの多重ループを XPBD 物理で検証する3D実験<br/>
      A 3D physics experiment for exploring multi-loop modes in long-rope jumping.</p>
      <div class="stats"></div>
      <div class="spectrum-wrap"></div>
    `;
    panel.querySelector(".spectrum-wrap")!.appendChild(this.spectrum.canvas);
    this.statsEl = panel.querySelector(".stats")!;
    root.appendChild(panel);

    // Transport bar
    const bar = document.createElement("div");
    bar.className = "hud-bar";
    this.pauseBtn = this.btn("⏸ Pause", () => actions.togglePause());
    this.recordBtn = this.btn("● Rec", () => actions.exportCSV());
    bar.append(
      this.pauseBtn,
      this.btn("⟲ Reset (R)", () => actions.reset()),
      this.sep(),
      this.btn("3D", () => actions.setView("perspective")),
      this.btn("Side", () => actions.setView("side")),
      this.btn("Top", () => actions.setView("top")),
      this.btn("Front", () => actions.setView("front")),
      this.sep(),
      this.btn("🔗 Share", () => actions.shareURL()),
      this.recordBtn,
    );
    root.appendChild(bar);

    this.warnEl = document.createElement("div");
    this.warnEl.className = "hud-warn";
    this.warnEl.textContent =
      "⚠ 数値不安定を検出しました (NaN / 発散) — R でリセットしてください";
    this.warnEl.style.display = "none";
    root.appendChild(this.warnEl);

    this.sweepEl = document.createElement("div");
    this.sweepEl.className = "hud-sweep";
    root.appendChild(this.sweepEl);

    const hint = document.createElement("div");
    hint.className = "hud-hint";
    hint.innerHTML = `Space: 一時停止 · R: リセット · 1〜5: プリセット<br/>ドラッグ: 回転 · 右ドラッグ: 移動 · ホイール: ズーム`;
    root.appendChild(hint);
  }

  private btn(label: string, fn: () => void): HTMLButtonElement {
    const b = document.createElement("button");
    b.textContent = label;
    b.style.fontFamily = jaFont;
    b.addEventListener("click", fn);
    return b;
  }

  private sep(): HTMLElement {
    const s = document.createElement("span");
    s.className = "sep";
    return s;
  }

  update(s: HudStats): void {
    const row = (k: string, v: string, cls = "") =>
      `<div class="k">${k}</div><div class="v ${cls}">${v}</div>`;
    this.statsEl.innerHTML =
      row("FPS", s.fps.toFixed(0)) +
      row("Physics", `${s.stepsPerSec.toFixed(0)} st/s`) +
      row("Freq L/R", `${s.freqL.toFixed(2)} / ${s.freqR.toFixed(2)} Hz`) +
      row("Phase", `${s.phaseDeg.toFixed(0)}°`) +
      row("Rope", `${s.ropeLength.toFixed(2)} m`) +
      row("RMS disp.", `${s.rms.toFixed(3)} m`) +
      row(
        "Dominant mode",
        s.dominant > 0 ? `n=${s.dominant}` : "—",
        s.dominant >= 2 ? "hot" : "",
      ) +
      row(
        "Mode purity",
        s.dominant > 0 ? `${(s.dominantPurity * 100).toFixed(1)}%` : "—",
      ) +
      row("Nodes (internal)", `${s.nodeCount}`) +
      row("Est. loops", s.loops > 0 ? `${s.loops}` : "—", s.loops >= 2 ? "hot" : "");

    this.pauseBtn.textContent = s.paused ? "▶ Resume" : "⏸ Pause";
    this.recordBtn.textContent = s.recording ? "⏹ CSV" : "● Rec";
    this.warnEl.style.display = s.unstable ? "block" : "none";
    this.sweepEl.textContent = s.sweepText;
    this.sweepEl.style.display = s.sweepText ? "block" : "none";
  }
}
