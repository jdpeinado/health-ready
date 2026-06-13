import { describe, it, expect } from "vitest";
import { toKg, computeTotalLoadKg } from "@health-ready/shared";

describe("computeTotalLoadKg", () => {
  it("converts lb to kg", () => {
    expect(toKg(100, "lb")).toBeCloseTo(45.359237, 5);
    expect(toKg(50, "kg")).toBe(50);
  });

  it("total load is the weight as-is", () => {
    expect(computeTotalLoadKg({ weight: 57, weightUnit: "kg", loadType: "total", barWeight: null })).toBe(57);
  });

  it("per_side doubles and adds bar weight", () => {
    expect(
      computeTotalLoadKg({ weight: 25, weightUnit: "kg", loadType: "per_side", barWeight: 20 }),
    ).toBe(70);
  });

  it("per_dumbbell doubles", () => {
    expect(
      computeTotalLoadKg({ weight: 50, weightUnit: "lb", loadType: "per_dumbbell", barWeight: null }),
    ).toBeCloseTo(45.359237, 4);
  });

  it("bodyweight has no load", () => {
    expect(
      computeTotalLoadKg({ weight: null, weightUnit: null, loadType: "bodyweight", barWeight: null }),
    ).toBeNull();
  });

  it("bodyweight_added is the added weight", () => {
    expect(
      computeTotalLoadKg({ weight: 5, weightUnit: "kg", loadType: "bodyweight_added", barWeight: null }),
    ).toBe(5);
  });

  it("returns null when load is unspecified", () => {
    expect(computeTotalLoadKg({ weight: null, weightUnit: null, loadType: null, barWeight: null })).toBeNull();
  });
});
