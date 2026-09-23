import GUI from "lil-gui";
import { AppConfig } from "../simulation/types";
import { PARAM_LABELS } from "./heatmapChart";

export interface GuiActions {
  /** Structural change: rebuild rope + constraints + renderers. */
  rebuild(): void;
  /** Restart simulation with current parameters. */
  reset(): void;
  /** Drive params changed: re-sync drivers and drive-circle guides. */
  syncDrive(): void;
  /** Rendering-only params changed. */
  syncVisuals(): void;
  applyPreset(key: string): void;
  startSweep(): void;
  stopSweep(): void;
  startOptimizer(): void;
  stopOptimizer(): void;
  applyBestCell(): void;
  /** Configure the optimizer for human-jumpable search and run it. */
  jumpSearch(): void;
  kick(mode: number): void;
  exportConfig(): void;
  importConfig(): void;
  shareURL(): void;
  toggleRecording(): void;
}

const DIR_OPTS = { "正転 (+)": 1, "逆転 (−)": -1 } as const;

export function buildGUI(cfg: AppConfig, actions: GuiActions): GUI {
  const gui = new GUI({ title: "Controls", width: 300 });
  const s = cfg.sim, a = cfg.analysis, sw = cfg.sweep, op = cfg.optimizer;

  const drive = gui.addFolder("駆動 Drive");
  const fShared = drive
    .add(s, "frequency", 0, 5, 0.01)
    .name("Frequency Hz")
    .onChange(actions.syncDrive);
  const fL = drive
    .add(s, "leftFrequency", 0, 5, 0.01)
    .name("Left Hz")
    .onChange(actions.syncDrive);
  const fR = drive
    .add(s, "rightFrequency", 0, 5, 0.01)
    .name("Right Hz")
    .onChange(actions.syncDrive);
  const updateFreqUI = () => {
    fShared.disable(s.separateFrequencies);
    fL.disable(!s.separateFrequencies);
    fR.disable(!s.separateFrequencies);
  };
  drive
    .add(s, "separateFrequencies")
    .name("左右別周波数")
    .onChange(() => {
      updateFreqUI();
      actions.syncDrive();
    });
  updateFreqUI();
  drive.add(s, "phaseDeg", 0, 360, 1).name("Phase差 °").onChange(actions.syncDrive);
  drive.add(s, "radius", 0.05, 1.0, 0.01).name("Radius m").onChange(actions.syncDrive);
  drive.add(s, "leftDirection", DIR_OPTS).name("左 回転方向").onChange(actions.syncDrive);
  drive.add(s, "rightDirection", DIR_OPTS).name("右 回転方向").onChange(actions.syncDrive);
  drive.add(s, "handleDistance", 4, 12, 0.1).name("把手間隔 m").onChange(actions.syncDrive);
  drive.add(s, "handleHeight", 0.5, 2.2, 0.05).name("把手高さ m").onChange(actions.syncDrive);

  const rope = gui.addFolder("縄 Rope");
  rope.add(s, "ropeLength", 5, 14, 0.1).name("Length m").onFinishChange(actions.rebuild);
  rope
    .add(s, "particleCount", 40, 200, 1)
    .name("Particles")
    .onFinishChange(actions.rebuild);
  rope.add(s, "ropeMass", 0.2, 5, 0.05).name("Mass kg").onFinishChange(actions.rebuild);
  rope.add(s, "damping", 0, 2, 0.01).name("Damping 1/s");
  rope.add(s, "airDrag", 0, 1, 0.01).name("Air drag");
  rope.add(s, "compliance", 0, 0.002, 0.00005).name("Compliance");
  rope.add(s, "bendingStiffness", 0, 1, 0.01).name("Bending stiff.");
  rope.add(s, "ropeRadius", 0.005, 0.05, 0.001).name("Radius m").onChange(actions.syncVisuals);
  rope.add(s, "pointMassEnabled").name("おもり ON");
  rope.add(s, "pointMassKg", 0.05, 10, 0.05).name("おもり kg");
  rope.add(s, "pointMassPos", 0.02, 0.98, 0.01).name("おもり位置 0-1");

  const world = gui.addFolder("世界 World");
  world.add(s, "gravity", 0, 20, 0.01).name("Gravity m/s²");
  world.add(s, "simulationSpeed", 0.1, 2, 0.05).name("Sim speed ×");
  world.add(s, "iterations", 4, 64, 1).name("Iterations");
  world.add(s, "floorCollision").name("床との接触");
  world.add(s, "floorFriction", 0, 1, 0.01).name("床摩擦 μ (0=つるつる)");

  const an = gui.addFolder("解析 Analysis");
  an.add(a, "enabled").name("解析 ON");
  an.add(a, "maxMode", 1, 8, 1).name("Max mode n");
  an.add(a, "nodeDetection").name("節検出 Node");
  an.add(a, "nodeThreshold", 0.1, 0.8, 0.01).name("Node threshold");
  an.add(a, "trail").name("軌跡 Trail").onChange(actions.syncVisuals);
  an.add(a, "showParticles").name("Particles表示").onChange(actions.syncVisuals);

  const sweepF = gui.addFolder("周波数スイープ Sweep");
  sweepF.add(sw, "startHz", 0.1, 4, 0.05).name("Start Hz");
  sweepF.add(sw, "endHz", 0.2, 6, 0.05).name("End Hz");
  sweepF.add(sw, "steps", 4, 60, 1).name("Steps");
  sweepF.add(sw, "settleTime", 0.5, 10, 0.5).name("Settle s");
  sweepF.add(sw, "measureTime", 1, 15, 0.5).name("Measure s");
  sweepF.add(sw, "targetMode", 1, 6, 1).name("Target mode");
  sweepF.add(actions, "startSweep").name("▶ Sweep開始");
  sweepF.add(actions, "stopSweep").name("■ 停止");

  const opt = gui.addFolder("最適化 Optimizer");
  opt.add(op, "xKey", PARAM_LABELS).name("X軸");
  opt.add(op, "xStart").name("X start");
  opt.add(op, "xEnd").name("X end");
  opt.add(op, "xSteps", 2, 12, 1).name("X 粗分割");
  opt.add(op, "yKey", PARAM_LABELS).name("Y軸");
  opt.add(op, "yStart").name("Y start");
  opt.add(op, "yEnd").name("Y end");
  opt.add(op, "ySteps", 2, 12, 1).name("Y 粗分割");
  opt.add(op, "fineSteps", 2, 12, 1).name("精密分割");
  opt.add(op, "coarseSettleTime", 0.3, 6, 0.1).name("粗 settle s");
  opt.add(op, "coarseMeasureTime", 0.3, 6, 0.1).name("粗 measure s");
  opt.add(op, "settleTime", 0.5, 10, 0.5).name("精密 settle s");
  opt.add(op, "measureTime", 1, 15, 0.5).name("精密 measure s");
  opt.add(op, "targetMode", 1, 6, 1).name("Target mode");
  opt
    .add(op, "metric", {
      "振幅 Amp": "amp",
      "Purity": "purity",
      "跳べる度 Jump": "jump",
    } as const)
    .name("評価指標");
  opt.add(op, "personHeight", 1.0, 2.2, 0.05).name("身長 m");
  opt.add(op, "resetEach").name("各セルでリセット");
  opt
    .add({ phase: "n奇数→0° / 偶数→180°" }, "phase")
    .name("位相(自動)")
    .disable();
  opt.add(actions, "jumpSearch").name("🧍 跳べる条件を探す");
  opt.add(actions, "startOptimizer").name("▶ 最適化開始");
  opt.add(actions, "stopOptimizer").name("■ 停止");
  opt.add(actions, "applyBestCell").name("★ 最適セルを適用");

  const kick = gui.addFolder("励起 Kick");
  kick.add(s, "kickAmplitude", 0.1, 1.5, 0.05).name("振幅 m");
  kick
    .add({ k: () => actions.kick(2) }, "k")
    .name("n=2 注入");
  kick
    .add({ k: () => actions.kick(3) }, "k")
    .name("n=3 注入");
  kick
    .add({ k: () => actions.kick(4) }, "k")
    .name("n=4 注入");

  const sys = gui.addFolder("プリセット / 設定");
  sys.add({ normal: () => actions.applyPreset("normal") }, "normal").name("1: Normal");
  sys.add({ double: () => actions.applyPreset("double") }, "double").name("2: Double Loop");
  sys.add({ triple: () => actions.applyPreset("triple") }, "triple").name("3: Triple Search");
  sys
    .add({ slick: () => actions.applyPreset("slick") }, "slick")
    .name("4: つるつる床 Slick");
  sys
    .add({ sticky: () => actions.applyPreset("sticky") }, "sticky")
    .name("5: ざらざら床 Sticky");
  sys.add(actions, "reset").name("⟲ Reset (R)");
  sys.add(actions, "exportConfig").name("Export Config JSON");
  sys.add(actions, "importConfig").name("Import Config JSON");
  sys.add(actions, "shareURL").name("🔗 この状態へのリンク");
  sys.add(actions, "toggleRecording").name("● CSV記録 / 停止+保存");

  return gui;
}

export function refreshGUI(gui: GUI): void {
  for (const c of gui.controllersRecursive()) c.updateDisplay();
}
