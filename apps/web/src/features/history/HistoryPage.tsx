import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ChevronRight, History, Layers, Search, X } from "lucide-react";
import { useWorkouts } from "./useWorkouts";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Debounce the free-text search so typing doesn't fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const filters = useMemo(
    () => ({
      q: debouncedQ || undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [debouncedQ, from, to],
  );
  const hasFilters = Boolean(filters.q || filters.from || filters.to);

  const workouts = useWorkouts(filters);

  function clearFilters() {
    setSearch("");
    setDebouncedQ("");
    setFrom("");
    setTo("");
  }

  return (
    <div className="animate-rise space-y-6">
      <header className="space-y-1.5">
        <p className="eyebrow">Tu registro</p>
        <h1 className="page-title">Historial</h1>
      </header>

      {/* Filter bar */}
      <Card className="p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Buscar</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por nombre…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Desde</span>
              <Input
                type="date"
                aria-label="Desde"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Hasta</span>
              <Input
                type="date"
                aria-label="Hasta"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground sm:self-end"
              onClick={clearFilters}
            >
              <X className="size-4" />
              Limpiar
            </Button>
          )}
        </div>
      </Card>

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
          {hasFilters ? (
            <>
              <p className="text-sm font-medium text-foreground">
                Ningún entrenamiento coincide con los filtros
              </p>
              <p className="text-sm text-muted-foreground">
                Prueba con otro nombre o rango de fechas.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">
                Aún no hay entrenamientos
              </p>
              <p className="text-sm text-muted-foreground">
                Cuando guardes una sesión aparecerá aquí.
              </p>
            </>
          )}
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
