import "./style.css";
import * as THREE from "three";
import type GUI from "lil-gui";
import { LongRopeSimulation } from "./simulation/LongRopeSimulation";
import { ModeAnalyzer } from "./analysis/ModeAnalyzer";
import { NodeDetector } from "./analysis/NodeDetector";
import { FrequencySweep } from "./analysis/FrequencySweep";
import { ParamSweep, SweepStage } from "./analysis/ParamSweep";
import { History } from "./analysis/History";
import { Scene } from "./rendering/Scene";
import { RopeRenderer } from "./rendering/RopeRenderer";
import { NodeRenderer } from "./rendering/NodeRenderer";
import { TrailRenderer } from "./rendering/TrailRenderer";
import { Hud, HudStats } from "./ui/hud";
import { SweepChart } from "./ui/sweepChart";
import { HeatmapChart } from "./ui/heatmapChart";
import { buildGUI, refreshGUI } from "./ui/controls";
import { PRESETS } from "./simulation/presets";
import {
  cloneConfig,
  configFromHash,
  configFromJSON,
  configToHash,
  downloadJSON,
  downloadText,
  mergeInto,
} from "./utils/config";
import { AppConfig, DEFAULT_CONFIG, SweepParamKey } from "./simulation/types";

class App {
  private config: AppConfig;
  private sim: LongRopeSimulation;
  private analyzer: ModeAnalyzer;
  private nodes: NodeDetector;
  private sweep: FrequencySweep;
  private paramSweep: ParamSweep;
  private history = new History();

  private scene3d: Scene;
  private ropeR: RopeRenderer;
  private nodeR = new NodeRenderer();
  private trail = new TrailRenderer();
  private handleL: THREE.Mesh;
  private handleR: THREE.Mesh;
  private particlePoints: THREE.Points;
  private massMarker: THREE.Mesh;

  private hud: Hud;
  private chart: SweepChart;
  private heatmap: HeatmapChart;
  private gui: GUI;

  private last = performance.now();
  private fps = 60;
  private hudTimer = 0;
  private lastSimTime = 0;
  private suppressHashOnce = false;
  /** User fidelity saved while the optimizer's coarse pass runs cheap. */
  private optFidelity: {
    particleCount: number;
    iterations: number;
    physicsDt: number;
  } | null = null;
  /** Reduced-fidelity settings used while scouting the coarse grid. */
  private static readonly COARSE_FIDELITY = {
    particleCount: 61,
    iterations: 14,
    physicsDt: 1 / 160,
  };
  /** Per-frame wall-clock budget for fast-forwarded sweep stepping (ms). */
  private static readonly FAST_FORWARD_BUDGET_MS = 10;

  /** SimConfig keys that require rebuilding the rope when changed. */
  private static readonly STRUCTURAL: ReadonlySet<string> = new Set([
    "ropeLength",
    "particleCount",
    "ropeMass",
  ]);
  /** SimConfig keys that live in the end drivers. */
  private static readonly DRIVE: ReadonlySet<string> = new Set([
    "frequency",
    "separateFrequencies",
    "leftFrequency",
    "rightFrequency",
    "phaseDeg",
    "radius",
    "leftDirection",
    "rightDirection",
    "handleDistance",
    "handleHeight",
  ]);

