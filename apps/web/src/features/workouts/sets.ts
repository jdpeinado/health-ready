import type { SetInput } from "@health-ready/shared";

export interface UniformLine {
  count: number;
  reps: number | null;
  weight: number | null;
  weightUnit: SetInput["weightUnit"];
  loadType: SetInput["loadType"];
  barWeight: number | null;
}

const MAX_SETS = 20;

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
