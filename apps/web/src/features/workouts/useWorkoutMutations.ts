import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "../../api/client";
import type { WorkoutDetail } from "../../api/types";
import type {
  CreateWorkoutInput,
  UpdateWorkoutInput,
  CopyWorkoutInput,
} from "@health-ready/shared";

export function useCreateWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkoutInput) =>
      apiJson<WorkoutDetail>("/workouts", "POST", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workouts"] }),
  });
}

export function useUpdateWorkout(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateWorkoutInput) =>
      apiJson<WorkoutDetail>(`/workouts/${id}`, "PATCH", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workouts"] });
      qc.invalidateQueries({ queryKey: ["workout", id] });
    },
  });
}

export function useCopyWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CopyWorkoutInput }) =>
      apiJson<WorkoutDetail>(`/workouts/${id}/copy`, "POST", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workouts"] }),
  });
}

export function useDeleteWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/workouts/${id}`, "DELETE", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workouts"] }),
  });
}
