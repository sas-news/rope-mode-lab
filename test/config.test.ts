import { describe, expect, it } from "vitest";
import {
  cloneConfig,
  configFromHash,
  configFromJSON,
  configToHash,
} from "../src/utils/config";
import { DEFAULT_CONFIG } from "../src/simulation/types";

describe("config export/import", () => {
  it("round-trips through a URL hash", () => {
    const cfg = cloneConfig(DEFAULT_CONFIG);
    cfg.sim.frequency = 2.34;
    cfg.sim.phaseDeg = 180;
    cfg.sim.ropeLength = 8.5;
    cfg.sweep.steps = 25;
    const hash = configToHash(cfg);
    const back = configFromHash(hash);
    expect(back).not.toBeNull();
    expect(back!.sim.frequency).toBeCloseTo(2.34);
    expect(back!.sim.phaseDeg).toBe(180);
    expect(back!.sim.ropeLength).toBeCloseTo(8.5);
    expect(back!.sweep.steps).toBe(25);
  });

  it("merges a partial JSON export over defaults", () => {
    const back = configFromJSON('{"sim":{"gravity":1.62}}');
    expect(back).not.toBeNull();
    expect(back!.sim.gravity).toBeCloseTo(1.62);
    expect(back!.sim.ropeLength).toBe(DEFAULT_CONFIG.sim.ropeLength);
  });

  it("rejects malformed JSON", () => {
    expect(configFromJSON("{nope")).toBeNull();
    expect(configFromHash("#c=%7Bbad")).toBeNull();
    expect(configFromHash("#other=1")).toBeNull();
  });
});
