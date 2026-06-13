import type { LoadType, WeightUnit } from "./schemas/common.js";

const LB_TO_KG = 0.45359237;

export function toKg(weight: number, unit: WeightUnit | null): number {
  return unit === "lb" ? weight * LB_TO_KG : weight;
}

export interface LoadInput {
  weight: number | null;
  weightUnit: WeightUnit | null;
  loadType: LoadType | null;
  barWeight: number | null;
}

// Canonical total external load in kg. Returns null for bodyweight-only work
// (whose progression is reps, not load) or when load is unspecified.
export function computeTotalLoadKg(set: LoadInput): number | null {
  if (set.loadType === "bodyweight") return null;
  if (set.weight == null || set.loadType == null) return null;
  const w = toKg(set.weight, set.weightUnit);
  const bar = set.barWeight != null ? toKg(set.barWeight, set.weightUnit) : 0;
  switch (set.loadType) {
    case "total":
      return w;
    case "per_side":
      return w * 2 + bar;
    case "per_dumbbell":
      return w * 2;
    case "bodyweight_added":
      return w;
    default:
      return null;
  }
}
