/**
 * Jumpability tracking: does the simulated rope state leave a person
 * room to actually jump? Two physical requirements are measured over a
 * time window:
 *
 *  1. Ground reach — the rope's lowest point must dip to the floor
 *     (a real long rope grazes the ground once per revolution). A rope
 *     hovering 30 cm up can never be jumped; one lying on the floor is
 *     dragging, not jumping, so constant contact is penalised.
 *  2. Opening height — at some point along the rope the vertical extent
 *     of the whirl (maxY_i − minY_i) must exceed a person's height so
 *     the rope can pass overhead while they stand inside the loop.
 */

export interface JumpStats {
  /** Lowest particle height seen in the window (m). */
  minY: number;
  /** Best vertical opening along the rope: max_i (maxY_i − minY_i) (m). */
  maxOpening: number;
  /** Fraction of the window with a particle within `margin` of the floor. */
  contactFrac: number;
}

export class ClearanceTracker implements JumpStats {
  private loY!: Float32Array;
  private hiY!: Float32Array;
  private contactTime = 0;
  private elapsed = 0;
  private gMin = Infinity;

  /**
   * @param floorY height of the ground plane (world y = 0)
   * @param margin how close a particle must get to count as "touching"
   */
  constructor(
    count: number,
    private floorY = 0,
    private margin = 0.06,
  ) {
    this.resize(count);
  }

  resize(count: number): void {
    this.loY = new Float32Array(count);
    this.hiY = new Float32Array(count);
    this.reset();
  }

  /** Starts a new measurement window. */
  reset(): void {
    this.loY.fill(Infinity);
    this.hiY.fill(-Infinity);
    this.contactTime = 0;
    this.elapsed = 0;
    this.gMin = Infinity;
  }

  update(positions: Float32Array, count: number, dt: number): void {
    this.elapsed += dt;
    let touching = false;
    for (let i = 0; i < count; i++) {
      const y = positions[i * 3 + 1];
      if (y < this.loY[i]) this.loY[i] = y;
      if (y > this.hiY[i]) this.hiY[i] = y;
      if (y < this.gMin) this.gMin = y;
      if (y <= this.floorY + this.margin) touching = true;
    }
    if (touching) this.contactTime += dt;
  }

  /** Lowest particle height observed in the window. */
  get minY(): number {
    return this.gMin;
  }

  /** Best vertical opening anywhere along the rope. */
  get maxOpening(): number {
    let best = 0;
    for (let i = 0; i < this.loY.length; i++) {
      const o = this.hiY[i] - this.loY[i];
      if (o > best) best = o;
    }
    return best;
  }

  get contactFrac(): number {
    return this.elapsed > 0 ? this.contactTime / this.elapsed : 0;
  }
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * 1 when the rope reaches the floor but does not stay there.
 * `minY` below floor level → full touch credit; hovering >~25 cm above
 * → 0. Contact lasting more than ~40 % of the window counts as
 * dragging and is penalised toward 0.
 */
export function groundScore(
  minY: number,
  floorY: number,
  contactFrac: number,
): number {
  const touch = clamp01(1 - (minY - floorY) / 0.25);
  const drag = clamp01(1 - Math.max(0, contactFrac - 0.4) / 0.6);
  return touch * drag;
}

/** 1 when the rope's vertical opening fits a person of `height`. */
export function clearanceScore(opening: number, height: number): number {
  return clamp01(opening / height);
}

/** Modal amplitude gated by ground reach and human clearance. */
export function jumpScore(
  modeAmp: number,
  ground: number,
  clear: number,
): number {
  return modeAmp * ground * clear;
}
