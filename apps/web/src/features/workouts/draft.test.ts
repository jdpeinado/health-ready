import { describe, it, expect } from "vitest";
import { fromEntryDetail, toEntryInput } from "./EntryEditor";
import type { EntryDetail } from "../../api/types";

function baseEntry(overrides: Partial<EntryDetail> = {}): EntryDetail {
  return {
    id: "entry-1",
    exerciseId: "ex-1",
    orderIndex: 0,
    comment: null,
    durationSeconds: null,
    distance: null,
    distanceUnit: null,
    groupId: null,
    groupType: null,
    sets: [],
    ...overrides,
  };
}

describe("fromEntryDetail", () => {
  it("collapses a strength entry's uniform sets into a single group", () => {
    const entry = baseEntry({
      comment: "felt strong",
      sets: [0, 1, 2].map((i) => ({
        id: `set-${i}`,
        setIndex: i,
        reps: 8,
        weight: 40,
        weightUnit: "kg" as const,
        loadType: "per_side" as const,
        barWeight: 20,
      })),
    });

    const draft = fromEntryDetail(entry, { name: "Bench", type: "strength" });

    expect(draft.exerciseId).toBe("ex-1");
    expect(draft.exerciseName).toBe("Bench");
    expect(draft.exerciseType).toBe("strength");
    expect(draft.comment).toBe("felt strong");
    expect(draft.lines).toHaveLength(1);
    expect(draft.lines[0]).toEqual({
      count: 3,
      reps: 8,
      weight: 40,
      weightUnit: "kg",
      loadType: "per_side",
      barWeight: 20,
    });
  });

  it("preserves varying weights as separate groups (no longer collapsed)", () => {
    const entry = baseEntry({
      sets: [
        { id: "s0", setIndex: 0, reps: 1, weight: 60, weightUnit: "kg" as const, loadType: "total" as const, barWeight: null },
        { id: "s1", setIndex: 1, reps: 8, weight: 80, weightUnit: "kg" as const, loadType: "total" as const, barWeight: null },
        { id: "s2", setIndex: 2, reps: 8, weight: 80, weightUnit: "kg" as const, loadType: "total" as const, barWeight: null },
      ],
    });

    const draft = fromEntryDetail(entry, { name: "Squat", type: "strength" });
    expect(draft.lines).toHaveLength(2);
    expect(draft.lines[0]).toMatchObject({ count: 1, weight: 60, reps: 1 });
    expect(draft.lines[1]).toMatchObject({ count: 2, weight: 80, reps: 8 });

    // Round-trip preserves every set's weight (the old behavior flattened to set[0]).
    const back = toEntryInput(draft);
    expect(back.sets.map((s) => s.weight)).toEqual([60, 80, 80]);
    expect(back.sets.map((s) => s.reps)).toEqual([1, 8, 8]);
  });

  it("round-trips a strength entry through toEntryInput", () => {
    const sets = [0, 1, 2].map((i) => ({
      id: `set-${i}`,
      setIndex: i,
      reps: 10,
      weight: 60,
      weightUnit: "kg" as const,
      loadType: "total" as const,
      barWeight: null,
    }));
    const entry = baseEntry({ comment: "note", sets });

    const back = toEntryInput(
      fromEntryDetail(entry, { name: "Squat", type: "strength" }),
    );

    expect(back.exerciseId).toBe("ex-1");
    expect(back.comment).toBe("note");
    expect(back.sets).toHaveLength(3);
    expect(back.sets[0]).toEqual({
      reps: 10,
      weight: 60,
      weightUnit: "kg",
      loadType: "total",
      barWeight: null,
    });
  });

  it("defaults to a single group when a strength entry has no sets", () => {
    const draft = fromEntryDetail(baseEntry(), { name: "Curl", type: "strength" });
    expect(draft.lines).toHaveLength(1);
    expect(draft.lines[0]?.count).toBe(1);
    expect(draft.lines[0]?.weightUnit).toBe("kg");
    expect(draft.lines[0]?.loadType).toBe("total");
    expect(draft.lines[0]?.reps).toBeNull();
  });

  it("converts a cardio entry's seconds back to minutes", () => {
    const entry = baseEntry({
      durationSeconds: 1800,
      distance: 5,
      distanceUnit: "km",
    });

    const draft = fromEntryDetail(entry, { name: "Run", type: "cardio" });

    expect(draft.exerciseType).toBe("cardio");
    expect(draft.durationMinutes).toBe(30);
    expect(draft.distance).toBe(5);
    expect(draft.distanceUnit).toBe("km");
  });

  it("maps a mobility entry to just its comment", () => {
    const entry = baseEntry({ comment: "10 min stretching" });

    const draft = fromEntryDetail(entry, { name: "Stretch", type: "mobility" });

    expect(draft.exerciseType).toBe("mobility");
    expect(draft.comment).toBe("10 min stretching");
  });
});
