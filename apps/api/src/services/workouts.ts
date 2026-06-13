import { and, desc, eq, gte, inArray, lte, like } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { workouts, workoutEntries, sets, exercises } from "../db/schema.js";
import type {
  CreateWorkoutInput,
  UpdateWorkoutInput,
} from "@health-ready/shared";

export async function validateExerciseIds(db: Db, ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const found = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(inArray(exercises.id, unique));
  const foundSet = new Set(found.map((r) => r.id));
  return unique.filter((id) => !foundSet.has(id));
}

function buildInserts(workoutId: string, userId: string, input: CreateWorkoutInput) {
  const workoutRow = {
    id: workoutId,
    userId,
    date: input.date,
    name: input.name ?? null,
    notes: input.notes ?? null,
    createdAt: new Date(),
  };
  const entryRows: (typeof workoutEntries.$inferInsert)[] = [];
  const setRows: (typeof sets.$inferInsert)[] = [];
  (input.entries ?? []).forEach((entry, i) => {
    const entryId = crypto.randomUUID();
    entryRows.push({
      id: entryId,
      workoutId,
      exerciseId: entry.exerciseId,
      orderIndex: i,
      comment: entry.comment ?? null,
      durationSeconds: entry.durationSeconds ?? null,
      distance: entry.distance ?? null,
      distanceUnit: entry.distanceUnit ?? null,
    });
    (entry.sets ?? []).forEach((s, j) => {
      setRows.push({
        id: crypto.randomUUID(),
        entryId,
        setIndex: j,
        reps: s.reps ?? null,
        weight: s.weight ?? null,
        weightUnit: s.weightUnit ?? null,
        loadType: s.loadType ?? null,
        barWeight: s.barWeight ?? null,
      });
    });
  });
  return { workoutRow, entryRows, setRows };
}

export async function createWorkout(
  db: Db,
  userId: string,
  input: CreateWorkoutInput,
): Promise<string> {
  const workoutId = crypto.randomUUID();
  const { workoutRow, entryRows, setRows } = buildInserts(workoutId, userId, input);
  const stmts: any[] = [db.insert(workouts).values(workoutRow)];
  if (entryRows.length) stmts.push(db.insert(workoutEntries).values(entryRows));
  if (setRows.length) stmts.push(db.insert(sets).values(setRows));
  await db.batch(stmts as [any, ...any[]]);
  return workoutId;
}

export interface SetDetail {
  id: string; setIndex: number; reps: number | null; weight: number | null;
  weightUnit: "kg" | "lb" | null;
  loadType: "total" | "per_side" | "per_dumbbell" | "bodyweight" | "bodyweight_added" | null;
  barWeight: number | null;
}
export interface EntryDetail {
  id: string; exerciseId: string; orderIndex: number; comment: string | null;
  durationSeconds: number | null; distance: number | null; distanceUnit: string | null;
  sets: SetDetail[];
}
export interface WorkoutSummary {
  id: string; date: string; name: string | null; notes: string | null;
  createdAt: number; entryCount: number;
}
export type WorkoutDetail = WorkoutSummary & { entries: EntryDetail[] };

export async function getWorkout(
  db: Db,
  userId: string,
  workoutId: string,
): Promise<WorkoutDetail | null> {
  const w = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .get();
  if (!w) return null;

  const entryRows = await db
    .select()
    .from(workoutEntries)
    .where(eq(workoutEntries.workoutId, workoutId))
    .orderBy(workoutEntries.orderIndex);

  const entryIds = entryRows.map((e) => e.id);
  const setRows = entryIds.length
    ? await db.select().from(sets).where(inArray(sets.entryId, entryIds)).orderBy(sets.setIndex)
    : [];

  const setsByEntry = new Map<string, SetDetail[]>();
  for (const s of setRows) {
    const list = setsByEntry.get(s.entryId) ?? [];
    list.push({
      id: s.id, setIndex: s.setIndex, reps: s.reps, weight: s.weight,
      weightUnit: s.weightUnit, loadType: s.loadType, barWeight: s.barWeight,
    });
    setsByEntry.set(s.entryId, list);
  }

  const entries: EntryDetail[] = entryRows.map((e) => ({
    id: e.id, exerciseId: e.exerciseId, orderIndex: e.orderIndex, comment: e.comment,
    durationSeconds: e.durationSeconds, distance: e.distance, distanceUnit: e.distanceUnit,
    sets: setsByEntry.get(e.id) ?? [],
  }));

  return {
    id: w.id, date: w.date, name: w.name, notes: w.notes,
    createdAt: w.createdAt.getTime(), entryCount: entries.length, entries,
  };
}

