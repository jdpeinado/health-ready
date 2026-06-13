import { Link } from "react-router-dom";
import { useWorkouts } from "./useWorkouts";
import { Card, CardContent } from "@/components/ui/card";

export function HistoryPage() {
  const workouts = useWorkouts();
  if (workouts.isLoading)
    return <p className="text-muted-foreground">Cargando…</p>;
  if (!workouts.data?.length)
    return <p className="text-muted-foreground">Aún no hay entrenamientos.</p>;
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold">Historial</h3>
      <div className="space-y-2">
        {workouts.data.map((w) => (
          <Link key={w.id} to={`/workouts/${w.id}`} className="block">
            <Card className="transition-colors hover:bg-accent">
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <strong className="font-medium">
                    {w.name ?? "Entrenamiento"}
                  </strong>
                  <span className="text-sm text-muted-foreground">
                    {w.date}
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  {w.entryCount} ejercicios
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
