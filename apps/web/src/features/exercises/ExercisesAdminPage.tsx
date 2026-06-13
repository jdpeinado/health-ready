import { useState } from "react";
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
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Ejercicios</h3>
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={add} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Press de banca"
              />
            </div>
            <div className="space-y-1.5">
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
                      {t}
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
              Agregar
            </Button>
          </form>
        </CardContent>
      </Card>

      {list.isLoading && <p className="text-muted-foreground">Cargando…</p>}
      <div className="space-y-2">
        {list.data?.map((ex) => (
          <Card key={ex.id}>
            <CardContent className="flex items-center justify-between gap-2 py-3">
              <div className={ex.isActive ? "" : "opacity-50"}>
                <div className="font-medium">{ex.name}</div>
                <div className="text-sm text-muted-foreground">
                  {ex.type}
                  {ex.isActive ? "" : " · inactivo"}
                </div>
              </div>
              {ex.isActive && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => del.mutate(ex.id)}
                >
                  Desactivar
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
