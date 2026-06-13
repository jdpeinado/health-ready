import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { ExerciseProgress } from "../../api/types";

export function useProgress(exerciseId: string | null) {
  return useQuery<ExerciseProgress>({
    queryKey: ["progress", exerciseId],
    queryFn: () => api(`/progress/exercises/${exerciseId}`),
    enabled: !!exerciseId,
  });
}
