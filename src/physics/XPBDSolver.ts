import { DistanceConstraint } from "./constraints/DistanceConstraint";
import { buildBendingConstraints } from "./constraints/BendingConstraint";
import { Rope } from "./Rope";

export interface SolverParams {
  gravity: number;
  damping: number;
  airDrag: number;
  compliance: number;
  bendingStiffness: number;
  iterations: number;
  /** Project particles above y = floorOffset when true. */
  floorCollision: boolean;
  floorOffset: number;
  /** Floor friction, 0 (frictionless) .. 1 (rope sticks on contact). */
  floorFriction: number;
}

/**
 * Tangential decay rate (1/s) at floorFriction = 1. Chosen so a contacting
 * particle loses its sliding speed within a few milliseconds, which is the
 * "rope glued to the floor" limit.
 */
const FLOOR_FRICTION_RATE = 122.6;

/**
 * Fraction of tangential velocity a contacting particle keeps over a step
 * of length h. Rate-based so the result does not depend on the timestep.
 */
export function floorFrictionKeep(friction: number, h: number): number {
  const mu = Math.min(1, Math.max(0, friction));
  return Math.exp(-FLOOR_FRICTION_RATE * mu * h);
}

/** Maps 0..1 stiffness to XPBD compliance (m/N), logarithmically. */
export function bendingCompliance(stiffness: number): number {
  const s = Math.min(1, Math.max(0, stiffness));
  return Math.pow(10, -1 - 5 * s); // 1e-1 .. 1e-6
}

/**
 * XPBD solver: predict -> constraint iterations -> velocity reconstruction.
 * Endpoints are kinematic (invMass = 0) and driven externally each step.
 */
export class XPBDSolver {
  readonly rope: Rope;
  distance: DistanceConstraint[] = [];
  bending: DistanceConstraint[] = [];

  /** Non-finite or exploded state was detected in the last step. */
  unstable = false;

  constructor(rope: Rope) {
    this.rope = rope;
    this.rebuildConstraints(0, 0);
  }

  rebuildConstraints(compliance: number, stiffness: number): void {
    const n = this.rope.count;
    this.distance = [];
    for (let i = 0; i + 1 < n; i++) {
      this.distance.push(
        new DistanceConstraint(i, i + 1, this.rope.segmentLength, compliance),
      );
    }
    this.bending = buildBendingConstraints(
      n,
      this.rope.segmentLength,
      bendingCompliance(stiffness),
    );
  }

  setCompliance(compliance: number): void {
    for (const c of this.distance) c.compliance = compliance;
  }

  setBendingStiffness(stiffness: number): void {
    const comp = bendingCompliance(stiffness);
    for (const c of this.bending) c.compliance = comp;
  }

  /**
   * One fixed physics step of size h at absolute sim time t.
   * endA/endB are the driven endpoint positions (xyz at offsets 0..2).
   */
  step(
    h: number,
    endA: ArrayLike<number>,
    endB: ArrayLike<number>,
    p: SolverParams,
    linearDensity: number,
  ): void {
    const { positions: pos, prevPositions: prev, velocities: vel, invMass } =
      this.rope;
    const n = this.rope.count;
    const g = -p.gravity;
    const dampMul = Math.exp(-p.damping * h);
    const dragC = linearDensity > 0 ? p.airDrag / linearDensity : 0;

    // --- Integrate free particles ---
    for (let i = 1; i < n - 1; i++) {
      const i3 = i * 3;
      let vx = vel[i3] * dampMul;
      let vy = (vel[i3 + 1] + g * h) * dampMul;
      let vz = vel[i3 + 2] * dampMul;
      if (dragC > 0) {
        const sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
        const f = 1 / (1 + dragC * sp * h);
        vx *= f; vy *= f; vz *= f;
      }
      vel[i3] = vx; vel[i3 + 1] = vy; vel[i3 + 2] = vz;

      prev[i3] = pos[i3];
      prev[i3 + 1] = pos[i3 + 1];
      prev[i3 + 2] = pos[i3 + 2];
      pos[i3] += vx * h;
      pos[i3 + 1] += vy * h;
      pos[i3 + 2] += vz * h;
    }

    // --- Driven endpoints: kinematic targets ---
    const e3 = (n - 1) * 3;
    prev[0] = pos[0]; prev[1] = pos[1]; prev[2] = pos[2];
    prev[e3] = pos[e3]; prev[e3 + 1] = pos[e3 + 1]; prev[e3 + 2] = pos[e3 + 2];
    pos[0] = endA[0]; pos[1] = endA[1]; pos[2] = endA[2];
    pos[e3] = endB[0]; pos[e3 + 1] = endB[1]; pos[e3 + 2] = endB[2];

    // --- Constraint solve ---
    for (const c of this.distance) c.resetLambda();
    for (const c of this.bending) c.resetLambda();
    for (let it = 0; it < p.iterations; it++) {
      for (const c of this.distance) c.solve(pos, invMass, h);
      for (const c of this.bending) c.solve(pos, invMass, h);
      if (p.floorCollision) this.projectFloor(pos, p.floorOffset);
    }
    if (p.floorCollision) this.projectFloor(pos, p.floorOffset);

    // --- Velocity reconstruction ---
    const invH = 1 / h;
    for (let i = 0; i < n * 3; i++) {
      vel[i] = (pos[i] - prev[i]) * invH;
    }

    // Floor friction: damp tangential velocity of contacting particles.
    if (p.floorCollision && p.floorFriction > 0) {
      const keep = floorFrictionKeep(p.floorFriction, h);
      for (let i = 1; i < n - 1; i++) {
        const i3 = i * 3;
        if (pos[i3 + 1] <= p.floorOffset + 1e-4) {
          vel[i3] *= keep;
          vel[i3 + 2] *= keep;
        }
      }
    }

    // --- Sanity check: cheap scan for NaN / explosion ---
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const x = pos[i3], y = pos[i3 + 1], z = pos[i3 + 2];
      if (
        !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z) ||
        Math.abs(x) > 1e4 || Math.abs(y) > 1e4 || Math.abs(z) > 1e4
      ) {
        this.unstable = true;
        return;
      }
    }
  }

  /** Unilateral floor contact: clamp free particles to y >= offset. */
  private projectFloor(pos: Float32Array, offset: number): void {
    const n = this.rope.count;
    for (let i = 1; i < n - 1; i++) {
      const i3 = i * 3;
      if (pos[i3 + 1] < offset) pos[i3 + 1] = offset;
    }
  }
}
