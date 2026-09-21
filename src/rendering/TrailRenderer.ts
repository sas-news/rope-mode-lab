import * as THREE from "three";

const TRAIL_POINTS = 480;

/** Fading trail of the rope midpoint — makes rotation/mode shape visible. */
export class TrailRenderer {
  readonly line: THREE.Line;
  private readonly buf: Float32Array;
  private head = 0;
  private filled = 0;
  private enabled = false;

  constructor() {
    this.buf = new Float32Array(TRAIL_POINTS * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3));
    const colors = new Float32Array(TRAIL_POINTS * 3);
    for (let i = 0; i < TRAIL_POINTS; i++) {
      const f = i / TRAIL_POINTS; // newest brightest
      colors[i * 3] = 0.2 + 0.8 * f;
      colors[i * 3 + 1] = 0.5 + 0.4 * f;
      colors[i * 3 + 2] = 1.0;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
    });
    this.line = new THREE.Line(geo, mat);
    this.line.frustumCulled = false;
    this.line.visible = false;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.line.visible = on;
    if (on) {
      this.head = 0;
      this.filled = 0;
    }
  }

  update(positions: Float32Array, count: number): void {
    if (!this.enabled) return;
    const mid = (count >> 1) * 3;
    const b = this.head * 3;
    this.buf[b] = positions[mid];
    this.buf[b + 1] = positions[mid + 1];
    this.buf[b + 2] = positions[mid + 2];
    this.head = (this.head + 1) % TRAIL_POINTS;
    if (this.filled < TRAIL_POINTS) this.filled++;

    // Reorder ring buffer into the attribute oldest->newest.
    const attr = this.line.geometry.getAttribute("position") as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    for (let i = 0; i < this.filled; i++) {
      const src = ((this.head - this.filled + i + TRAIL_POINTS * 2) % TRAIL_POINTS) * 3;
      arr[i * 3] = this.buf[src];
      arr[i * 3 + 1] = this.buf[src + 1];
      arr[i * 3 + 2] = this.buf[src + 2];
    }
    attr.needsUpdate = true;
    this.line.geometry.setDrawRange(0, this.filled);
  }
}
