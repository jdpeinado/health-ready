import { describe, it, expect } from "vitest";
import type { SetInput } from "@health-ready/shared";
import {
  uniformToSets,
  uniformLinesToSets,
  setsToUniformLines,
  type SetGroup,
} from "./sets";

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

// A set with every field required (unlike the Zod-inferred SetInput, whose fields
// are optional) so the run-length grouping input type is satisfied.
type FullSet = {
  reps: number | null;
  weight: number | null;
  weightUnit: SetInput["weightUnit"];
  loadType: SetInput["loadType"];
  barWeight: number | null;
};

const G = (over: Partial<SetGroup> = {}): SetGroup =>
  ({
    count: 1,
    reps: 10,
    weight: 60,
    weightUnit: "kg",
    loadType: "total",
    barWeight: null,
    ...over,
  }) as SetGroup;

const S = (over: Partial<FullSet> = {}): FullSet =>
  ({
    reps: 10,
    weight: 60,
    weightUnit: "kg",
    loadType: "total",
    barWeight: null,
    ...over,
  }) as FullSet;

describe("uniformLinesToSets", () => {
  it("flattens groups in order with the right counts", () => {
    const out = uniformLinesToSets([
      G({ count: 1, weight: 60 }),
      G({ count: 3, weight: 80 }),
    ]);
    expect(out).toHaveLength(4);
    expect(out[0]?.weight).toBe(60);
    expect(out.slice(1).every((s) => s.weight === 80)).toBe(true);
  });

  it("caps the total number of sets across groups", () => {
    const out = uniformLinesToSets([G({ count: 20 }), G({ count: 20 }), G({ count: 20 })]);
    expect(out.length).toBeLessThanOrEqual(50);
  });
});

describe("setsToUniformLines", () => {
  it("collapses a uniform list into one group", () => {
    const groups = setsToUniformLines([S(), S(), S()]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.count).toBe(3);
  });

  it("keeps distinct consecutive weights as separate groups", () => {
    const groups = setsToUniformLines([
      S({ weight: 60 }),
      S({ weight: 80 }),
      S({ weight: 80 }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ count: 1, weight: 60 });
    expect(groups[1]).toMatchObject({ count: 2, weight: 80 });
  });

  it("returns a single default group for an empty list", () => {
    const groups = setsToUniformLines([]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({
      count: 1,
      reps: null,
      weightUnit: "kg",
      loadType: "total",
    });
  });

  it.each<[string, FullSet[]]>([
    ["uniform", [S(), S(), S()]],
    ["first-set-different", [S({ weight: 60, reps: 1 }), S({ weight: 80 }), S({ weight: 80 })]],
    ["fully ramped", [S({ weight: 60 }), S({ weight: 70 }), S({ weight: 80 })]],
  ])("round-trips %s sets losslessly", (_label, sets) => {
    expect(uniformLinesToSets(setsToUniformLines(sets))).toEqual(sets);
  });
});
