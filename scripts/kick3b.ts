import { LongRopeSimulation } from "../src/simulation/LongRopeSimulation";
import { ModeAnalyzer } from "../src/analysis/ModeAnalyzer";
import { NodeDetector } from "../src/analysis/NodeDetector";
import { cloneConfig } from "../src/utils/config";
import { DEFAULT_CONFIG } from "../src/simulation/types";

/**
 * Round 2: nearly-taut rope (small slack) + high rotation speed.
 * Centrifugal stiffening should let higher modes survive.
 * Also sanity-checks parity: a mode-4 kick under 180° drive.
 */
function run(
  f: number,
  kickMode: number,
  amp: number,
  phase: number,
  slack: { ropeLength: number; handleDistance: number },
  secs = 14,
) {
  const cfg = cloneConfig(DEFAULT_CONFIG);
  cfg.sim.frequency = f;
  cfg.sim.phaseDeg = phase;
  cfg.sim.radius = 0.3;
  cfg.sim.ropeMass = 1.2;
  cfg.sim.damping = 0.15;
  Object.assign(cfg.sim, slack);
  const sim = new LongRopeSimulation(cfg.sim);
  const rope = sim.rope;
  const N = rope.count;
  const w = 2 * Math.PI * f;
  for (let i = 1; i < N - 1; i++) {
    const s = amp * Math.sin((kickMode * Math.PI * i) / (N - 1));
    rope.positions[i * 3 + 1] += s;
    rope.prevPositions[i * 3 + 1] = rope.positions[i * 3 + 1];
    rope.velocities[i * 3 + 2] = s * w;
  }
  const an = new ModeAnalyzer(N);
  const det = new NodeDetector(N);
  const dt = 1 / 60;
  for (let k = 0; k < 60 * secs; k++) {
    sim.advance(dt);
    if (k >= 60 * (secs - 6)) {
      an.update(rope.positions, dt, 6);
      det.update(an.fluctMag, dt, 0.42);
    }
  }
  const amps = Array.from(an.amplitudes.slice(1, 7)).map((a) => a.toFixed(2)).join(" ");
  console.log(
    `f=${f.toFixed(2)} kick=n${kickMode} ph=${phase} L=${slack.ropeLength} amps:[${amps}] dom=${an.dominant} nodes=${det.nodes.length} ${sim.unstable ? "UNSTABLE" : ""}`,
  );
}

const taut = { ropeLength: 7.3, handleDistance: 7.0 };
const tight = { ropeLength: 7.15, handleDistance: 7.0 };

console.log("=== taut rope, mode-3 kick, phase 0 ===");
for (const f of [2.5, 3.0, 3.5, 4.0, 4.5, 5.0]) run(f, 3, 0.5, 0, taut);
console.log("=== tighter ===");
for (const f of [3.0, 4.0, 5.0]) run(f, 3, 0.5, 0, tight);
console.log("=== parity check: mode-4 kick, phase 180 ===");
for (const f of [2.0, 3.0, 4.0]) run(f, 4, 0.5, 180, taut);
console.log("=== mode-2 kick phase 180 (should persist) ===");
for (const f of [1.0, 1.5]) run(f, 2, 0.5, 180, taut);
