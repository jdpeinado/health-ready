import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Nuevo entrenamiento</h3>
      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="space-y-1.5">
            <Label>Fecha</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Nombre (opcional)</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Rutina 3 / Pull day"
            />
          </div>
        </CardContent>
      </Card>

      {entries.map((entry, i) => (
        <EntryEditor
          key={i}
          entry={entry}
          onChange={(e) =>
            setEntries((prev) => prev.map((x, j) => (j === i ? e : x)))
          }
          onRemove={() => setEntries((prev) => prev.filter((_, j) => j !== i))}
        />
      ))}

      <Card>
        <CardContent className="space-y-1.5 pt-6">
          <Label>Agregar ejercicio</Label>
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

      <Button
        className="w-full"
        onClick={save}
        disabled={create.isPending || entries.length === 0}
      >
        {create.isPending ? "Guardando…" : "Guardar entrenamiento"}
      </Button>
    </div>
  );
}
