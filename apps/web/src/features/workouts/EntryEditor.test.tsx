import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EntryEditor, type DraftEntry } from "./EntryEditor";

function strengthDraft(lines: DraftEntry["lines"]): DraftEntry {
  return {
    exerciseId: "ex-1",
    exerciseName: "Sentadilla",
    exerciseType: "strength",
    comment: "",
    lines,
    durationMinutes: null,
    distance: null,
    distanceUnit: "km",
  };
}

type Group = DraftEntry["lines"][number];
const group = (over: Partial<Group> = {}): Group => ({
  count: 3,
  reps: 10,
  weight: 60,
  weightUnit: "kg",
  loadType: "total",
  barWeight: null,
  ...over,
});

function renderEntry(entry: DraftEntry) {
  const onChange = vi.fn();
  render(
    <EntryEditor entry={entry} index={1} onChange={onChange} onRemove={vi.fn()} />,
  );
  return { onChange };
}

describe("EntryEditor — set groups", () => {
  it("renders one field set per group", () => {
    renderEntry(strengthDraft([group({ weight: 60 }), group({ weight: 80 })]));
    expect(screen.getAllByText("Series")).toHaveLength(2);
    expect(screen.getByText("Grupo 1")).toBeInTheDocument();
    expect(screen.getByText("Grupo 2")).toBeInTheDocument();
  });

  it("appends a group cloned from the last when 'Añadir grupo' is clicked", () => {
    const { onChange } = renderEntry(strengthDraft([group({ weight: 80 })]));
    fireEvent.click(screen.getByRole("button", { name: /añadir grupo/i }));
    const next = onChange.mock.calls[0]![0] as DraftEntry;
    expect(next.lines).toHaveLength(2);
    expect(next.lines[1]?.weight).toBe(80);
  });

  it("removes a group", () => {
    const { onChange } = renderEntry(
      strengthDraft([group({ weight: 60 }), group({ weight: 80 })]),
    );
    fireEvent.click(screen.getByRole("button", { name: "Quitar grupo 2" }));
    const next = onChange.mock.calls[0]![0] as DraftEntry;
    expect(next.lines).toHaveLength(1);
    expect(next.lines[0]?.weight).toBe(60);
  });

  it("hides group chrome (header/remove) for a single group", () => {
    renderEntry(strengthDraft([group({ count: 1 })]));
    expect(screen.queryByText("Grupo 1")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /quitar grupo/i }),
    ).not.toBeInTheDocument();
    // A single 1-set group has nothing to split, so the option is hidden.
    expect(
      screen.queryByRole("button", { name: /editar series individuales/i }),
    ).not.toBeInTheDocument();
  });

  it("splits a group of N into N single-set groups", () => {
    const { onChange } = renderEntry(strengthDraft([group({ count: 3, weight: 60 })]));
    fireEvent.click(
      screen.getByRole("button", { name: /editar series individuales/i }),
    );
    const next = onChange.mock.calls[0]![0] as DraftEntry;
    expect(next.lines).toHaveLength(3);
    expect(next.lines.every((g) => g.count === 1 && g.weight === 60)).toBe(true);
  });
});
