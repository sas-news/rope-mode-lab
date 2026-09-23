import { describe, expect, it } from "vitest";
import { PARAM_LABELS, PARAM_OPTIONS } from "../src/ui/heatmapChart";
import { DEFAULT_CONFIG, SweepParamKey } from "../src/simulation/types";

describe("optimizer axis dropdown options", () => {
  it("maps display label to the param key lil-gui must store", () => {
    for (const [label, key] of Object.entries(PARAM_OPTIONS)) {
      expect(PARAM_LABELS[key]).toBe(label);
    }
  });

  it("covers every sweep param and keeps labels unique", () => {
    const keys = Object.keys(PARAM_LABELS) as SweepParamKey[];
    expect(Object.keys(PARAM_OPTIONS)).toHaveLength(keys.length);
  });

  it("stores keys that exist on the sim config", () => {
    const sim = DEFAULT_CONFIG.sim as unknown as Record<string, unknown>;
    for (const key of Object.values(PARAM_OPTIONS)) {
      expect(typeof sim[key]).toBe("number");
    }
  });
});
