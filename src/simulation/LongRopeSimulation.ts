import { Rope } from "../physics/Rope";
import { XPBDSolver } from "../physics/XPBDSolver";
import { CircularDriver } from "../physics/EndDriver";
import { SimConfig } from "./types";

const MAX_ACCUMULATED_TIME = 0.12; // clamp huge frame deltas (tab switch etc.)

/**
 * Owns the rope, the two end drivers and the solver, and advances the
 * simulation with a fixed timestep accumulator decoupled from render FPS.
 */
export class LongRopeSimulation {
  params: SimConfig;
  rope!: Rope;
  solver!: XPBDSolver;
  leftDriver = new CircularDriver();
  rightDriver = new CircularDriver();

  simTime = 0;
  accumulator = 0;
  paused = false;
  stepsPerSecond = 0;
  /** Set when NaN/Inf/explosion detected; stepping halts until reset. */
  unstable = false;

  private endA = new Float32Array(3);
  private endB = new Float32Array(3);
  private stepsThisSecond = 0;
  private stepsTimer = 0;

  constructor(params: SimConfig) {
    this.params = params;
    this.rebuild();
  }

  /** (Re)builds the rope from current params. Required for structural changes. */
  rebuild(): void {
    const p = this.params;
    this.rope = new Rope(p.particleCount, p.ropeLength, p.ropeMass);
    this.solver = new XPBDSolver(this.rope);
    this.solver.rebuildConstraints(p.compliance, p.bendingStiffness);
    this.updateDrivers();
    this.reset();
  }

  /** Resets positions & clock without rebuilding constraint topology. */
  reset(): void {
    const p = this.params;
    this.updateDrivers();
    this.simTime = 0;
    this.accumulator = 0;
    this.unstable = false;
    this.solver.unstable = false;
    const a = this.endA, b = this.endB;
    this.leftDriver.positionAt(0, a);
    this.rightDriver.positionAt(0, b);
    this.rope.layout(a[0], a[1], a[2], b[0], b[1], b[2]);
    // Start resting on the floor instead of poking through it.
    if (p.floorCollision) {
      const pos = this.rope.positions;
      for (let i = 1; i < this.rope.count - 1; i++) {
        const y = i * 3 + 1;
        if (pos[y] < p.ropeRadius) pos[y] = p.ropeRadius;
      }
      this.rope.prevPositions.set(pos);
    }
  }

  /** Syncs driver params (call when drive/rope params changed). */
  updateDrivers(): void {
    const p = this.params;
    const half = p.handleDistance / 2;
    const l = this.leftDriver, r = this.rightDriver;
    l.cx = -half; l.cy = p.handleHeight; l.cz = 0;
    r.cx = half; r.cy = p.handleHeight; r.cz = 0;
    l.radius = r.radius = p.radius;
    l.frequency = p.separateFrequencies ? p.leftFrequency : p.frequency;
    r.frequency = p.separateFrequencies ? p.rightFrequency : p.frequency;
    l.phaseRad = 0;
    r.setPhaseDeg(p.phaseDeg);
    l.direction = p.leftDirection;
    r.direction = p.rightDirection;
  }

  /** Advance by a wall-clock frame delta (seconds). */
  advance(frameDt: number): void {
    if (this.paused || this.unstable) return;
    const h = this.params.physicsDt;
    this.accumulator += Math.min(frameDt, MAX_ACCUMULATED_TIME) *
      this.params.simulationSpeed;

    // Avoid spiral of death: drop time if we can't keep up.
    const maxSteps = 16;
    let steps = 0;
    while (this.accumulator >= h && steps < maxSteps) {
      this.fixedStep(h);
      this.accumulator -= h;
      steps++;
    }
    if (steps === maxSteps) this.accumulator = 0;

    this.stepsTimer += frameDt;
    this.stepsThisSecond += steps;
    if (this.stepsTimer >= 0.5) {
      this.stepsPerSecond = this.stepsThisSecond / this.stepsTimer;
      this.stepsThisSecond = 0;
      this.stepsTimer = 0;
    }
  }

  /** Runs exactly one physics substep. */
  private fixedStep(h: number): void {
    const p = this.params;
    // Keep live-tunable solver params in sync.
    this.solver.setCompliance(p.compliance);
    this.solver.setBendingStiffness(p.bendingStiffness);

    const tNext = this.simTime + h;
    this.leftDriver.positionAt(tNext, this.endA);
    this.rightDriver.positionAt(tNext, this.endB);

    this.solver.step(
      h,
      this.endA,
      this.endB,
      {
        gravity: p.gravity,
        damping: p.damping,
        airDrag: p.airDrag,
        compliance: p.compliance,
        bendingStiffness: p.bendingStiffness,
        iterations: p.iterations,
        floorCollision: p.floorCollision,
        floorOffset: p.ropeRadius,
      },
      this.rope.mass / this.rope.length,
    );
    this.simTime = tNext;
    if (this.solver.unstable) this.unstable = true;
  }

  /** Effective left/right drive frequency currently in use (Hz). */
  currentFrequencies(): [number, number] {
    return [this.leftDriver.frequency, this.rightDriver.frequency];
  }

  /**
   * Injects a rotating mode-n perturbation: displaces the rope toward
   * amp·sin(n*pi*x) in the current drive direction and adds the matching
   * rotational velocity. Used to test whether multi-loop states are stable
   * attractors even when unreachable from rest by steady driving alone.
   */
  injectMode(n: number, amp: number): void {
    const rope = this.rope;
    const N = rope.count;
    const w = 2 * Math.PI * this.leftDriver.frequency;
    const th = w * this.simTime;
    for (let i = 1; i < N - 1; i++) {
      const s = amp * Math.sin((n * Math.PI * i) / (N - 1));
      const i3 = i * 3;
      rope.positions[i3 + 1] += s * Math.cos(th);
      rope.positions[i3 + 2] += s * Math.sin(th);
      rope.velocities[i3 + 1] += -s * w * Math.sin(th);
      rope.velocities[i3 + 2] += s * w * Math.cos(th);
    }
  }
}
