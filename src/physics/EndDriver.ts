import { degToRad } from "../utils/math";

/**
 * Circular end driver: the hand moves on a circle in the YZ plane.
 *   Y = Y0 + R cos(theta(t))
 *   Z = R sin(theta(t))
 *   theta(t) = direction * (2*pi*f*t) + phase
 * Deliberately isolated so a non-circular "arm" trajectory can replace it later.
 */
export class CircularDriver {
  cx = 0;
  cy = 0;
  cz = 0;
  radius = 0.35;
  frequency = 1.0; // Hz
  phaseRad = 0;
  direction = 1; // +1 / -1

  setPhaseDeg(deg: number): void {
    this.phaseRad = degToRad(deg);
  }

  /** Writes x,y,z into out at offsets 0,1,2. */
  positionAt(t: number, out: Float32Array | number[], o = 0): void {
    const theta = this.direction * (2 * Math.PI * this.frequency * t) + this.phaseRad;
    out[o] = this.cx;
    out[o + 1] = this.cy + this.radius * Math.cos(theta);
    out[o + 2] = this.cz + this.radius * Math.sin(theta);
  }
}
