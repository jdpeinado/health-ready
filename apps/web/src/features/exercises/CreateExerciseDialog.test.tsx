import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateExerciseDialog } from "./CreateExerciseDialog";

const hoisted = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}));

vi.mock("./useExercises", () => ({
  useCreateExercise: () => ({
    mutateAsync: hoisted.mutateAsync,
    isPending: hoisted.isPending,
  }),
}));

const created = {
  id: "ex1",
  name: "Sentadilla",
  type: "strength" as const,
  muscleGroup: null,
  isActive: true,
  createdAt: 0,
};

describe("CreateExerciseDialog", () => {
  beforeEach(() => {
    hoisted.mutateAsync.mockReset().mockResolvedValue(created);
    hoisted.isPending = false;
  });

  it("creates the exercise and fires onCreated with the result", async () => {
    const onCreated = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <CreateExerciseDialog open onOpenChange={onOpenChange} onCreated={onCreated} />,
    );

    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Sentadilla" },
    });
    fireEvent.click(screen.getByRole("button", { name: /crea/i }));

    await waitFor(() =>
      expect(hoisted.mutateAsync).toHaveBeenCalledWith({
        name: "Sentadilla",
        type: "strength",
      }),
    );
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(created));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("disables submit when the name is blank", () => {
    render(<CreateExerciseDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
    expect(screen.getByRole("button", { name: /crea/i })).toBeDisabled();
  });

  it("disables submit while the mutation is pending", () => {
    hoisted.isPending = true;
    render(<CreateExerciseDialog open onOpenChange={vi.fn()} onCreated={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Nombre"), {
      target: { value: "Sentadilla" },
    });
    expect(screen.getByRole("button", { name: /crea/i })).toBeDisabled();
  });
});
