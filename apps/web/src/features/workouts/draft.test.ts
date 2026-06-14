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
    sets: [],
    ...overrides,
  };
}

describe("fromEntryDetail", () => {
  it("collapses a strength entry's uniform sets into a single line", () => {
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
    expect(draft.line).toEqual({
      count: 3,
      reps: 8,
      weight: 40,
      weightUnit: "kg",
      loadType: "per_side",
      barWeight: 20,
    });
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

  it("defaults to a single set when a strength entry has no sets", () => {
    const draft = fromEntryDetail(baseEntry(), { name: "Curl", type: "strength" });
    expect(draft.line.count).toBe(1);
    expect(draft.line.weightUnit).toBe("kg");
    expect(draft.line.loadType).toBe("total");
    expect(draft.line.reps).toBeNull();
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
