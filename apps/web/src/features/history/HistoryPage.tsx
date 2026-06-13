import { Link } from "react-router-dom";
import { CalendarDays, ChevronRight, History, Layers } from "lucide-react";
import { useWorkouts } from "./useWorkouts";
import { Card } from "@/components/ui/card";

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function HistoryPage() {
  const workouts = useWorkouts();

  return (
    <div className="animate-rise space-y-6">
      <header className="space-y-1.5">
        <p className="eyebrow">Tu registro</p>
        <h1 className="page-title">Historial</h1>
      </header>

      {workouts.isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-border bg-card/50"
            />
          ))}
        </div>
      )}

      {!workouts.isLoading && !workouts.data?.length && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/30 px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-secondary text-muted-foreground">
            <History className="size-5" />
          </span>
          <p className="text-sm font-medium text-foreground">
            Aún no hay entrenamientos
          </p>
          <p className="text-sm text-muted-foreground">
            Cuando guardes una sesión aparecerá aquí.
          </p>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {workouts.data?.map((w) => (
          <Link key={w.id} to={`/workouts/${w.id}`} className="group block">
            <Card className="gap-0 py-0 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-black/20">
              <div className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <h3 className="truncate font-display font-bold leading-tight">
                    {w.name ?? "Entrenamiento"}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1 font-mono">
                      <CalendarDays className="size-3.5" />
                      {prettyDate(w.date)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="size-3.5" />
                      {w.entryCount} ejercicios
                    </span>
                  </div>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
