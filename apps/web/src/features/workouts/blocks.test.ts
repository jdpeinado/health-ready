import { describe, it, expect } from "vitest";
import type { DraftEntry } from "./EntryEditor";
import { blocksToEntries, entriesToBlocks, type Block } from "./blocks";
import type { EntryDetail } from "../../api/types";

function draft(exerciseId: string): DraftEntry {
  return {
    exerciseId,
    exerciseName: exerciseId,
    exerciseType: "strength",
    comment: "",
    lines: [{ count: 1, reps: 5, weight: null, weightUnit: "kg", loadType: "total", barWeight: null }],
    durationMinutes: null,
    distance: null,
    distanceUnit: "km",
  };
}

describe("blocksToEntries", () => {
  it("assigns one shared groupId + groupType to a group's entries", () => {
    const blocks: Block[] = [
      { kind: "group", id: "blk1", groupId: "g-abc", groupType: "biserie", entries: [draft("a"), draft("b")] },
    ];
    const entries = blocksToEntries(blocks);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.groupId).toBe("g-abc");
    expect(entries[1]!.groupId).toBe("g-abc");
    expect(entries[0]!.groupType).toBe("biserie");
    expect(entries[1]!.groupType).toBe("biserie");
  });

  it("leaves singles ungrouped", () => {
    const blocks: Block[] = [{ kind: "single", id: "s1", entry: draft("a") }];
    const entries = blocksToEntries(blocks);
    expect(entries[0]!.groupId).toBeNull();
    expect(entries[0]!.groupType).toBeNull();
  });

  it("degrades a group of <2 entries to singles", () => {
    const blocks: Block[] = [
      { kind: "group", id: "blk1", groupId: "g-abc", groupType: "triserie", entries: [draft("a")] },
    ];
    const entries = blocksToEntries(blocks);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.groupId).toBeNull();
    expect(entries[0]!.groupType).toBeNull();
  });

  it("drops empty groups", () => {
    const blocks: Block[] = [
      { kind: "group", id: "blk1", groupId: "g-abc", groupType: "biserie", entries: [] },
    ];
    expect(blocksToEntries(blocks)).toHaveLength(0);
  });
});

describe("entriesToBlocks", () => {
  const toDraft = (e: EntryDetail): DraftEntry => draft(e.exerciseId);
  const base = {
    id: "x", orderIndex: 0, comment: null, durationSeconds: null,
    distance: null, distanceUnit: null, sets: [],
  };

  it("groups consecutive entries sharing a groupId", () => {
    const entries: EntryDetail[] = [
      { ...base, id: "1", exerciseId: "a", groupId: "g1", groupType: "biserie" },
      { ...base, id: "2", exerciseId: "b", groupId: "g1", groupType: "biserie" },
      { ...base, id: "3", exerciseId: "c", groupId: null, groupType: null },
    ];
    const blocks = entriesToBlocks(entries, toDraft);
    expect(blocks).toHaveLength(2);
    const g = blocks[0]!;
    expect(g.kind).toBe("group");
    if (g.kind === "group") {
      expect(g.groupId).toBe("g1");
      expect(g.groupType).toBe("biserie");
      expect(g.entries).toHaveLength(2);
    }
    expect(blocks[1]!.kind).toBe("single");
  });
});
