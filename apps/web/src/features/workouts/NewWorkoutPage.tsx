import { useNavigate } from "react-router-dom";
import { useCreateWorkout } from "./useWorkoutMutations";
import { WorkoutForm } from "./WorkoutForm";

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function NewWorkoutPage() {
  const create = useCreateWorkout();
  const navigate = useNavigate();

  return (
    <WorkoutForm
      initialDate={todayIso()}
      initialName=""
      initialEntries={[]}
      eyebrow="Sesión de hoy"
      title="Nuevo entrenamiento"
      submitLabel="Guardar entrenamiento"
      pendingLabel="Guardando…"
      isPending={create.isPending}
      onSubmit={async ({ date, name, entries }) => {
        const workout = await create.mutateAsync({
          date,
          name,
          notes: null,
          entries,
        });
        navigate(`/workouts/${workout.id}`);
      }}
    />
  );
}
