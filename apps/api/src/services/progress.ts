import { and, eq, inArray, asc } from "drizzle-orm";
import { computeTotalLoadKg } from "@health-ready/shared";
import type { ExerciseType } from "@health-ready/shared";
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

interface Accumulator {
  date: string;
  workoutId: string;
  bestTotalLoadKg: number | null;
  totalVolumeKg: number | null;
  topReps: number | null;
  maxDurationSeconds: number | null;
  totalDistance: number | null;
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
  const setsByEntry = new Map<string, typeof setRows>();
  for (const s of setRows) {
    const list = setsByEntry.get(s.entryId) ?? [];
    list.push(s);
    setsByEntry.set(s.entryId, list);
  }

  // One point per workout (a workout could contain the exercise more than once).
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

  const points = order.map((id) => byWorkout.get(id)!);
  return { exerciseId, type: exercise.type, points };
}
