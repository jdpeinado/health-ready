import { and, eq, inArray, asc } from "drizzle-orm";
import { computeTotalLoadKg } from "@health-ready/shared";
import type { ExerciseType, WeightUnit, LoadType } from "@health-ready/shared";
import type { Db } from "../db/client.js";
import { exercises, workouts, workoutEntries, sets } from "../db/schema.js";

export interface ProgressPoint {
  date: string;
  workoutId: string;
  bestTotalLoadKg: number | null;
  totalVolumeKg: number | null;
  topReps: number | null;
  maxDurationSeconds: number | null;
  totalDistance: number | null;
}

export interface ExerciseProgress {
  exerciseId: string;
  type: ExerciseType;
  points: ProgressPoint[];
}

// One headline value per workout for a sparkline preview.
export interface SparklinePoint {
  date: string;
  value: number;
}

export interface ProgressSummaryItem {
  exerciseId: string;
  name: string;
  type: ExerciseType;
  unit: "kg" | "reps" | "min";
  points: SparklinePoint[];
  latest: number;
  peak: number;
}

export interface ProgressSummary {
  items: ProgressSummaryItem[];
}

interface Accumulator {
  date: string;
  workoutId: string;
  bestTotalLoadKg: number | null;
  totalVolumeKg: number | null;
  topReps: number | null;
  maxDurationSeconds: number | null;
  totalDistance: number | null;
}

// Minimal shapes the aggregation needs — both the per-exercise and the summary
// queries project into these.
interface AggEntry {
  entryId: string;
  workoutId: string;
  date: string;
  durationSeconds: number | null;
  distance: number | null;
}
interface AggSet {
  reps: number | null;
  weight: number | null;
  weightUnit: WeightUnit | null;
  loadType: LoadType | null;
  barWeight: number | null;
}

// Round to one decimal — gym plates step by 0.5 kg, and lb→kg conversion otherwise
// produces float noise (e.g. 11.793401620000001). Keeps the summary payload small
// and display-ready.
function roundKg(kg: number): number {
  return Math.round(kg * 10) / 10;
}

// Collapse a set of entries (already ordered by date ascending) into one accumulator
// per workout, in encounter order. Shared by both progress endpoints so they compute
// best load / volume / top reps / duration / distance identically.
function aggregateEntries(
  entryRows: AggEntry[],
  setsByEntry: Map<string, AggSet[]>,
): Accumulator[] {
  const byWorkout = new Map<string, Accumulator>();
  const order: string[] = [];

  for (const entry of entryRows) {
    let acc = byWorkout.get(entry.workoutId);
    if (!acc) {
      acc = {
        date: entry.date,
        workoutId: entry.workoutId,
        bestTotalLoadKg: null,
        totalVolumeKg: null,
        topReps: null,
        maxDurationSeconds: null,
        totalDistance: null,
      };
      byWorkout.set(entry.workoutId, acc);
      order.push(entry.workoutId);
    }

    if (entry.durationSeconds != null) {
      acc.maxDurationSeconds = Math.max(acc.maxDurationSeconds ?? 0, entry.durationSeconds);
    }
    if (entry.distance != null) {
      acc.totalDistance = (acc.totalDistance ?? 0) + entry.distance;
    }

    for (const s of setsByEntry.get(entry.entryId) ?? []) {
      if (s.reps != null) acc.topReps = Math.max(acc.topReps ?? 0, s.reps);
      const load = computeTotalLoadKg({
        weight: s.weight,
        weightUnit: s.weightUnit,
        loadType: s.loadType,
        barWeight: s.barWeight,
      });
      if (load != null) {
        acc.bestTotalLoadKg = Math.max(acc.bestTotalLoadKg ?? 0, load);
        const volume = s.reps != null ? load * s.reps : 0;
        acc.totalVolumeKg = (acc.totalVolumeKg ?? 0) + volume;
      }
    }
  }

  return order.map((id) => byWorkout.get(id)!);
}

export async function getExerciseProgress(
  db: Db,
  userId: string,
  exerciseId: string,
): Promise<ExerciseProgress | null> {
  const exercise = await db
    .select({ id: exercises.id, type: exercises.type })
    .from(exercises)
    .where(eq(exercises.id, exerciseId))
    .get();
  if (!exercise) return null;

  // All of this user's entries for this exercise, with their workout date, oldest first.
  const entryRows = await db
    .select({
      entryId: workoutEntries.id,
      workoutId: workouts.id,
      date: workouts.date,
      durationSeconds: workoutEntries.durationSeconds,
      distance: workoutEntries.distance,
    })
    .from(workoutEntries)
    .innerJoin(workouts, eq(workouts.id, workoutEntries.workoutId))
    .where(and(eq(workouts.userId, userId), eq(workoutEntries.exerciseId, exerciseId)))
    .orderBy(asc(workouts.date));

  if (entryRows.length === 0) {
    return { exerciseId, type: exercise.type, points: [] };
  }

  const setRows = await db
    .select()
    .from(sets)
    .where(inArray(sets.entryId, entryRows.map((e) => e.entryId)));
  const setsByEntry = new Map<string, AggSet[]>();
  for (const s of setRows) {
    const list = setsByEntry.get(s.entryId) ?? [];
    list.push(s);
    setsByEntry.set(s.entryId, list);
  }

  const points = aggregateEntries(entryRows, setsByEntry);
  return { exerciseId, type: exercise.type, points };
}

