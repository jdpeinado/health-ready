import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ExercisePicker } from "./ExercisePicker";
import type { Exercise } from "../../api/types";

const ex = (over: Partial<Exercise> & { id: string; name: string }): Exercise => ({
  type: "strength",
  muscleGroup: null,
  isActive: true,
  createdAt: 0,
  ...over,
});

const EXERCISES: Exercise[] = [
  ex({ id: "1", name: "Bench Press" }),
  ex({ id: "2", name: "Squat" }),
  ex({ id: "3", name: "Deadlift" }),
];

function open(exercises = EXERCISES, onSelect = vi.fn()) {
  const user = userEvent.setup();
  render(<ExercisePicker exercises={exercises} onSelect={onSelect} />);
  return { user, onSelect };
}

describe("ExercisePicker", () => {
  it("shows all exercises when opened", async () => {
    const { user } = open();
    await user.click(screen.getByRole("combobox"));
    expect(screen.getByText("Bench Press")).toBeInTheDocument();
    expect(screen.getByText("Squat")).toBeInTheDocument();
    expect(screen.getByText("Deadlift")).toBeInTheDocument();
  });

  it("filters the list as the user types", async () => {
    const { user } = open();
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText(/buscar/i), "ben");
    await waitFor(() => {
      expect(screen.getByText("Bench Press")).toBeInTheDocument();
      expect(screen.queryByText("Squat")).not.toBeInTheDocument();
    });
  });

  it("shows an empty state when nothing matches", async () => {
    const { user } = open();
    await user.click(screen.getByRole("combobox"));
    await user.type(screen.getByPlaceholderText(/buscar/i), "zzzzz");
    await waitFor(() =>
      expect(screen.getByText(/sin resultados/i)).toBeInTheDocument(),
    );
  });

  it("calls onSelect with the chosen exercise and closes", async () => {
    const { user, onSelect } = open();
    await user.click(screen.getByRole("combobox"));
    await user.click(screen.getByText("Squat"));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "2", name: "Squat" }));
    await waitFor(() =>
      expect(screen.queryByPlaceholderText(/buscar/i)).not.toBeInTheDocument(),
    );
  });
});
