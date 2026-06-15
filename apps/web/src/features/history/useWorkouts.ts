import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { WorkoutSummary, WorkoutDetail } from "../../api/types";

export interface WorkoutFilters {
  q?: string;
  from?: string;
  to?: string;
}

export function useWorkouts(filters: WorkoutFilters = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const qs = params.toString();
  return useQuery<WorkoutSummary[]>({
    queryKey: ["workouts", filters],
    queryFn: () => api(`/workouts${qs ? `?${qs}` : ""}`),
  });
}

export function useWorkout(id: string) {
  return useQuery<WorkoutDetail>({
    queryKey: ["workout", id],
    queryFn: () => api(`/workouts/${id}`),
  });
}
