import { LongRopeSimulation } from "../src/simulation/LongRopeSimulation";
import { ModeAnalyzer } from "../src/analysis/ModeAnalyzer";
import { NodeDetector } from "../src/analysis/NodeDetector";
import { cloneConfig } from "../src/utils/config";
import { DEFAULT_CONFIG } from "../src/simulation/types";

/**
 * Hypothesis: a mode-3 rotating state is stable but unreachable from rest.
 * Test: initialise the rope as a rotating sin(3*pi*x) lobe and see whether
 * in-phase drive sustains it, and at which frequencies.
 */
function run(f: number, amp: number, secs = 14) {
  const cfg = cloneConfig(DEFAULT_CONFIG);
  cfg.sim.frequency = f;
  cfg.sim.phaseDeg = 0;
  cfg.sim.radius = 0.35;
  cfg.sim.ropeMass = 2.0;
  cfg.sim.damping = 0.2;
  const sim = new LongRopeSimulation(cfg.sim);
  const rope = sim.rope;
  const N = rope.count;
  const w = 2 * Math.PI * f;
  // Initial shape: rotating mode-3 — offset in Y, rotational velocity in Z.
  for (let i = 1; i < N - 1; i++) {
    const s = amp * Math.sin((3 * Math.PI * i) / (N - 1));
    rope.positions[i * 3 + 1] += s;
    rope.prevPositions[i * 3 + 1] = rope.positions[i * 3 + 1];
    rope.velocities[i * 3 + 2] = s * w; // d/dt of sin -> w·cos at t=0
  }
  const an = new ModeAnalyzer(N);
  const det = new NodeDetector(N);
  const dt = 1 / 60;
  // measure over the last 6 s
  for (let k = 0; k < 60 * secs; k++) {
    sim.advance(dt);
    if (k >= 60 * (secs - 6)) {
      an.update(rope.positions, dt, 6);
      det.update(an.fluctMag, dt, 0.42);
    }
  }
  const amps = Array.from(an.amplitudes.slice(1, 6)).map((a) => a.toFixed(2)).join(" ");
  console.log(
    `f=${f.toFixed(2)} A=${amp} amps:[${amps}] dom=${an.dominant} p3=${an.purities[3].toFixed(2)} nodes=${det.nodes.length} ${sim.unstable ? "UNSTABLE" : ""}`,
  );
}

for (const f of [1.5, 2.0, 2.5, 3.0, 3.5, 4.0]) run(f, 0.8);
console.log("--- smaller kick ---");
for (const f of [2.5, 3.0, 3.5]) run(f, 0.4);
