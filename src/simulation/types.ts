/** All tunable parameters of the experiment, in SI units unless noted. */
export interface SimConfig {
  // --- Drive (turners) ---
  /** Shared drive frequency in Hz (used when separateFrequencies is off). */
  frequency: number;
  separateFrequencies: boolean;
  leftFrequency: number;
  rightFrequency: number;
  /** Phase offset of the right turner relative to the left, in degrees. */
  phaseDeg: number;
  /** Radius of the hand circle in metres. */
  radius: number;
  /** +1 or -1 — rotation direction of each hand in the YZ plane. */
  leftDirection: number;
  rightDirection: number;
  /** Distance between the two rotation centres along X. */
  handleDistance: number;
  /** Height of the rotation centres. */
  handleHeight: number;

  // --- Rope ---
  ropeLength: number;
  particleCount: number;
  /** Total rope mass in kg. */
  ropeMass: number;
  /** Linear velocity damping coefficient (1/s). */
  damping: number;
  /** Quadratic air-drag coefficient per unit linear density. */
  airDrag: number;
  /** XPBD compliance of the distance constraints (m/N). 0 = inextensible. */
  compliance: number;
  /** 0..1 mapped to bending constraint compliance. */
  bendingStiffness: number;
  /** Visible rope radius in metres (rendering only). */
  ropeRadius: number;
  /** Amplitude of the mode-injection "kick" (metres). */
  kickAmplitude: number;
  /** Optional point weight on the rope (おもり). */
  pointMassEnabled: boolean;
  pointMassKg: number;
  /** Position along the rope, 0..1. */
  pointMassPos: number;

  // --- World / solver ---
  gravity: number;
  simulationSpeed: number;
  iterations: number;
  /** Fixed physics timestep in seconds. */
  physicsDt: number;
  /** Unilateral floor contact at y = ropeRadius. */
  floorCollision: boolean;
  /**
   * Floor friction while the rope touches the ground: 0 = frictionless
   * (gym floor / rope slides freely), 1 = the contacting section sticks.
   */
  floorFriction: number;
}

export interface AnalysisConfig {
  enabled: boolean;
  maxMode: number;
  nodeDetection: boolean;
  /** Envelope threshold (fraction of max amplitude) for node candidates. */
  nodeThreshold: number;
  trail: boolean;
  /** Debug: draw every particle as a point. */
  showParticles: boolean;
}

export interface SweepConfig {
  startHz: number;
  endHz: number;
  steps: number;
  settleTime: number;
  measureTime: number;
  /** Mode the "best frequency" metric targets. */
  targetMode: number;
}

/** Keys of SimConfig that may be used as sweep axes. */
export type SweepParamKey =
  | "frequency"
  | "radius"
  | "damping"
  | "airDrag"
  | "ropeMass"
  | "ropeLength"
  | "handleDistance"
  | "handleHeight"
  | "gravity"
  | "floorFriction"
  | "bendingStiffness"
  | "compliance"
  | "particleCount"
  | "iterations"
  | "physicsDt";

export interface OptimizerConfig {
  xKey: SweepParamKey;
  yKey: SweepParamKey;
  /** Coarse-pass grid ranges and per-axis cell counts. */
  xStart: number;
  xEnd: number;
  xSteps: number;
  yStart: number;
  yEnd: number;
  ySteps: number;
  /** Fine-pass grid resolution around the best coarse cell. */
  fineSteps: number;
  /** Fine-pass timings (full fidelity). */
  settleTime: number;
  measureTime: number;
  /** Coarse-pass timings (reduced fidelity — scouting only). */
  coarseSettleTime: number;
  coarseMeasureTime: number;
  targetMode: number;
  /**
   * Objective metric: modal amplitude, purity, or "jump" — amplitude
   * gated by floor reach and a person-sized opening.
   */
  metric: "amp" | "purity" | "jump";
  /** Person height the rope opening must clear, in metres. */
  personHeight: number;
  /** Reset the rope to the initial layout before every cell. */
  resetEach: boolean;
}

export interface AppConfig {
  sim: SimConfig;
  analysis: AnalysisConfig;
  sweep: SweepConfig;
  optimizer: OptimizerConfig;
}

export const DEFAULT_CONFIG: AppConfig = {
  sim: {
    frequency: 1.1,
    separateFrequencies: false,
    leftFrequency: 1.1,
    rightFrequency: 1.1,
    phaseDeg: 0,
    radius: 0.85,
    leftDirection: 1,
    rightDirection: 1,
    handleDistance: 7.0,
    handleHeight: 1.35,
    ropeLength: 8.5,
    particleCount: 121,
    ropeMass: 1.2,
    damping: 0.35,
    airDrag: 0.12,
    compliance: 0,
    bendingStiffness: 0.25,
    ropeRadius: 0.014,
    kickAmplitude: 0.5,
    pointMassEnabled: false,
    pointMassKg: 1.0,
    pointMassPos: 1 / 3,
    gravity: 9.81,
    simulationSpeed: 1,
    iterations: 30,
    physicsDt: 1 / 240,
    floorCollision: true,
    floorFriction: 0.12,
  },
  analysis: {
    enabled: true,
    maxMode: 6,
    nodeDetection: true,
    nodeThreshold: 0.42,
    trail: false,
    showParticles: false,
  },
  sweep: {
    startHz: 0.4,
    endHz: 4.0,
    steps: 19,
    settleTime: 4,
    measureTime: 5,
    targetMode: 3,
  },
  optimizer: {
    // Human-adjustable axes; frequency stays fixed at a jumpable cadence.
    xKey: "radius",
    yKey: "ropeLength",
    xStart: 0.4,
    xEnd: 1.0,
    xSteps: 7,
    yStart: 7.5,
    yEnd: 10.5,
    ySteps: 5,
    fineSteps: 5,
    settleTime: 2.5,
    measureTime: 3,
    coarseSettleTime: 1.2,
    coarseMeasureTime: 1.5,
    targetMode: 1,
    metric: "jump",
    personHeight: 1.7,
    resetEach: true,
  },
};
