import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { WorkoutSummary, WorkoutDetail } from "../../api/types";

export function useWorkouts() {
  return useQuery<WorkoutSummary[]>({
    queryKey: ["workouts"],
    queryFn: () => api("/workouts"),
  });
}

export function useWorkout(id: string) {
  return useQuery<WorkoutDetail>({
    queryKey: ["workout", id],
    queryFn: () => api(`/workouts/${id}`),
  });
}
