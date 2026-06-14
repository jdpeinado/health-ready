import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { LineChart as LineChartIcon, TrendingUp } from "lucide-react";
import { useExercises } from "../exercises/useExercises";
import { useProgress, useProgressSummary } from "./useProgress";
import { roundKg } from "./format";
import { SparklineCard } from "./SparklineCard";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AMBER = "#f0923c";

function StatTile({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-2xl font-bold tabular-nums">
        {value}
        <span className="ml-1 text-sm font-medium text-muted-foreground">
          {unit}
        </span>
      </div>
    </div>
  );
}

export function ProgressPage() {
  const exercises = useExercises();
  const summary = useProgressSummary();
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const progress = useProgress(exerciseId);
  const previews = summary.data?.items ?? [];

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
          : roundKg(p.bestTotalLoadKg ?? 0),
  }));

  const yLabel = type === "cardio" ? "min" : usesReps ? "reps" : "kg";
  const values = data.map((d) => d.value);
  const latest = values.length ? values[values.length - 1]! : 0;
  const peak = values.length ? Math.max(...values) : 0;

  return (
    <div className="animate-rise space-y-6">
      <header className="space-y-1.5">
        <p className="eyebrow">Tu evolución</p>
        <h1 className="page-title">Progreso</h1>
      </header>

      <Card>
        <CardContent className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <TrendingUp className="size-3.5" />
            Ejercicio
          </Label>
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

      {previews.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Resumen
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {previews.map((item) => (
              <SparklineCard
                key={item.exerciseId}
                item={item}
                selected={item.exerciseId === exerciseId}
                onClick={() => setExerciseId(item.exerciseId)}
              />
            ))}
          </div>
        </section>
      )}

      {!exerciseId && previews.length === 0 && !summary.isLoading && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/30 px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
            <LineChartIcon className="size-5" />
          </span>
          <p className="text-sm font-medium text-foreground">
            Aún no hay datos
          </p>
          <p className="text-sm text-muted-foreground">
            Registra entrenamientos para ver tu progreso.
          </p>
        </div>
      )}

      {progress.isLoading && exerciseId && (
        <div className="h-72 animate-pulse rounded-2xl border border-border bg-card/50" />
      )}

      {exerciseId && data.length === 0 && !progress.isLoading && (
        <p className="text-muted-foreground">Sin datos todavía.</p>
      )}

      {data.length > 0 && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <StatTile label="Actual" value={String(latest)} unit={yLabel} />
            <StatTile label="Mejor marca" value={String(peak)} unit={yLabel} />
            <StatTile label="Sesiones" value={String(data.length)} unit="" />
          </div>

          <Card>
            <CardContent className="h-[320px] pr-2 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data}
                  margin={{ top: 12, right: 8, left: -12, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="fillAmber" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={AMBER} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={AMBER} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    stroke="rgba(255,255,255,0.07)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    stroke="#8b857c"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    stroke="#8b857c"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    cursor={{ stroke: AMBER, strokeOpacity: 0.3 }}
                    contentStyle={{
                      background: "#262320",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: "0.75rem",
                      fontSize: "0.8rem",
                    }}
                    labelStyle={{ color: "#8b857c" }}
                    formatter={(v: number) => [`${v} ${yLabel}`, ""]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={AMBER}
                    strokeWidth={2.5}
                    fill="url(#fillAmber)"
                    dot={{ fill: AMBER, r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
