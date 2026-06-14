import { useState } from "react";
import type { ExerciseType } from "@health-ready/shared";
import type { Exercise } from "../../api/types";
import { useCreateExercise } from "./useExercises";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TYPES: ExerciseType[] = ["strength", "cardio", "mobility"];
const TYPE_LABELS: Record<ExerciseType, string> = {
  strength: "Fuerza",
  cardio: "Cardio",
  mobility: "Movilidad",
};

export function CreateExerciseDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (exercise: Exercise) => void;
}) {
  const create = useCreateExercise();
  const [name, setName] = useState("");
  const [type, setType] = useState<ExerciseType>("strength");
  const [failed, setFailed] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setFailed(false);
    try {
      const created = await create.mutateAsync({ name: trimmed, type });
      onCreated(created);
      setName("");
      setType("strength");
      onOpenChange(false);
    } catch {
      setFailed(true);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear ejercicio</DialogTitle>
          <DialogDescription>
            Se agrega al catálogo y queda listo para usar en esta sesión.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-exercise-name">Nombre</Label>
            <Input
              id="new-exercise-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Press de banca"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as ExerciseType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {failed && (
            <p className="text-sm text-destructive">
              No se pudo crear el ejercicio. Intenta de nuevo.
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending ? "Creando…" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
