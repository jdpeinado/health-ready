import { describe, it, expect } from "vitest";
import { uniformToSets } from "./sets";

describe("uniformToSets", () => {
  it("expands a uniform line into N identical sets", () => {
    const out = uniformToSets({
      count: 3,
      reps: 10,
      weight: 57,
      weightUnit: "kg",
      loadType: "total",
      barWeight: null,
    });
    expect(out).toHaveLength(3);
    expect(
      out.every(
        (s) => s.reps === 10 && s.weight === 57 && s.loadType === "total",
      ),
    ).toBe(true);
  });

  it("clamps the count to at least 1", () => {
    expect(
      uniformToSets({
        count: 0,
        reps: 5,
        weight: null,
        weightUnit: null,
        loadType: "bodyweight",
        barWeight: null,
      }),
    ).toHaveLength(1);
  });

  it("caps the count to a sane maximum (20)", () => {
    expect(
      uniformToSets({
        count: 999,
        reps: 5,
        weight: 10,
        weightUnit: "kg",
        loadType: "total",
        barWeight: null,
      }),
    ).toHaveLength(20);
  });
});
