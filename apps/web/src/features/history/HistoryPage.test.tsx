import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { HistoryPage } from "./HistoryPage";

const useWorkoutsMock = vi.fn();
vi.mock("./useWorkouts", () => ({
  useWorkouts: (filters: unknown) => useWorkoutsMock(filters),
}));

function lastFilters(): { q?: string; from?: string; to?: string } {
  return useWorkoutsMock.mock.calls.at(-1)?.[0] ?? {};
}

beforeEach(() => {
  useWorkoutsMock.mockReset();
  useWorkoutsMock.mockReturnValue({
    isLoading: false,
    data: [
      { id: "1", date: "2026-06-01", name: "Pull day", notes: null, createdAt: 0, entryCount: 2 },
    ],
  });
});

function renderPage() {
  return render(
    <MemoryRouter>
      <HistoryPage />
    </MemoryRouter>,
  );
}

describe("HistoryPage", () => {
  it("renders workouts returned by the query", () => {
    renderPage();
    expect(screen.getByText("Pull day")).toBeInTheDocument();
  });

  it("starts with no filters applied", () => {
    renderPage();
    const f = lastFilters();
    expect(f.q).toBeUndefined();
    expect(f.from).toBeUndefined();
    expect(f.to).toBeUndefined();
  });

  it("debounces the search text into the q filter", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByPlaceholderText(/buscar/i), "pull");
    await waitFor(() => expect(lastFilters().q).toBe("pull"));
  });

  it("passes the date range into the from/to filters", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-03-01" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-03-31" } });
    await waitFor(() => {
      expect(lastFilters().from).toBe("2026-03-01");
      expect(lastFilters().to).toBe("2026-03-31");
    });
  });

  it("shows a filtered empty state when filters match nothing", () => {
    useWorkoutsMock.mockReturnValue({ isLoading: false, data: [] });
    renderPage();
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2030-01-01" } });
    expect(screen.getByText(/ningún entrenamiento coincide/i)).toBeInTheDocument();
  });
});
