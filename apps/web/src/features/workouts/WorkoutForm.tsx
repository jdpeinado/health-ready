import { useState } from "react";
import { CalendarDays, Dumbbell, Plus, Save, X } from "lucide-react";
import type { EntryInput, GroupType } from "@health-ready/shared";
import type { Exercise } from "../../api/types";
import { useExercises } from "../exercises/useExercises";
import { useMe } from "../../auth/useAuth";
import { CreateExerciseDialog } from "../exercises/CreateExerciseDialog";
import { ExercisePicker } from "../exercises/ExercisePicker";
import { EntryEditor, type DraftEntry } from "./EntryEditor";
import { blocksToEntries, type Block } from "./blocks";
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

const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  biserie: "Bi-serie",
  triserie: "Tri-serie",
  superserie: "Superserie",
  circuito: "Circuito",
};
const GROUP_TYPES: GroupType[] = ["biserie", "triserie", "superserie", "circuito"];

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
      { count: 3, reps: 10, weight: null, weightUnit: "kg", loadType: "total", barWeight: null },
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
  initialBlocks: Block[];
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
  initialBlocks,
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
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [createOpen, setCreateOpen] = useState(false);

  const exerciseCount = blocks.reduce(
    (n, b) => n + (b.kind === "single" ? 1 : b.entries.length),
    0,
  );

  // Append a standalone exercise. Used by the bottom picker and the inline create flow.
  function addExercise(ex: Exercise) {
    setBlocks((prev) => [
      ...prev,
      { kind: "single", id: crypto.randomUUID(), entry: draftFor(ex) },
    ]);
  }

  function addGroup(groupType: GroupType) {
    const groupId = crypto.randomUUID();
    setBlocks((prev) => [
      ...prev,
      { kind: "group", id: groupId, groupId, groupType, entries: [] },
    ]);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  // Update the single-entry draft of a `single` block.
  function updateSingle(id: string, entry: DraftEntry) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id && b.kind === "single" ? { ...b, entry } : b)),
    );
  }

  // Add / update / remove an exercise inside a group block.
  function addToGroup(id: string, ex: Exercise) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id && b.kind === "group"
          ? { ...b, entries: [...b.entries, draftFor(ex)] }
          : b,
      ),
    );
  }
  function updateInGroup(id: string, i: number, entry: DraftEntry) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id && b.kind === "group"
          ? { ...b, entries: b.entries.map((e, j) => (j === i ? entry : e)) }
          : b,
      ),
    );
  }
  function removeFromGroup(id: string, i: number) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id && b.kind === "group"
          ? { ...b, entries: b.entries.filter((_, j) => j !== i) }
          : b,
      ),
    );
  }

  function save() {
    onSubmit({ date, name: name.trim() || null, entries: blocksToEntries(blocks) });
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
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
          {exerciseCount > 0 && (
            <span className="font-mono text-xs text-muted-foreground">{exerciseCount}</span>
          )}
        </div>

        {blocks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/30 px-6 py-12 text-center">
            <span className="grid size-11 place-items-center rounded-full bg-secondary text-muted-foreground">
              <Dumbbell className="size-5" />
            </span>
            <p className="text-sm font-medium text-foreground">Aún no has agregado ejercicios</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Elige uno abajo o crea una serie agrupada.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {blocks.map((b) =>
              b.kind === "single" ? (
                <EntryEditor
                  key={b.id}
                  index={0}
                  entry={b.entry}
                  onChange={(e) => updateSingle(b.id, e)}
                  onRemove={() => removeBlock(b.id)}
                />
              ) : (
                <Card key={b.id} className="gap-0 border-primary/40 py-0">
                  <div className="flex items-center gap-3 border-b border-border bg-primary/10 px-4 py-3">
                    <span className="font-display text-xs font-bold uppercase tracking-wide text-primary">
                      {GROUP_TYPE_LABELS[b.groupType]}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {b.entries.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeBlock(b.id)}
                      aria-label="Quitar serie agrupada"
                      className="ml-auto grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <CardContent className="space-y-3 py-4">
                    {b.entries.map((entry, i) => (
                      <EntryEditor
                        key={i}
                        index={i + 1}
                        entry={entry}
                        onChange={(e) => updateInGroup(b.id, i, e)}
                        onRemove={() => removeFromGroup(b.id, i)}
                      />
                    ))}
                    <ExercisePicker
                      exercises={exercises.data ?? []}
                      onSelect={(ex) => addToGroup(b.id, ex)}
                      placeholder="Añadir a la serie…"
                    />
                  </CardContent>
                </Card>
              ),
            )}
          </div>
        )}
      </section>

      {/* Add exercise / group */}
      <Card>
        <CardContent className="space-y-2">
          <ExercisePicker exercises={exercises.data ?? []} onSelect={addExercise} />
          <Select onValueChange={(v) => addGroup(v as GroupType)} value="">
            <SelectTrigger className="w-full text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Plus className="size-3.5" />
                Añadir serie agrupada
              </span>
            </SelectTrigger>
            <SelectContent>
              {GROUP_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {GROUP_TYPE_LABELS[t]}
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
        <CreateExerciseDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={addExercise} />
      )}

      {/* Save */}
      <div className="flex sm:justify-end">
        <Button
          size="lg"
          className="w-full sm:w-auto"
          onClick={save}
          disabled={isPending || exerciseCount === 0}
        >
          <Save className="size-4" />
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </div>
  );
}
