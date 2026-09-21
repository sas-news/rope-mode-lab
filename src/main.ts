import "./style.css";
import * as THREE from "three";
import type GUI from "lil-gui";
import { LongRopeSimulation } from "./simulation/LongRopeSimulation";
import { ModeAnalyzer } from "./analysis/ModeAnalyzer";
import { NodeDetector } from "./analysis/NodeDetector";
import { FrequencySweep } from "./analysis/FrequencySweep";
import { History } from "./analysis/History";
import { Scene } from "./rendering/Scene";
import { RopeRenderer } from "./rendering/RopeRenderer";
import { NodeRenderer } from "./rendering/NodeRenderer";
import { TrailRenderer } from "./rendering/TrailRenderer";
import { Hud, HudStats } from "./ui/hud";
import { SweepChart } from "./ui/sweepChart";
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
import { AppConfig, DEFAULT_CONFIG } from "./simulation/types";

class App {
  private config: AppConfig;
  private sim: LongRopeSimulation;
  private analyzer: ModeAnalyzer;
  private nodes: NodeDetector;
  private sweep: FrequencySweep;
  private history = new History();

  private scene3d: Scene;
  private ropeR: RopeRenderer;
  private nodeR = new NodeRenderer();
  private trail = new TrailRenderer();
  private handleL: THREE.Mesh;
  private handleR: THREE.Mesh;
  private particlePoints: THREE.Points;

  private hud: Hud;
  private chart: SweepChart;
  private gui: GUI;

  private last = performance.now();
  private fps = 60;
  private hudTimer = 0;
  private suppressHashOnce = false;

  constructor() {
    const container = document.getElementById("app")!;
    this.config =
      configFromHash(window.location.hash) ?? cloneConfig(DEFAULT_CONFIG);

    this.sim = new LongRopeSimulation(this.config.sim);
    this.analyzer = new ModeAnalyzer(this.sim.rope.count);
    this.nodes = new NodeDetector(this.sim.rope.count);
    this.sweep = new FrequencySweep(this.config.sweep);

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

    this.hud = new Hud(document.body, {
      togglePause: () => this.togglePause(),
      reset: () => this.reset(),
      setView: (v) => this.scene3d.setView(v),
      shareURL: () => this.shareURL(),
      exportCSV: () => this.toggleRecording(),
    });
    this.chart = new SweepChart(document.body, () => {});
    this.gui = buildGUI(this.config, {
      rebuild: () => this.rebuild(),
      reset: () => this.reset(),
      syncDrive: () => this.syncDrive(),
      syncVisuals: () => this.syncVisuals(),
      applyPreset: (k) => this.applyPreset(k),
      startSweep: () => this.startSweep(),
      stopSweep: () => this.sweep.stop(),
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

  private rebuild(): void {
    this.sim.rebuild();
    this.analyzer.resize(this.sim.rope.count);
    this.nodes.resize(this.sim.rope.count);
    this.ropeR.rebuild(this.sim.rope.count, this.config.sim.ropeRadius);
    this.sweep.stop();
    this.syncDrive();
    this.syncVisuals();
    this.history.reset();
    // Rebind the debug points to the new rope position buffer.
    this.particlePoints.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.sim.rope.positions, 3),
    );
  }

  private reset(): void {
    this.sweep.stop();
    this.sim.reset();
    this.analyzer.reset();
    this.nodes.reset();
    this.history.reset();
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

    this.sim.advance(dt);

    const rope = this.sim.rope;
    const pos = rope.positions;
    const a = this.config.analysis;

    if (!this.sim.paused && !this.sim.unstable) {
      if (a.enabled) {
        this.analyzer.update(pos, dt, a.maxMode);
        if (a.nodeDetection) {
          this.nodes.update(this.analyzer.fluctMag, dt, a.nodeThreshold);
        } else {
          this.nodes.reset();
        }
      }
      this.sweep.update(dt, this.analyzer, this.nodes.nodes.length);
      const [fl, fr] = this.sim.currentFrequencies();
      this.history.push(dt, {
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

    // --- rendering ---
    this.ropeR.update(pos);
    this.trail.update(pos, rope.count);
    if (this.particlePoints.visible) {
      this.particlePoints.geometry.getAttribute("position").needsUpdate = true;
    }
    const e3 = (rope.count - 1) * 3;
    this.handleL.position.set(pos[0], pos[1], pos[2]);
    this.handleR.position.set(pos[e3], pos[e3 + 1], pos[e3 + 2]);
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
    }

    this.scene3d.render();
  }

  private sweepText(): string {
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
