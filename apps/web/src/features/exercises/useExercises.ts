import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiJson } from "../../api/client";
import type { Exercise } from "../../api/types";
import type {
  CreateExerciseInput,
  UpdateExerciseInput,
} from "@health-ready/shared";

export function useExercises(includeInactive = false) {
  return useQuery<Exercise[]>({
    queryKey: ["exercises", includeInactive],
    queryFn: () =>
      api(`/exercises${includeInactive ? "?includeInactive=true" : ""}`),
  });
}

export function useCreateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateExerciseInput) =>
      apiJson<Exercise>("/exercises", "POST", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exercises"] }),
  });
}

export function useUpdateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateExerciseInput }) =>
      apiJson<Exercise>(`/exercises/${id}`, "PATCH", patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exercises"] }),
  });
}

export function useDeleteExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/exercises/${id}`, "DELETE", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exercises"] }),
  });
}
