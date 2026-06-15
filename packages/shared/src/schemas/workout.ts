import { z } from "zod";
import { weightUnitSchema, loadTypeSchema } from "./common.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const setInputSchema = z.object({
  reps: z.number().int().nonnegative().nullish(),
  weight: z.number().nonnegative().nullish(),
  weightUnit: weightUnitSchema.nullish(),
  loadType: loadTypeSchema.nullish(),
  barWeight: z.number().nonnegative().nullish(),
});
export type SetInput = z.infer<typeof setInputSchema>;

export const entryInputSchema = z.object({
  exerciseId: z.string().min(1),
  comment: z.string().nullish(),
  durationSeconds: z.number().int().nonnegative().nullish(),
  distance: z.number().nonnegative().nullish(),
  distanceUnit: z.string().min(1).nullish(),
  sets: z.array(setInputSchema).default([]),
});
export type EntryInput = z.infer<typeof entryInputSchema>;

export const createWorkoutSchema = z.object({
  date: isoDate,
  name: z.string().min(1).nullish(),
  notes: z.string().nullish(),
  entries: z.array(entryInputSchema).default([]),
});
export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;

export const updateWorkoutSchema = z.object({
  date: isoDate.optional(),
  name: z.string().min(1).nullish(),
  notes: z.string().nullish(),
  entries: z.array(entryInputSchema).optional(), // when present, replaces all entries
});
export type UpdateWorkoutInput = z.infer<typeof updateWorkoutSchema>;

export const copyWorkoutSchema = z.object({ date: isoDate });
export type CopyWorkoutInput = z.infer<typeof copyWorkoutSchema>;

// Query params for GET /workouts. `q` is a name substring; `from`/`to` bound the
// date range inclusively. A blank/whitespace `q` is treated as "no filter".
export const listWorkoutsQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => (v ? v : undefined)),
  from: isoDate.optional(),
  to: isoDate.optional(),
});
export type ListWorkoutsQuery = z.infer<typeof listWorkoutsQuerySchema>;