export interface ListFilters { from?: string; to?: string; q?: string }

export async function listWorkouts(
  db: Db,
  userId: string,
  filters: ListFilters,
): Promise<WorkoutSummary[]> {
  const conds = [eq(workouts.userId, userId)];
  if (filters.from) conds.push(gte(workouts.date, filters.from));
  if (filters.to) conds.push(lte(workouts.date, filters.to));
  if (filters.q) conds.push(like(workouts.name, `%${filters.q}%`));

  const rows = await db
    .select()
    .from(workouts)
    .where(and(...conds))
    .orderBy(desc(workouts.date), desc(workouts.createdAt));

  if (rows.length === 0) return [];

  const counts = await db
    .select({ workoutId: workoutEntries.workoutId })
    .from(workoutEntries)
    .where(inArray(workoutEntries.workoutId, rows.map((r) => r.id)));
  const countByWorkout = new Map<string, number>();
  for (const r of counts) {
    countByWorkout.set(r.workoutId, (countByWorkout.get(r.workoutId) ?? 0) + 1);
  }

  return rows.map((w) => ({
    id: w.id, date: w.date, name: w.name, notes: w.notes,
    createdAt: w.createdAt.getTime(), entryCount: countByWorkout.get(w.id) ?? 0,
  }));
}

export async function replaceWorkout(
  db: Db,
  userId: string,
  workoutId: string,
  input: UpdateWorkoutInput,
): Promise<boolean> {
  const existing = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .get();
  if (!existing) return false;

  const patch: Partial<typeof workouts.$inferInsert> = {};
  if (input.date !== undefined) patch.date = input.date;
  if (input.name !== undefined) patch.name = input.name ?? null;
  if (input.notes !== undefined) patch.notes = input.notes ?? null;

  const stmts: any[] = [];
  if (Object.keys(patch).length > 0) {
    stmts.push(db.update(workouts).set(patch).where(eq(workouts.id, workoutId)));
  }
  if (input.entries !== undefined) {
    // Deleting entries cascades to their sets.
    stmts.push(db.delete(workoutEntries).where(eq(workoutEntries.workoutId, workoutId)));
    const { entryRows, setRows } = buildInserts(workoutId, userId, {
      date: input.date ?? "2000-01-01", entries: input.entries,
    } as CreateWorkoutInput);
    if (entryRows.length) stmts.push(db.insert(workoutEntries).values(entryRows));
    if (setRows.length) stmts.push(db.insert(sets).values(setRows));
  }
  if (stmts.length > 0) {
    await db.batch(stmts as [any, ...any[]]);
  }
  return true;
}

export async function deleteWorkout(
  db: Db,
  userId: string,
  workoutId: string,
): Promise<boolean> {
  const existing = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .get();
  if (!existing) return false;
  await db.delete(workouts).where(eq(workouts.id, workoutId)); // cascades
  return true;
}

export async function copyWorkout(
  db: Db,
  userId: string,
  sourceId: string,
  newDate: string,
): Promise<string | null> {
  const source = await getWorkout(db, userId, sourceId);
  if (!source) return null;
  return createWorkout(db, userId, {
    date: newDate,
    name: source.name,
    notes: source.notes,
    entries: source.entries.map((e) => ({
      exerciseId: e.exerciseId,
      comment: e.comment,
      durationSeconds: e.durationSeconds,
      distance: e.distance,
      distanceUnit: e.distanceUnit,
      sets: e.sets.map((s) => ({
        reps: s.reps, weight: s.weight, weightUnit: s.weightUnit,
        loadType: s.loadType, barWeight: s.barWeight,
      })),
    })),
  });
}
