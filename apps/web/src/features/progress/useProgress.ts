import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { ExerciseProgress, ProgressSummary } from "../../api/types";

export function useProgress(exerciseId: string | null) {
  return useQuery<ExerciseProgress>({
    queryKey: ["progress", exerciseId],
    queryFn: () => api(`/progress/exercises/${exerciseId}`),
    enabled: !!exerciseId,
  });
}

export function useProgressSummary() {
  return useQuery<ProgressSummary>({
    queryKey: ["progress-summary"],
    queryFn: () => api("/progress/summary"),
  });
}
