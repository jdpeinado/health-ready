import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useExercises } from "../exercises/useExercises";
import { useProgress } from "./useProgress";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function ProgressPage() {
  const exercises = useExercises();
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const progress = useProgress(exerciseId);

  const points = progress.data?.points ?? [];
  const type = progress.data?.type;
  // Bodyweight strength has null load → chart reps; otherwise chart best load (kg).
  const usesReps =
    type !== "cardio" &&
    points.length > 0 &&
    points.every((p) => p.bestTotalLoadKg == null);

  const data = points.map((p) => ({
    date: p.date,
    value:
      type === "cardio"
        ? p.maxDurationSeconds != null
          ? Math.round(p.maxDurationSeconds / 60)
          : 0
        : usesReps
          ? (p.topReps ?? 0)
          : (p.bestTotalLoadKg ?? 0),
  }));

  const yLabel = type === "cardio" ? "min" : usesReps ? "reps" : "kg";

  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Progreso</h3>
      <Card>
        <CardContent className="space-y-1.5 pt-6">
          <Label>Ejercicio</Label>
          <Select
            value={exerciseId ?? undefined}
            onValueChange={(v) => setExerciseId(v || null)}
          >
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

      {progress.isLoading && exerciseId && (
        <p className="text-muted-foreground">Cargando…</p>
      )}
      {exerciseId && data.length === 0 && !progress.isLoading && (
        <p className="text-muted-foreground">Sin datos todavía.</p>
      )}
      {data.length > 0 && (
        <Card>
          <CardContent className="h-[280px] pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "#1e293b", border: "none" }}
                  formatter={(v: number) => [`${v} ${yLabel}`, ""]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
