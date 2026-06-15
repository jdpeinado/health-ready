import { useState } from "react";
import { CalendarDays, Dumbbell, Plus, Save } from "lucide-react";
import type { EntryInput } from "@health-ready/shared";
import type { Exercise } from "../../api/types";
import { useExercises } from "../exercises/useExercises";
import { useMe } from "../../auth/useAuth";
import { CreateExerciseDialog } from "../exercises/CreateExerciseDialog";
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
    lines: [
      {
        count: 3,
        reps: 10,
        weight: null,
        weightUnit: "kg",
        loadType: "total",
        barWeight: null,
      },
    ],
    durationMinutes: null,
    distance: null,
    distanceUnit: "km",
  };
}

export interface WorkoutFormPayload {
  date: string;
  name: string | null;
  entries: EntryInput[];
}

interface WorkoutFormProps {
  initialDate: string;
  initialName: string;
  initialEntries: DraftEntry[];
  eyebrow: string;
  title: string;
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  onSubmit: (payload: WorkoutFormPayload) => void;
}

export function WorkoutForm({
  initialDate,
  initialName,
  initialEntries,
  eyebrow,
  title,
  submitLabel,
  pendingLabel,
  isPending,
  onSubmit,
}: WorkoutFormProps) {
  const exercises = useExercises();
  const me = useMe();
  const isAdmin = me.data?.role === "admin";
  const [date, setDate] = useState(initialDate);
  const [name, setName] = useState(initialName);
  const [entries, setEntries] = useState<DraftEntry[]>(initialEntries);
  const [pick, setPick] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  function addExercise(id: string) {
    const ex = exercises.data?.find((e) => e.id === id);
    if (ex) setEntries((prev) => [...prev, draftFor(ex)]);
    setPick("");
  }

  // Add a just-created exercise directly from the returned object — no need to wait
  // for the catalog query to refetch.
  function addCreatedExercise(ex: Exercise) {
    setEntries((prev) => [...prev, draftFor(ex)]);
  }

  function save() {
    onSubmit({
      date,
      name: name.trim() || null,
      entries: entries.map(toEntryInput),
    });
  }

  return (
    <div className="animate-rise space-y-6">
      {/* Hero */}
      <header className="space-y-1.5">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
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
          {isAdmin && (
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" />
              Crear ejercicio
            </Button>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <CreateExerciseDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={addCreatedExercise}
        />
      )}

      {/* Save */}
      <div className="flex sm:justify-end">
        <Button
          size="lg"
          className="w-full sm:w-auto"
          onClick={save}
          disabled={isPending || entries.length === 0}
        >
          <Save className="size-4" />
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </div>
  );
}
