import { z } from "zod";

export const roleSchema = z.enum(["admin", "user"]);
export type Role = z.infer<typeof roleSchema>;

export const exerciseTypeSchema = z.enum(["strength", "cardio", "mobility"]);
export type ExerciseType = z.infer<typeof exerciseTypeSchema>;

export const weightUnitSchema = z.enum(["kg", "lb"]);
export type WeightUnit = z.infer<typeof weightUnitSchema>;

export const loadTypeSchema = z.enum([
  "total",
  "per_side",
  "per_dumbbell",
  "bodyweight",
  "bodyweight_added",
]);
export type LoadType = z.infer<typeof loadTypeSchema>;
