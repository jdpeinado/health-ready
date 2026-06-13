import type {
  ExerciseType,
  WeightUnit,
  LoadType,
  EntryInput,
} from "@health-ready/shared";
import { uniformToSets, type UniformLine } from "./sets";
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

export interface DraftEntry {
  exerciseId: string;
  exerciseName: string;
  exerciseType: ExerciseType;
  comment: string;
  // strength
  line: UniformLine;
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
      sets: uniformToSets(d.line),
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

export function EntryEditor({
  entry,
  onChange,
  onRemove,
}: {
  entry: DraftEntry;
  onChange: (e: DraftEntry) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<DraftEntry>) => onChange({ ...entry, ...patch });
  const setLine = (patch: Partial<UniformLine>) =>
    set({ line: { ...entry.line, ...patch } });
  const numOrNull = (v: string) => (v === "" ? null : Number(v));

  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-center justify-between gap-2">
          <strong className="font-medium">{entry.exerciseName}</strong>
          <Button variant="destructive" size="sm" onClick={onRemove}>
            Quitar
          </Button>
        </div>

        {entry.exerciseType === "strength" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Series</Label>
                <Input
                  type="number"
                  min={1}
                  value={entry.line.count}
                  onChange={(e) => setLine({ count: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Reps</Label>
                <Input
                  type="number"
                  min={0}
                  value={entry.line.reps ?? ""}
                  onChange={(e) => setLine({ reps: numOrNull(e.target.value) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Peso</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={entry.line.weight ?? ""}
                  disabled={entry.line.loadType === "bodyweight"}
                  onChange={(e) =>
                    setLine({ weight: numOrNull(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unidad</Label>
                <Select
                  value={entry.line.weightUnit ?? "kg"}
                  onValueChange={(v) =>
                    setLine({ weightUnit: v as WeightUnit })
                  }
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
                value={entry.line.loadType ?? "total"}
                onValueChange={(v) => setLine({ loadType: v as LoadType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOAD_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {entry.line.loadType === "per_side" && (
              <div className="space-y-1.5">
                <Label>Peso de la barra</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={entry.line.barWeight ?? ""}
                  onChange={(e) =>
                    setLine({ barWeight: numOrNull(e.target.value) })
                  }
                />
              </div>
            )}
          </>
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
