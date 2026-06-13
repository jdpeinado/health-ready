import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { ExerciseType } from "@health-ready/shared";
import {
  useExercises,
  useCreateExercise,
  useDeleteExercise,
} from "./useExercises";
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

const TYPES: ExerciseType[] = ["strength", "cardio", "mobility"];

const TYPE_META: Record<ExerciseType, { label: string; chip: string }> = {
  strength: {
    label: "Fuerza",
    chip: "bg-primary/15 text-primary",
  },
  cardio: {
    label: "Cardio",
    chip: "bg-chart-2/15 text-chart-2",
  },
  mobility: {
    label: "Movilidad",
    chip: "bg-chart-5/15 text-chart-5",
  },
};

export function ExercisesAdminPage() {
  const list = useExercises(true);
  const create = useCreateExercise();
  const del = useDeleteExercise();
  const [name, setName] = useState("");
  const [type, setType] = useState<ExerciseType>("strength");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await create.mutateAsync({ name: name.trim(), type });
    setName("");
  }

  return (
    <div className="animate-rise space-y-6">
      <header className="space-y-1.5">
        <p className="eyebrow">Catálogo</p>
        <h1 className="page-title">Ejercicios</h1>
      </header>

      <div className="grid gap-6 lg:grid-cols-[22rem_1fr] lg:items-start">
        {/* Create form */}
        <Card className="lg:sticky lg:top-8">
          <CardContent>
            <form onSubmit={add} className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Press de banca"
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as ExerciseType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {TYPE_META[t].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={create.isPending}
              >
                <Plus className="size-4" />
                Agregar
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <div className="space-y-2.5">
          {list.isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-2xl border border-border bg-card/50"
              />
            ))}

          {list.data?.map((ex) => {
            const meta = TYPE_META[ex.type];
            return (
              <Card
                key={ex.id}
                className={ex.isActive ? "py-0" : "py-0 opacity-55"}
              >
                <CardContent className="flex items-center gap-3 py-3.5">
                  <span
                    className={`shrink-0 rounded-md px-2 py-1 font-mono text-[0.65rem] font-semibold uppercase tracking-wide ${meta.chip}`}
                  >
                    {meta.label}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{ex.name}</div>
                    {!ex.isActive && (
                      <div className="text-xs text-muted-foreground">
                        inactivo
                      </div>
                    )}
                  </div>
                  {ex.isActive && (
                    <button
                      onClick={() => del.mutate(ex.id)}
                      aria-label={`Desactivar ${ex.name}`}
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
