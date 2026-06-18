import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WorkoutForm } from "./WorkoutForm";

const hoisted = vi.hoisted(() => ({
  role: "admin" as "admin" | "user",
  exercises: [
    {
      id: "e1",
      name: "Press",
      type: "strength" as const,
      muscleGroup: null,
      isActive: true,
      createdAt: 0,
    },
  ],
  mutateAsync: vi.fn(),
}));

vi.mock("../exercises/useExercises", () => ({
  useExercises: () => ({ data: hoisted.exercises }),
  useCreateExercise: () => ({ mutateAsync: hoisted.mutateAsync, isPending: false }),
}));

vi.mock("../../auth/useAuth", () => ({
  useMe: () => ({
    data: { id: "u", email: "a@e.com", displayName: "A", role: hoisted.role },
  }),
}));

function renderForm() {
  return render(
    <WorkoutForm
      initialDate="2026-06-14"
      initialName=""
      initialBlocks={[]}
      eyebrow="Nueva sesión"
      title="Nuevo entrenamiento"
      submitLabel="Guardar"
      pendingLabel="Guardando…"
      isPending={false}
      onSubmit={vi.fn()}
    />,
  );
}

describe("WorkoutForm — inline create exercise", () => {
  beforeEach(() => {
    hoisted.role = "admin";
    hoisted.mutateAsync.mockReset();
  });

  it("shows the 'Crear ejercicio' button for admins", () => {
    renderForm();
    expect(
      screen.getByRole("button", { name: "Crear ejercicio" }),
    ).toBeInTheDocument();
  });

  it("hides the 'Crear ejercicio' button for non-admins", () => {
    hoisted.role = "user";
    renderForm();
    expect(
      screen.queryByRole("button", { name: "Crear ejercicio" }),
    ).not.toBeInTheDocument();
  });

  it("appends the newly created exercise to the workout", async () => {
    hoisted.mutateAsync.mockResolvedValue({
      id: "e2",
      name: "Sentadilla",
      type: "strength",
      muscleGroup: null,
      isActive: true,
      createdAt: 0,
    });
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Crear ejercicio" }));
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Sentadilla" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Crear" }));

    // The new exercise appears as an entry in the form.
    expect(await screen.findByText("Sentadilla")).toBeInTheDocument();
  });

  it("adds a bi/tri-series container when a type is selected", async () => {
    renderForm();
    fireEvent.click(screen.getByText("Añadir serie agrupada"));
    fireEvent.click(await screen.findByRole("option", { name: "Tri-serie" }));
    expect(await screen.findByText("Tri-serie")).toBeInTheDocument();
  });
});
