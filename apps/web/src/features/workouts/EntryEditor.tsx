import { Plus, X } from "lucide-react";
import type {
  ExerciseType,
  WeightUnit,
  LoadType,
  EntryInput,
} from "@health-ready/shared";
import type { EntryDetail } from "../../api/types";
import {
  uniformLinesToSets,
  setsToUniformLines,
  type SetGroup,
} from "./sets";
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

const LOAD_TYPES: LoadType[] = [
  "total",
  "per_side",
  "per_dumbbell",
  "bodyweight",
  "bodyweight_added",
];

const LOAD_TYPE_LABELS: Record<LoadType, string> = {
  total: "Total",
  per_side: "Por lado",
  per_dumbbell: "Por mancuerna",
  bodyweight: "Peso corporal",
  bodyweight_added: "Corporal + lastre",
};

const TYPE_LABELS: Record<ExerciseType, string> = {
  strength: "Fuerza",
  cardio: "Cardio",
  mobility: "Movilidad",
};

export interface DraftEntry {
  exerciseId: string;
  exerciseName: string;
  exerciseType: ExerciseType;
  comment: string;
  // strength — one or more uniform set groups (varying weights = multiple groups)
  lines: SetGroup[];
  // cardio
  durationMinutes: number | null;
  distance: number | null;
  distanceUnit: string;
}

export function toEntryInput(d: DraftEntry): EntryInput {
  if (d.exerciseType === "strength") {
    return {
      exerciseId: d.exerciseId,
      comment: d.comment || null,
      durationSeconds: null,
      distance: null,
      distanceUnit: null,
      sets: uniformLinesToSets(d.lines),
    };
  }
  if (d.exerciseType === "cardio") {
    return {
      exerciseId: d.exerciseId,
      comment: d.comment || null,
      durationSeconds:
        d.durationMinutes != null ? d.durationMinutes * 60 : null,
      distance: d.distance,
      distanceUnit: d.distance != null ? d.distanceUnit : null,
      sets: [],
    };
  }
  // mobility
  return {
    exerciseId: d.exerciseId,
    comment: d.comment || null,
    durationSeconds: null,
    distance: null,
    distanceUnit: null,
    sets: [],
  };
}

// Inverse of `toEntryInput`: turn a saved entry back into an editable draft.
// Strength sets are run-length grouped (see `setsToUniformLines`), so both uniform
// and varying-weight workouts round-trip losslessly.
export function fromEntryDetail(
  entry: EntryDetail,
  exercise: { name: string; type: ExerciseType },
): DraftEntry {
  return {
    exerciseId: entry.exerciseId,
    exerciseName: exercise.name,
    exerciseType: exercise.type,
    comment: entry.comment ?? "",
    lines: setsToUniformLines(entry.sets),
    durationMinutes:
      entry.durationSeconds != null
        ? Math.round(entry.durationSeconds / 60)
        : null,
    distance: entry.distance,
    distanceUnit: entry.distanceUnit ?? "km",
  };
}

const numOrNull = (v: string) => (v === "" ? null : Number(v));

const EMPTY_GROUP: SetGroup = {
  count: 1,
  reps: null,
  weight: null,
  weightUnit: "kg",
  loadType: "total",
  barWeight: null,
};

