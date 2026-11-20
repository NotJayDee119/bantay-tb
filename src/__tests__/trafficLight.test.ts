import { describe, expect, it } from "vitest";
import { caseRanges, formatRange, trafficLightFor } from "../lib/trafficLight";

describe("trafficLightFor", () => {
  it("is red from the 95% hotspot threshold up", () => {
    expect(trafficLightFor(1.96)).toBe("red");
    expect(trafficLightFor(3.1)).toBe("red");
  });
  it("is yellow between 90% and 95% confidence", () => {
    expect(trafficLightFor(1.645)).toBe("yellow");
    expect(trafficLightFor(1.95)).toBe("yellow");
  });
  it("is green below the watch threshold, coldspots and missing scores included", () => {
    expect(trafficLightFor(1.64)).toBe("green");
    expect(trafficLightFor(-2.7)).toBe("green");
    expect(trafficLightFor(null)).toBe("green");
  });
});

describe("caseRanges", () => {
  it("reports the case-count range each colour covers", () => {
    const r = caseRanges([
      { case_count: 40, gi_z: 2.8 },
      { case_count: 12, gi_z: 2.0 },
      { case_count: 9, gi_z: 1.7 },
      { case_count: 3, gi_z: 0.2 },
      { case_count: 0, gi_z: -1 },
    ]);
    expect(r.red).toEqual({ barangays: 2, min: 12, max: 40 });
    expect(r.yellow).toEqual({ barangays: 1, min: 9, max: 9 });
    expect(r.green).toEqual({ barangays: 2, min: 0, max: 3 });
    expect(formatRange(r.red)).toBe("12–40 cases · 2 barangays");
    expect(formatRange(null)).toBe("none this run");
  });
});