  constructor() {
    const container = document.getElementById("app")!;
    this.config =
      configFromHash(window.location.hash) ?? cloneConfig(DEFAULT_CONFIG);

    this.sim = new LongRopeSimulation(this.config.sim);
    this.analyzer = new ModeAnalyzer(this.sim.rope.count);
    this.nodes = new NodeDetector(this.sim.rope.count);
    this.sweep = new FrequencySweep(this.config.sweep);
    this.paramSweep = new ParamSweep(this.config.optimizer);

    this.scene3d = new Scene(container);
    this.ropeR = new RopeRenderer(
      this.sim.rope.count,
      this.config.sim.ropeRadius,
    );
    this.scene3d.scene.add(this.ropeR.mesh);
    this.scene3d.scene.add(this.nodeR.group);
    this.scene3d.scene.add(this.trail.line);

    const handleGeo = new THREE.SphereGeometry(0.07, 16, 12);
    const handleMat = new THREE.MeshStandardMaterial({
      color: 0x6f8dff,
      emissive: 0x16204a,
      roughness: 0.4,
    });
    this.handleL = new THREE.Mesh(handleGeo, handleMat);
    this.handleR = new THREE.Mesh(handleGeo, handleMat.clone());
    this.scene3d.scene.add(this.handleL, this.handleR);

    // Debug particle view — the attribute shares the rope's position buffer.
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.sim.rope.positions, 3),
    );
    this.particlePoints = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({
        size: 0.045,
        color: 0x9fd7ff,
        sizeAttenuation: true,
      }),
    );
    this.particlePoints.frustumCulled = false;
    this.particlePoints.visible = false;
    this.scene3d.scene.add(this.particlePoints);

    // Point-weight marker (おもり)
    this.massMarker = new THREE.Mesh(
      new THREE.SphereGeometry(1, 18, 12),
      new THREE.MeshStandardMaterial({
        color: 0x30364a,
        roughness: 0.35,
        metalness: 0.7,
        emissive: 0x1a0505,
      }),
    );
    this.massMarker.visible = false;
    this.scene3d.scene.add(this.massMarker);

    this.hud = new Hud(document.body, {
      togglePause: () => this.togglePause(),
      reset: () => this.reset(),
      setView: (v) => this.scene3d.setView(v),
      shareURL: () => this.shareURL(),
      exportCSV: () => this.toggleRecording(),
    });
    this.chart = new SweepChart(document.body, () => {});
    this.heatmap = new HeatmapChart(
      document.body,
      () => {},
      (x, y) => this.pickCell(x, y),
    );
    this.gui = buildGUI(this.config, {
      rebuild: () => this.rebuild(),
      reset: () => this.reset(),
      syncDrive: () => this.syncDrive(),
      syncVisuals: () => this.syncVisuals(),
      applyPreset: (k) => this.applyPreset(k),
      startSweep: () => this.startSweep(),
      stopSweep: () => this.sweep.stop(),
      startOptimizer: () => this.startOptimizer(),
      stopOptimizer: () => this.paramSweep.stop(),
      applyBestCell: () => this.applyBestCell(),
      kick: (mode) => this.sim.injectMode(mode, this.config.sim.kickAmplitude),
      exportConfig: () => downloadJSON("rope-mode-lab-config.json", this.config),
      importConfig: () => this.importConfig(),
      shareURL: () => this.shareURL(),
      toggleRecording: () => this.toggleRecording(),
    });

    this.syncDrive();
    this.syncVisuals();
    window.addEventListener("keydown", (e) => this.onKey(e));
    window.addEventListener("hashchange", () => this.onHashChange());

    requestAnimationFrame((t) => this.frame(t));
  }

  // ---------------- actions ----------------

  /** Rebuild rope+analyzers without interrupting a running sweep. */
  private rebuildRope(): void {
    this.sim.rebuild();
    this.analyzer.resize(this.sim.rope.count);
    this.nodes.resize(this.sim.rope.count);
    this.ropeR.rebuild(this.sim.rope.count, this.config.sim.ropeRadius);
    this.syncDrive();
    this.syncVisuals();
    this.history.reset();
    this.particlePoints.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.sim.rope.positions, 3),
    );
  }

  private rebuild(): void {
    this.sweep.stop();
    this.paramSweep.stop();
    this.rebuildRope();
  }

  private reset(): void {
    this.sweep.stop();
    this.paramSweep.stop();
    this.softReset();
  }

  /** Reset rope + analysis state without touching params or sweeps. */
  private softReset(): void {
    this.sim.reset();
    this.analyzer.reset();
    this.nodes.reset();
    this.history.reset();
  }

  /** Generic param setter used by the optimizer's axes. */
  private applyParam(key: SweepParamKey, v: number): void {
    const s = this.config.sim as unknown as Record<string, unknown>;
    if (typeof s[key] !== "number") return;
    s[key] = v;
    if (App.STRUCTURAL.has(key)) this.rebuildRope();
    else if (App.DRIVE.has(key)) this.syncDrive();
  }

  private syncDrive(): void {
    this.sim.updateDrivers();
    const s = this.config.sim;
    this.scene3d.updateDriveGuides(s.handleDistance, s.handleHeight, s.radius);
  }

  private syncVisuals(): void {
    this.ropeR.setRadius(this.config.sim.ropeRadius);
    this.trail.setEnabled(this.config.analysis.trail);
    this.particlePoints.visible = this.config.analysis.showParticles;
  }

  private applyPreset(key: string): void {
    const preset = PRESETS[key];
    if (!preset) return;
    preset.apply(this.config);
    this.rebuild();
    refreshGUI(this.gui);
  }

  private togglePause(): void {
    this.sim.paused = !this.sim.paused;
  }

  private startSweep(): void {
    if (this.sweep.state === "settling" || this.sweep.state === "measuring") {
      return;
    }
    this.paramSweep.stop();
    this.config.analysis.enabled = true;
    this.chart.show();
    this.sweep.start(
      (hz) => {
        this.config.sim.separateFrequencies = false;
        this.config.sim.frequency = hz;
        this.sim.updateDrivers();
        refreshGUI(this.gui);
      },
      () => this.chart.draw(this.sweep, [1, 2, 3, 4]),
    );
  }

  private startOptimizer(): void {
    if (this.paramSweep.running) return;
    this.sweep.stop();
    this.config.analysis.enabled = true;
    // Phase is not a search axis: it is fixed by the target mode's parity
    // (odd n → in-phase 0°, even n → counter-phase 180°).
    this.config.sim.phaseDeg = ParamSweep.phaseForMode(
      this.config.optimizer.targetMode,
    );
    this.config.sim.separateFrequencies = false;
    this.syncDrive();
    this.heatmap.show();
    this.paramSweep.start({
      apply: (key, v) => {
        this.applyParam(key, v);
        refreshGUI(this.gui);
      },
      reset: () => this.softReset(),
      onStage: (st) => this.setOptimizerStage(st),
      onDone: () => {
        this.restoreOptimizerFidelity();
        this.heatmap.draw(this.paramSweep);
        refreshGUI(this.gui);
      },
    });
  }

  /**
   * Swaps solver fidelity when the optimizer switches stages: the coarse
   * pass scouts with a light rope model, the fine pass restores the user's
   * full settings for trustworthy measurements.
   */
  private setOptimizerStage(stage: SweepStage): void {
    const s = this.config.sim;
    if (stage === "coarse") {
      this.optFidelity = {
        particleCount: s.particleCount,
        iterations: s.iterations,
        physicsDt: s.physicsDt,
      };
      const c = App.COARSE_FIDELITY;
      this.applyParam("particleCount", c.particleCount);
      this.applyParam("iterations", c.iterations);
      this.applyParam("physicsDt", c.physicsDt);
    } else {
      this.restoreOptimizerFidelity();
    }
    refreshGUI(this.gui);
  }

  private restoreOptimizerFidelity(): void {
    const f = this.optFidelity;
    if (!f) return;
    this.optFidelity = null;
    this.applyParam("particleCount", f.particleCount);
    this.applyParam("iterations", f.iterations);
    this.applyParam("physicsDt", f.physicsDt);
  }

  private applyBestCell(): void {
    const best = this.paramSweep.bestCell();
    if (!best) return;
    this.pickCell(best.x, best.y);
  }

  /** Applies a heatmap cell's params and resets to preview that state. */
  private pickCell(x: number, y: number): void {
    this.applyParam(this.config.optimizer.xKey, x);
    this.applyParam(this.config.optimizer.yKey, y);
    this.softReset();
    refreshGUI(this.gui);
  }

  private importConfig(): void {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const cfg = configFromJSON(await file.text());
      if (cfg) {
        mergeInto(this.config as unknown as Record<string, unknown>, cfg);
        this.rebuild();
        refreshGUI(this.gui);
      } else {
        alert("設定ファイルの読み込みに失敗しました");
      }
    };
    input.click();
  }

  private shareURL(): void {
    this.suppressHashOnce = true;
    window.location.hash = configToHash(this.config);
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
  }

  private toggleRecording(): void {
    this.history.enabled = !this.history.enabled;
    if (!this.history.enabled && this.history.samples.length > 0) {
      downloadText("rope-mode-lab-history.csv", this.history.toCSV());
      this.history.reset();
    }
  }

  private onHashChange(): void {
    if (this.suppressHashOnce) {
      this.suppressHashOnce = false;
      return;
    }
    const cfg = configFromHash(window.location.hash);
    if (!cfg) return;
    mergeInto(this.config as unknown as Record<string, unknown>, cfg);
    this.rebuild();
    refreshGUI(this.gui);
  }

  private onKey(e: KeyboardEvent): void {
    if (e.target instanceof HTMLInputElement) return;
    switch (e.code) {
      case "Space":
        e.preventDefault();
        this.togglePause();
        break;
      case "KeyR":
        this.reset();
        break;
      case "Digit1":
        this.applyPreset("normal");
        break;
      case "Digit2":
        this.applyPreset("double");
        break;
      case "Digit3":
        this.applyPreset("triple");
        break;
    }
  }

  // ---------------- frame loop ----------------

  private frame(now: number): void {
    requestAnimationFrame((t) => this.frame(t));
    const rawDt = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(Math.max(rawDt, 0), 0.1);
    if (dt > 0) this.fps += (1 / dt - this.fps) * 0.05;

    // Sweeps are offline measurements: instead of real-time pacing we burn
    // a per-frame CPU budget and step physics as fast as possible.
    const sweeping =
      this.paramSweep.running ||
      this.sweep.state === "settling" ||
      this.sweep.state === "measuring";
    if (sweeping && !this.sim.paused && !this.sim.unstable) {
      this.fastForward(App.FAST_FORWARD_BUDGET_MS);
    } else {
      this.sim.advance(dt);
    }
    // Elapsed *simulated* time — analysis/sweep timings follow the physics
    // clock, so simulationSpeed changes don't distort measurements.
    const simDt = this.sim.simTime - this.lastSimTime;
    this.lastSimTime = this.sim.simTime;

    const rope = this.sim.rope;
    const pos = rope.positions;
    const a = this.config.analysis;

    if (!sweeping && !this.sim.paused && !this.sim.unstable && simDt > 0) {
      this.stepAnalysis(simDt);
    }

    // --- rendering ---
    this.ropeR.update(pos);
    this.trail.update(pos, rope.count);
    if (this.particlePoints.visible) {
      this.particlePoints.geometry.getAttribute("position").needsUpdate = true;
    }
    const e3 = (rope.count - 1) * 3;
    this.handleL.position.set(pos[0], pos[1], pos[2]);
    this.handleR.position.set(pos[e3], pos[e3 + 1], pos[e3 + 2]);
    const mi = this.sim.pointMassIndex;
    if (this.config.sim.pointMassEnabled && mi >= 0) {
      const m3 = mi * 3;
      this.massMarker.position.set(pos[m3], pos[m3 + 1], pos[m3 + 2]);
      this.massMarker.scale.setScalar(
        0.05 + 0.045 * Math.cbrt(this.config.sim.pointMassKg),
      );
      this.massMarker.visible = true;
    } else {
      this.massMarker.visible = false;
    }
    this.nodeR.update(
      pos,
      this.nodes.nodes,
      this.nodes.antinodes,
      a.enabled && a.nodeDetection && !this.sim.unstable,
    );

    this.hudTimer += dt;
    if (this.hudTimer > 0.12) {
      this.hudTimer = 0;
      const [fl, fr] = this.sim.currentFrequencies();
      const stats: HudStats = {
        fps: this.fps,
        stepsPerSec: this.sim.stepsPerSecond,
        freqL: fl,
        freqR: fr,
        phaseDeg: this.config.sim.phaseDeg,
        ropeLength: this.config.sim.ropeLength,
        dominant: this.analyzer.dominant,
        dominantPurity:
          this.analyzer.dominant > 0
            ? this.analyzer.purities[this.analyzer.dominant]
            : 0,
        nodeCount: this.nodes.nodes.length,
        loops: this.nodes.loops,
        rms: this.analyzer.rms,
        paused: this.sim.paused,
        unstable: this.sim.unstable,
        recording: this.history.enabled,
        sweepText: this.sweepText(),
      };
      this.hud.update(stats);
      this.hud.spectrum.draw(this.analyzer, a.maxMode);
      if (this.sweep.state !== "idle") {
        this.chart.draw(this.sweep, [1, 2, 3, 4]);
      }
      if (this.paramSweep.state !== "idle") {
        this.heatmap.draw(this.paramSweep);
      }
    }

    this.scene3d.render();
  }

  /** Analysis + sweep updates for a chunk of simulated time. */
  private stepAnalysis(simDt: number): void {
    const a = this.config.analysis;
    const pos = this.sim.rope.positions;
    if (a.enabled) {
      this.analyzer.update(pos, simDt, a.maxMode);
      if (a.nodeDetection) {
        this.nodes.update(this.analyzer.fluctMag, simDt, a.nodeThreshold);
      } else {
        this.nodes.reset();
      }
    }
    this.sweep.update(simDt, this.analyzer, this.nodes.nodes.length);
    this.paramSweep.update(simDt, this.analyzer, this.nodes.nodes.length);
    const [fl, fr] = this.sim.currentFrequencies();
    this.history.push(simDt, {
      t: this.sim.simTime,
      freqL: fl,
      freqR: fr,
      dominant: this.analyzer.dominant,
      purity:
        this.analyzer.dominant > 0
          ? this.analyzer.purities[this.analyzer.dominant]
          : 0,
      nodeCount: this.nodes.nodes.length,
      loops: this.nodes.loops,
      rms: this.analyzer.rms,
    });
  }

  /**
   * Steps the simulation as fast as the CPU allows within `budgetMs` of
   * wall-clock time, running analysis per chunk. Used while a sweep is
   * measuring so grid searches finish in seconds instead of minutes.
   */
  private fastForward(budgetMs: number): void {
    const t0 = performance.now();
    const CHUNK = 0.05; // sim-seconds per advance call (< maxSteps × dt)
    while (performance.now() - t0 < budgetMs) {
      const running =
        this.paramSweep.running ||
        this.sweep.state === "settling" ||
        this.sweep.state === "measuring";
      if (!running || this.sim.paused) break;
      if (this.sim.unstable) {
        // Record the failed cell and keep going (the next cell resets).
        if (this.paramSweep.running) this.paramSweep.skipCell();
        else break;
      }
      this.sim.advance(CHUNK);
      const d = this.sim.simTime - this.lastSimTime;
      this.lastSimTime = this.sim.simTime;
      if (d <= 0) continue;
      this.stepAnalysis(d);
    }
  }

  private sweepText(): string {
    const ps = this.paramSweep;
    if (ps.state === "settling" || ps.state === "measuring") {
      const cur = ps.current;
      const stageLabel = ps.stage === "coarse" ? "粗" : "精密";
      return cur
        ? `Optimizer[${stageLabel}] ${ps.iy * ps.xs.length + ps.ix + 1}/${ps.totalCells} · ` +
              `${ps.cfg.xKey}=${cur.x.toFixed(2)} ${ps.cfg.yKey}=${cur.y.toFixed(2)} ` +
              `[${ps.state === "settling" ? "settle" : "measure"}] · ` +
              `${(ps.progress * 100).toFixed(0)}%`
        : "";
    }
    if (ps.state === "done" && ps.cells.length > 0) {
      const b = ps.bestCell();
      return b
        ? `Optimizer done — best ${ps.cfg.xKey}=${b.x.toFixed(2)} ${ps.cfg.yKey}=${b.y.toFixed(2)}`
        : "Optimizer done";
    }
    const s = this.sweep;
    if (s.state === "settling" || s.state === "measuring") {
      const total = s.frequencies.length;
      const label = s.state === "settling" ? "settle" : "measure";
      return (
        `Sweep ${s.currentIndex + 1}/${total} · f=${s.currentFreq.toFixed(2)} Hz ` +
        `[${label}] · ${(s.progress * 100).toFixed(0)}%`
      );
    }
    if (s.state === "done") {
      const best = s.bestFrequency(s.cfg.targetMode);
      return best
        ? `Sweep done — best mode ${s.cfg.targetMode}: ${best.freq.toFixed(2)} Hz`
        : "Sweep done";
    }
    return "";
  }
}

new App();
