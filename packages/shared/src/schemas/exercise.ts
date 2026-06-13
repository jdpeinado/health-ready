import { z } from "zod";
import { exerciseTypeSchema } from "./common.js";

export const createExerciseSchema = z.object({
  name: z.string().min(1),
  type: exerciseTypeSchema,
  muscleGroup: z.string().min(1).nullish(),
});
export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;

export const updateExerciseSchema = z.object({
  name: z.string().min(1).optional(),
  type: exerciseTypeSchema.optional(),
  muscleGroup: z.string().min(1).nullish(),
  isActive: z.boolean().optional(),
});
export type UpdateExerciseInput = z.infer<typeof updateExerciseSchema>;
