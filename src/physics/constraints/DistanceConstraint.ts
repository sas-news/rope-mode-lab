/**
 * XPBD distance constraint: |p_j - p_i| = rest.
 * compliance is the physical compliance alpha (m/N); alphaTilde = alpha / h^2.
 * With compliance = 0 this reduces to the classic PBD projection.
 */
export class DistanceConstraint {
  constructor(
    public i: number,
    public j: number,
    public rest: number,
    public compliance: number,
  ) {}

  lambda = 0;

  resetLambda(): void {
    this.lambda = 0;
  }

  solve(pos: Float32Array, invMass: Float32Array, h: number): void {
    const w1 = invMass[this.i];
    const w2 = invMass[this.j];
    const alphaTilde = this.compliance / (h * h);
    const denom = w1 + w2 + alphaTilde;
    if (denom === 0) return;

    const i3 = this.i * 3;
    const j3 = this.j * 3;
    const dx = pos[j3] - pos[i3];
    const dy = pos[j3 + 1] - pos[i3 + 1];
    const dz = pos[j3 + 2] - pos[i3 + 2];
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < 1e-9) return;

    const C = dist - this.rest;
    const dLambda = (-C - alphaTilde * this.lambda) / denom;
    this.lambda += dLambda;

    const s = dLambda / dist;
    pos[i3] -= dx * s * w1;
    pos[i3 + 1] -= dy * s * w1;
    pos[i3 + 2] -= dz * s * w1;
    pos[j3] += dx * s * w2;
    pos[j3 + 1] += dy * s * w2;
    pos[j3 + 2] += dz * s * w2;
  }
}
