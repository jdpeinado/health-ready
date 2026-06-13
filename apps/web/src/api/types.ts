import type {
  ExerciseType,
  WeightUnit,
  LoadType,
  Role,
} from "@health-ready/shared";

export interface Exercise {
  id: string;
  name: string;
  type: ExerciseType;
  muscleGroup: string | null;
  isActive: boolean;
  createdAt: number;
}

export interface SetDetail {
  id: string;
  setIndex: number;
  reps: number | null;
  weight: number | null;
  weightUnit: WeightUnit | null;
  loadType: LoadType | null;
  barWeight: number | null;
}

export interface EntryDetail {
  id: string;
  exerciseId: string;
  orderIndex: number;
  comment: string | null;
  durationSeconds: number | null;
  distance: number | null;
  distanceUnit: string | null;
  sets: SetDetail[];
}

export interface WorkoutSummary {
  id: string;
  date: string;
  name: string | null;
  notes: string | null;
  createdAt: number;
  entryCount: number;
}

export type WorkoutDetail = WorkoutSummary & { entries: EntryDetail[] };

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

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}