// Collapse a workout accumulator series into a single headline metric per the
// exercise type (mirrors the ProgressPage chart selection):
//   cardio                     → minutes (maxDuration / 60)
//   strength with any load     → kg (best total load, rounded)
//   strength, all bodyweight   → reps (top reps)
function toSummaryItem(
  exerciseId: string,
  name: string,
  type: ExerciseType,
  accs: Accumulator[],
): ProgressSummaryItem | null {
  if (type === "mobility" || accs.length === 0) return null;

  let unit: ProgressSummaryItem["unit"];
  let value: (a: Accumulator) => number;

  if (type === "cardio") {
    unit = "min";
    value = (a) => (a.maxDurationSeconds != null ? Math.round(a.maxDurationSeconds / 60) : 0);
  } else if (accs.every((a) => a.bestTotalLoadKg == null)) {
    // bodyweight strength — progression is reps
    unit = "reps";
    value = (a) => a.topReps ?? 0;
  } else {
    unit = "kg";
    value = (a) => roundKg(a.bestTotalLoadKg ?? 0);
  }

  const points: SparklinePoint[] = accs.map((a) => ({ date: a.date, value: value(a) }));
  const last = points[points.length - 1];
  return {
    exerciseId,
    name,
    type,
    unit,
    points,
    latest: last?.value ?? 0,
    peak: points.reduce((m, p) => Math.max(m, p.value), 0),
  };
}

export async function getProgressSummary(
  db: Db,
  userId: string,
): Promise<ProgressSummary> {
  // Every entry this user has logged, with its exercise + workout date, oldest first.
  const entryRows = await db
    .select({
      entryId: workoutEntries.id,
      exerciseId: workoutEntries.exerciseId,
      workoutId: workouts.id,
      date: workouts.date,
      durationSeconds: workoutEntries.durationSeconds,
      distance: workoutEntries.distance,
      exerciseName: exercises.name,
      exerciseType: exercises.type,
    })
    .from(workoutEntries)
    .innerJoin(workouts, eq(workouts.id, workoutEntries.workoutId))
    .innerJoin(exercises, eq(exercises.id, workoutEntries.exerciseId))
    .where(eq(workouts.userId, userId))
    .orderBy(asc(workouts.date));

  if (entryRows.length === 0) return { items: [] };

  // All sets for this user's entries in one query (joined by user, so no inArray
  // variable-limit risk regardless of how much history exists).
  const setRows = await db
    .select({
      entryId: sets.entryId,
      reps: sets.reps,
      weight: sets.weight,
      weightUnit: sets.weightUnit,
      loadType: sets.loadType,
      barWeight: sets.barWeight,
    })
    .from(sets)
    .innerJoin(workoutEntries, eq(workoutEntries.id, sets.entryId))
    .innerJoin(workouts, eq(workouts.id, workoutEntries.workoutId))
    .where(eq(workouts.userId, userId));

  const setsByEntry = new Map<string, AggSet[]>();
  for (const s of setRows) {
    const list = setsByEntry.get(s.entryId) ?? [];
    list.push(s);
    setsByEntry.set(s.entryId, list);
  }

  // Group entries by exercise, preserving the date-ascending order.
  interface Bucket {
    name: string;
    type: ExerciseType;
    entries: AggEntry[];
  }
  const byExercise = new Map<string, Bucket>();
  const exerciseOrder: string[] = [];
  for (const e of entryRows) {
    let bucket = byExercise.get(e.exerciseId);
    if (!bucket) {
      bucket = { name: e.exerciseName, type: e.exerciseType, entries: [] };
      byExercise.set(e.exerciseId, bucket);
      exerciseOrder.push(e.exerciseId);
    }
    bucket.entries.push({
      entryId: e.entryId,
      workoutId: e.workoutId,
      date: e.date,
      durationSeconds: e.durationSeconds,
      distance: e.distance,
    });
  }

  const items: ProgressSummaryItem[] = [];
  for (const exerciseId of exerciseOrder) {
    const bucket = byExercise.get(exerciseId)!;
    const accs = aggregateEntries(bucket.entries, setsByEntry);
    const item = toSummaryItem(exerciseId, bucket.name, bucket.type, accs);
    if (item) items.push(item);
  }

  // Most-recently-trained first (last point's date descending).
  items.sort((a, b) => {
    const da = a.points[a.points.length - 1]?.date ?? "";
    const db_ = b.points[b.points.length - 1]?.date ?? "";
    return db_.localeCompare(da);
  });

  return { items };
}
