export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Exponential smoothing factor for a given time constant. */
export function dampFactor(dt: number, tau: number): number {
  return 1 - Math.exp(-dt / Math.max(tau, 1e-6));
}

export function degToRad(d: number): number {
  return (d * Math.PI) / 180;
}

export function radToDeg(r: number): number {
  return (r * 180) / Math.PI;
}

export function isFinite3(arr: Float32Array, i3: number): boolean {
  return (
    Number.isFinite(arr[i3]) &&
    Number.isFinite(arr[i3 + 1]) &&
    Number.isFinite(arr[i3 + 2])
  );
}
