import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, CalendarDays, Copy, Trash2 } from "lucide-react";
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

const LOAD_SUFFIX: Record<string, string> = {
  per_side: "por lado",
  per_dumbbell: "por mancuerna",
  bodyweight_added: "corporal + lastre",
};

function setLabel(s: {
  reps: number | null;
  weight: number | null;
  weightUnit: string | null;
  loadType: string | null;
  barWeight: number | null;
}): string {
  const reps = s.reps != null ? `${s.reps} reps` : "";
  if (s.loadType === "bodyweight") return `${reps} · peso corporal`.trim();
  if (s.weight == null) return reps;
  const bar = s.barWeight != null ? ` + barra ${s.barWeight}` : "";
  const suffix =
    s.loadType && LOAD_SUFFIX[s.loadType] ? ` (${LOAD_SUFFIX[s.loadType]})` : "";
  return `${reps} · ${s.weight}${s.weightUnit ?? ""}${bar}${suffix}`.trim();
}

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
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
    return <p className="animate-rise text-muted-foreground">Cargando…</p>;
  if (!workout.data)
    return <p className="animate-rise text-destructive">No encontrado.</p>;
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
    <div className="animate-rise space-y-6">
      <header className="space-y-3">
        <Link
          to="/history"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Historial
        </Link>
        <div className="space-y-1.5">
          <h1 className="page-title">{w.name ?? "Entrenamiento"}</h1>
          <p className="flex items-center gap-1.5 text-sm capitalize text-muted-foreground">
            <CalendarDays className="size-4" />
            {prettyDate(w.date)}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        {/* Entries */}
        <div className="space-y-3">
          {w.entries.map((e, i) => (
            <Card key={e.id} className="gap-0 py-0">
              <div className="flex items-center gap-3 border-b border-border bg-secondary/40 px-4 py-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 font-mono text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <strong className="truncate font-display font-bold">
                  {nameById.get(e.exerciseId) ?? "Ejercicio"}
                </strong>
              </div>
              <CardContent className="space-y-2 py-4">
                {e.comment && (
                  <p className="text-sm italic text-muted-foreground">
                    “{e.comment}”
                  </p>
                )}
                {e.sets.map((s, si) => (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {String(si + 1).padStart(2, "0")}
                    </span>
                    <span className="h-px flex-1 bg-border" />
                    <span className="font-mono font-medium tabular-nums">
                      {setLabel(s)}
                    </span>
                  </div>
                ))}
                {e.durationSeconds != null && (
                  <div className="font-mono text-sm font-medium">
                    {Math.round(e.durationSeconds / 60)} min
                  </div>
                )}
                {e.distance != null && (
                  <div className="font-mono text-sm font-medium">
                    {e.distance} {e.distanceUnit}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Actions sidebar */}
        <aside className="space-y-4 lg:sticky lg:top-8 lg:self-start">
          <Card>
            <CardContent className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Copy className="size-3.5" />
                Copiar a otra fecha
              </Label>
              <div className="flex gap-2">
                <Input
                  type="date"
                  value={copyDate}
                  onChange={(e) => setCopyDate(e.target.value)}
                />
                <Button
                  disabled={!copyDate || copy.isPending}
                  onClick={doCopy}
                >
                  Copiar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Duplica esta sesión completa en la fecha elegida.
              </p>
            </CardContent>
          </Card>

          <Button
            variant="destructive"
            className="w-full"
            onClick={doDelete}
            disabled={del.isPending}
          >
            <Trash2 className="size-4" />
            Eliminar entrenamiento
          </Button>
        </aside>
      </div>
    </div>
  );
}