// The editable fields for one uniform set group (series count, reps, weight, unit,
// load type, optional bar weight). Reused for every group within a strength entry.
function GroupFields({
  group,
  onChange,
}: {
  group: SetGroup;
  onChange: (patch: Partial<SetGroup>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Series</Label>
          <Input
            type="number"
            min={1}
            value={group.count}
            onChange={(e) => onChange({ count: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Reps</Label>
          <Input
            type="number"
            min={0}
            value={group.reps ?? ""}
            onChange={(e) => onChange({ reps: numOrNull(e.target.value) })}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Peso</Label>
          <Input
            type="number"
            step="0.5"
            value={group.weight ?? ""}
            disabled={group.loadType === "bodyweight"}
            onChange={(e) => onChange({ weight: numOrNull(e.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Unidad</Label>
          <Select
            value={group.weightUnit ?? "kg"}
            onValueChange={(v) => onChange({ weightUnit: v as WeightUnit })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="kg">kg</SelectItem>
              <SelectItem value="lb">lb</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Tipo de carga</Label>
        <Select
          value={group.loadType ?? "total"}
          onValueChange={(v) => onChange({ loadType: v as LoadType })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOAD_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {LOAD_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {group.loadType === "per_side" && (
        <div className="space-y-1.5">
          <Label>Peso de la barra</Label>
          <Input
            type="number"
            step="0.5"
            value={group.barWeight ?? ""}
            onChange={(e) => onChange({ barWeight: numOrNull(e.target.value) })}
          />
        </div>
      )}
    </div>
  );
}

export function EntryEditor({
  entry,
  index,
  onChange,
  onRemove,
}: {
  entry: DraftEntry;
  index: number;
  onChange: (e: DraftEntry) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<DraftEntry>) => onChange({ ...entry, ...patch });

  const setGroup = (i: number, patch: Partial<SetGroup>) =>
    set({ lines: entry.lines.map((g, j) => (j === i ? { ...g, ...patch } : g)) });
  const addGroup = () =>
    set({ lines: [...entry.lines, { ...(entry.lines[entry.lines.length - 1] ?? EMPTY_GROUP) }] });
  const removeGroup = (i: number) =>
    set({ lines: entry.lines.filter((_, j) => j !== i) });
  // Split every group into individual single-set groups for per-set editing.
  const splitIntoSets = () =>
    set({
      lines: entry.lines.flatMap((g) =>
        Array.from({ length: Math.max(1, Math.floor(g.count || 1)) }, () => ({
          ...g,
          count: 1,
        })),
      ),
    });

  return (
    <Card className="gap-0 overflow-hidden py-0">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border bg-secondary/40 px-4 py-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 font-mono text-xs font-bold text-primary">
          {index}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display font-bold leading-tight">
            {entry.exerciseName}
          </div>
          <div className="text-xs text-muted-foreground">
            {TYPE_LABELS[entry.exerciseType]}
          </div>
        </div>
        <button
          onClick={onRemove}
          aria-label="Quitar ejercicio"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
        >
          <X className="size-4" />
        </button>
      </div>

      <CardContent className="space-y-3 py-4">
        {entry.exerciseType === "strength" && (
          <div className="space-y-3">
            {entry.lines.map((group, i) => {
              const multi = entry.lines.length > 1;
              return (
                <div
                  key={i}
                  className={
                    multi
                      ? "space-y-3 rounded-xl border border-border bg-secondary/20 p-3"
                      : "space-y-3"
                  }
                >
                  {multi && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">
                        Grupo {i + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeGroup(i)}
                        aria-label={`Quitar grupo ${i + 1}`}
                        className="grid size-7 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  )}
                  <GroupFields group={group} onChange={(patch) => setGroup(i, patch)} />
                </div>
              );
            })}

            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={addGroup}>
                <Plus className="size-4" />
                Añadir grupo de series
              </Button>
              {entry.lines.some((g) => g.count > 1) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={splitIntoSets}
                >
                  Editar series individuales
                </Button>
              )}
            </div>
          </div>
        )}

        {entry.exerciseType === "cardio" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Minutos</Label>
              <Input
                type="number"
                min={0}
                value={entry.durationMinutes ?? ""}
                onChange={(e) =>
                  set({ durationMinutes: numOrNull(e.target.value) })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Distancia</Label>
              <Input
                type="number"
                step="0.1"
                value={entry.distance ?? ""}
                onChange={(e) => set({ distance: numOrNull(e.target.value) })}
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>Comentario</Label>
          <Input
            value={entry.comment}
            onChange={(e) => set({ comment: e.target.value })}
            placeholder="sin lastre, volviendo de molestia…"
          />
        </div>
      </CardContent>
    </Card>
  );
}
