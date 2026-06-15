import type { SetInput } from "@health-ready/shared";

export interface UniformLine {
  count: number;
  reps: number | null;
  weight: number | null;
  weightUnit: SetInput["weightUnit"];
  loadType: SetInput["loadType"];
  barWeight: number | null;
}

// A "set group" is a uniform run of sets within one exercise. The common case is a
// single group (e.g. 3×10 @ 60 kg); a heavier first set or a ramp is several groups,
// and a fully-custom ramp is a list of `count: 1` groups.
export type SetGroup = UniformLine;

const MAX_SETS = 20; // per group
const MAX_TOTAL_SETS = 50; // across all groups of one entry

export function uniformToSets(line: UniformLine): SetInput[] {
  const count = Math.min(MAX_SETS, Math.max(1, Math.floor(line.count || 1)));
  return Array.from({ length: count }, () => ({
    reps: line.reps,
    weight: line.weight,
    weightUnit: line.weightUnit,
    loadType: line.loadType,
    barWeight: line.barWeight,
  }));
}

// Flatten an ordered list of groups into the final, ordered set list. The overall
// count is capped so a workout can't balloon (setIndex is assigned by position later).
export function uniformLinesToSets(lines: SetGroup[]): SetInput[] {
  return lines.flatMap(uniformToSets).slice(0, MAX_TOTAL_SETS);
}

const DEFAULT_GROUP: SetGroup = {
  count: 1,
  reps: null,
  weight: null,
  weightUnit: "kg",
  loadType: "total",
  barWeight: null,
};

interface SetShape {
  reps: number | null;
  weight: number | null;
  weightUnit: SetInput["weightUnit"];
  loadType: SetInput["loadType"];
  barWeight: number | null;
}

function sameShape(g: SetGroup, s: SetShape): boolean {
  return (
    g.reps === s.reps &&
    g.weight === s.weight &&
    g.weightUnit === s.weightUnit &&
    g.loadType === s.loadType &&
    g.barWeight === s.barWeight
  );
}

// Inverse of `uniformLinesToSets`: run-length group consecutive equal sets back into
// editable groups. A uniform workout collapses to one group; a varied one yields
// several — so editing preserves per-set values rather than flattening to the first.
export function setsToUniformLines(sets: SetShape[]): SetGroup[] {
  if (sets.length === 0) return [{ ...DEFAULT_GROUP }];
  const groups: SetGroup[] = [];
  for (const s of sets) {
    const last = groups[groups.length - 1];
    if (last && sameShape(last, s)) {
      last.count += 1;
    } else {
      groups.push({
        count: 1,
        reps: s.reps,
        weight: s.weight,
        weightUnit: s.weightUnit,
        loadType: s.loadType,
        barWeight: s.barWeight,
      });
    }
  }
  return groups;
}
