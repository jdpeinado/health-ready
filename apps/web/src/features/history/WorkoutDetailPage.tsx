import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWorkout } from "./useWorkouts";
import { useExercises } from "../exercises/useExercises";
import {
  useCopyWorkout,
  useDeleteWorkout,
} from "../workouts/useWorkoutMutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

function setLabel(s: {
  reps: number | null;
  weight: number | null;
  weightUnit: string | null;
  loadType: string | null;
  barWeight: number | null;
}): string {
  const reps = s.reps != null ? `${s.reps} reps` : "";
  if (s.loadType === "bodyweight") return `${reps} (peso corporal)`.trim();
  if (s.weight == null) return reps;
  const bar = s.barWeight != null ? ` + barra ${s.barWeight}` : "";
  const suffix = s.loadType && s.loadType !== "total" ? ` (${s.loadType})` : "";
  return `${reps} · ${s.weight}${s.weightUnit ?? ""}${bar}${suffix}`.trim();
}

export function WorkoutDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const workout = useWorkout(id);
  const exercises = useExercises();
  const copy = useCopyWorkout();
  const del = useDeleteWorkout();
  const [copyDate, setCopyDate] = useState("");

  if (workout.isLoading)
    return <p className="text-muted-foreground">Cargando…</p>;
  if (!workout.data) return <p className="text-destructive">No encontrado.</p>;
  const w = workout.data;

  const nameById = new Map(exercises.data?.map((ex) => [ex.id, ex.name]) ?? []);

  async function doCopy() {
    if (!copyDate) return;
    const created = await copy.mutateAsync({ id, input: { date: copyDate } });
    navigate(`/workouts/${created.id}`);
  }

  async function doDelete() {
    await del.mutateAsync(id);
    navigate("/history");
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">
        {w.name ?? "Entrenamiento"}{" "}
        <span className="text-muted-foreground">· {w.date}</span>
      </h3>

      <div className="space-y-2">
        {w.entries.map((e) => (
          <Card key={e.id}>
            <CardContent className="space-y-1 py-3">
              <strong className="font-medium">
                {nameById.get(e.exerciseId) ?? "Ejercicio"}
              </strong>
              {e.comment && (
                <div className="text-sm text-muted-foreground">{e.comment}</div>
              )}
              {e.sets.map((s) => (
                <div key={s.id} className="text-sm">
                  {setLabel(s)}
                </div>
              ))}
              {e.durationSeconds != null && (
                <div className="text-sm">
                  {Math.round(e.durationSeconds / 60)} min
                </div>
              )}
              {e.distance != null && (
                <div className="text-sm">
                  {e.distance} {e.distanceUnit}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-1.5 pt-6">
          <Label>Copiar a la fecha</Label>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={copyDate}
              onChange={(e) => setCopyDate(e.target.value)}
            />
            <Button disabled={!copyDate || copy.isPending} onClick={doCopy}>
              Copiar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button
        variant="destructive"
        className="w-full"
        onClick={doDelete}
        disabled={del.isPending}
      >
        Eliminar entrenamiento
      </Button>
    </div>
  );
}
