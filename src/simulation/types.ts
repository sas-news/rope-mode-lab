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

  // --- World / solver ---
  gravity: number;
  simulationSpeed: number;
  iterations: number;
  /** Fixed physics timestep in seconds. */
  physicsDt: number;
  /** Unilateral floor contact at y = ropeRadius. */
  floorCollision: boolean;
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

export interface AppConfig {
  sim: SimConfig;
  analysis: AnalysisConfig;
  sweep: SweepConfig;
}

export const DEFAULT_CONFIG: AppConfig = {
  sim: {
    frequency: 1.1,
    separateFrequencies: false,
    leftFrequency: 1.1,
    rightFrequency: 1.1,
    phaseDeg: 0,
    radius: 0.35,
    leftDirection: 1,
    rightDirection: 1,
    handleDistance: 7.0,
    handleHeight: 1.35,
    ropeLength: 9.0,
    particleCount: 121,
    ropeMass: 1.2,
    damping: 0.35,
    airDrag: 0.12,
    compliance: 0,
    bendingStiffness: 0.25,
    ropeRadius: 0.014,
    gravity: 9.81,
    simulationSpeed: 1,
    iterations: 30,
    physicsDt: 1 / 240,
    floorCollision: true,
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
};
