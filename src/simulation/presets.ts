import { AppConfig } from "./types";

export interface Preset {
  name: string;
  description: string;
  apply(cfg: AppConfig): void;
}

/**
 * Presets only choose physically-plausible parameters — the loops must be
 * produced by the simulation itself.
 */
export const PRESETS: Record<string, Preset> = {
  normal: {
    name: "Normal",
    description:
      "Single loop, in phase — rope grazes the floor with a person-sized opening.",
    apply(cfg) {
      cfg.sim.frequency = 1.1;
      cfg.sim.separateFrequencies = false;
      cfg.sim.phaseDeg = 0;
      cfg.sim.radius = 0.85;
      cfg.sim.leftDirection = 1;
      cfg.sim.rightDirection = 1;
      cfg.sim.ropeLength = 8.5;
      cfg.sim.handleDistance = 7.0;
      cfg.sim.handleHeight = 1.35;
      cfg.sim.damping = 0.35;
      cfg.sim.gravity = 9.81;
      cfg.sim.floorCollision = true;
      cfg.sim.floorFriction = 0.12;
    },
  },
  double: {
    name: "Double Loop",
    description: "Hands 180° out of phase — searches for a 2-loop state.",
    apply(cfg) {
      cfg.sim.frequency = 1.1;
      cfg.sim.separateFrequencies = false;
      cfg.sim.phaseDeg = 180;
      cfg.sim.radius = 0.7;
      cfg.sim.leftDirection = 1;
      cfg.sim.rightDirection = 1;
      cfg.sim.ropeLength = 8.5;
      cfg.sim.handleDistance = 7.0;
      cfg.sim.damping = 0.3;
      cfg.sim.gravity = 9.81;
      cfg.sim.floorCollision = true;
      cfg.sim.floorFriction = 0.12;
    },
  },
  triple: {
    name: "Triple Search",
    description:
      "In-phase hands + frequency sweep to hunt for the 3rd spatial mode.",
    apply(cfg) {
      cfg.sim.frequency = 1.0;
      cfg.sim.separateFrequencies = false;
      cfg.sim.phaseDeg = 0;
      cfg.sim.radius = 0.4;
      cfg.sim.leftDirection = 1;
      cfg.sim.rightDirection = 1;
      cfg.sim.ropeLength = 9.0;
      cfg.sim.handleDistance = 7.0;
      // Heavier, lightly-damped rope gave the strongest mode-3 response
      // in headless parameter probes.
      cfg.sim.ropeMass = 2.0;
      cfg.sim.damping = 0.2;
      cfg.sim.gravity = 9.81;
      cfg.sim.floorCollision = true;
      cfg.sim.floorFriction = 0.12;
      cfg.sweep.startHz = 1.0;
      cfg.sweep.endHz = 4.5;
      cfg.sweep.targetMode = 3;
    },
  },
  slick: {
    name: "Slick floor",
    description:
      "つるつる床 — near-frictionless ground. Grid search best: the loop keeps a" +
      " 2.0 m opening and only grazes the floor (~10 % contact).",
    apply(cfg) {
      cfg.sim.frequency = 1.0;
      cfg.sim.separateFrequencies = false;
      cfg.sim.phaseDeg = 0;
      cfg.sim.radius = 0.95;
      cfg.sim.leftDirection = 1;
      cfg.sim.rightDirection = 1;
      cfg.sim.ropeLength = 8.5;
      cfg.sim.handleDistance = 7.0;
      cfg.sim.handleHeight = 1.35;
      cfg.sim.damping = 0.35;
      cfg.sim.gravity = 9.81;
      cfg.sim.floorCollision = true;
      cfg.sim.floorFriction = 0.02;
    },
  },
  sticky: {
    name: "Sticky floor",
    description:
      "ざらざら床 — same geometry as Slick with a grabbing ground: the" +
      " contacting section is pinned and the rope scrapes instead of sliding.",
    apply(cfg) {
      PRESETS.slick.apply(cfg);
      cfg.sim.floorFriction = 0.85;
    },
  },
};
