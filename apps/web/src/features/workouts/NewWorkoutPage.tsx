import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, Dumbbell, Plus, Save } from "lucide-react";
import type { Exercise } from "../../api/types";
import { useExercises } from "../exercises/useExercises";
import { useCreateWorkout } from "./useWorkoutMutations";
import { EntryEditor, toEntryInput, type DraftEntry } from "./EntryEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function draftFor(ex: Exercise): DraftEntry {
  return {
    exerciseId: ex.id,
    exerciseName: ex.name,
    exerciseType: ex.type,
    comment: "",
    line: {
      count: 3,
      reps: 10,
      weight: null,
      weightUnit: "kg",
      loadType: "total",
      barWeight: null,
    },
    durationMinutes: null,
    distance: null,
    distanceUnit: "km",
  };
}

export function NewWorkoutPage() {
  const exercises = useExercises();
  const create = useCreateWorkout();
  const navigate = useNavigate();
  const [date, setDate] = useState(todayIso());
  const [name, setName] = useState("");
  const [entries, setEntries] = useState<DraftEntry[]>([]);
  const [pick, setPick] = useState("");

  function addExercise(id: string) {
    const ex = exercises.data?.find((e) => e.id === id);
    if (ex) setEntries((prev) => [...prev, draftFor(ex)]);
    setPick("");
  }

  async function save() {
    const workout = await create.mutateAsync({
      date,
      name: name.trim() || null,
      notes: null,
      entries: entries.map(toEntryInput),
    });
    navigate(`/workouts/${workout.id}`);
  }

  return (
    <div className="animate-rise space-y-6">
      {/* Hero */}
      <header className="space-y-1.5">
        <p className="eyebrow">Sesión de hoy</p>
        <h1 className="page-title">Nuevo entrenamiento</h1>
        <p className="flex items-center gap-1.5 text-sm capitalize text-muted-foreground">
          <CalendarDays className="size-4" />
          {prettyDate(date)}
        </p>
      </header>

      {/* Meta */}
      <Card>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Nombre (opcional)</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rutina 3 / Pull day"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exercises */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Ejercicios
          </h2>
          {entries.length > 0 && (
            <span className="font-mono text-xs text-muted-foreground">
              {entries.length}
            </span>
          )}
        </div>

        {entries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/30 px-6 py-12 text-center">
            <span className="grid size-11 place-items-center rounded-full bg-secondary text-muted-foreground">
              <Dumbbell className="size-5" />
            </span>
            <p className="text-sm font-medium text-foreground">
              Aún no has agregado ejercicios
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Elige uno abajo para empezar a registrar tus series.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {entries.map((entry, i) => (
              <EntryEditor
                key={i}
                index={i + 1}
                entry={entry}
                onChange={(e) =>
                  setEntries((prev) => prev.map((x, j) => (j === i ? e : x)))
                }
                onRemove={() =>
                  setEntries((prev) => prev.filter((_, j) => j !== i))
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* Add exercise */}
      <Card>
        <CardContent className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Plus className="size-3.5" />
            Agregar ejercicio
          </Label>
          <Select value={pick} onValueChange={(id) => addExercise(id)}>
            <SelectTrigger>
              <SelectValue placeholder="— elegir —" />
            </SelectTrigger>
            <SelectContent>
              {exercises.data?.map((ex) => (
                <SelectItem key={ex.id} value={ex.id}>
                  {ex.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex sm:justify-end">
        <Button
          size="lg"
          className="w-full sm:w-auto"
          onClick={save}
          disabled={create.isPending || entries.length === 0}
        >
          <Save className="size-4" />
          {create.isPending ? "Guardando…" : "Guardar entrenamiento"}
        </Button>
      </div>
    </div>
  );
}
