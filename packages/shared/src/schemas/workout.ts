import { z } from "zod";
import { weightUnitSchema, loadTypeSchema, groupTypeSchema } from "./common.js";

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
  groupId: z.string().min(1).nullish(),
  groupType: groupTypeSchema.nullish(),
});
export type EntryInput = z.infer<typeof entryInputSchema>;

// Entries sharing a groupId must be contiguous, share one groupType, and number >= 2.
// A standalone entry (groupId null) must not carry a groupType.
function refineGroups(
  entries: EntryInput[] | undefined,
  ctx: z.RefinementCtx,
): void {
  if (!entries) return;
  const positionsByGroup = new Map<string, number[]>();
  entries.forEach((e, i) => {
    if (e.groupId == null) {
      if (e.groupType != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["entries", i, "groupType"],
          message: "groupType requires a groupId",
        });
      }
      return;
    }
    if (e.groupType == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entries", i, "groupType"],
        message: "a grouped entry requires a groupType",
      });
    }
    const arr = positionsByGroup.get(e.groupId) ?? [];
    arr.push(i);
    positionsByGroup.set(e.groupId, arr);
  });
  for (const [groupId, positions] of positionsByGroup) {
    const first = positions[0]!;
    if (positions.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entries", first],
        message: `group ${groupId} must contain at least 2 entries`,
      });
    }
    const contiguous = positions.every(
      (p, k) => k === 0 || p === positions[k - 1]! + 1,
    );
    if (!contiguous) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entries", first],
        message: `group ${groupId} entries must be contiguous`,
      });
    }
    const types = new Set(positions.map((p) => entries[p]!.groupType));
    if (types.size > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entries", first],
        message: `group ${groupId} has mixed groupType values`,
      });
    }
  }
}

export const createWorkoutSchema = z
  .object({
    date: isoDate,
    name: z.string().min(1).nullish(),
    notes: z.string().nullish(),
    entries: z.array(entryInputSchema).default([]),
  })
  .superRefine((val, ctx) => refineGroups(val.entries, ctx));
export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;

export const updateWorkoutSchema = z
  .object({
    date: isoDate.optional(),
    name: z.string().min(1).nullish(),
    notes: z.string().nullish(),
    entries: z.array(entryInputSchema).optional(), // when present, replaces all entries
  })
  .superRefine((val, ctx) => refineGroups(val.entries, ctx));
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
