import { useParams, useNavigate } from "react-router-dom";
import { useWorkout } from "../history/useWorkouts";
import { useExercises } from "../exercises/useExercises";
import { useUpdateWorkout } from "./useWorkoutMutations";
import { WorkoutForm } from "./WorkoutForm";
import { fromEntryDetail, type DraftEntry } from "./EntryEditor";

export function EditWorkoutPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const workout = useWorkout(id);
  const exercises = useExercises();
  const update = useUpdateWorkout(id);

  if (workout.isLoading || exercises.isLoading)
    return <p className="animate-rise text-muted-foreground">Cargando…</p>;
  if (!workout.data)
    return <p className="animate-rise text-destructive">No encontrado.</p>;

  const w = workout.data;
  const byId = new Map(exercises.data?.map((ex) => [ex.id, ex]) ?? []);

  const initialEntries: DraftEntry[] = w.entries.map((e) => {
    const ex = byId.get(e.exerciseId);
    return fromEntryDetail(e, {
      name: ex?.name ?? "Ejercicio",
      type: ex?.type ?? "strength",
    });
  });

  return (
    <WorkoutForm
      initialDate={w.date}
      initialName={w.name ?? ""}
      initialEntries={initialEntries}
      eyebrow="Editar sesión"
      title="Editar entrenamiento"
      submitLabel="Guardar cambios"
      pendingLabel="Guardando…"
      isPending={update.isPending}
      onSubmit={async ({ date, name, entries }) => {
        // Omit `notes` so the workout's existing notes are preserved (the form
        // doesn't edit them); sending notes would overwrite them.
        await update.mutateAsync({ date, name, entries });
        navigate(`/workouts/${id}`);
      }}
    />
  );
}
