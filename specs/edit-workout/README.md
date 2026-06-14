# Edit a Saved Workout — Spec

**Date:** 2026-06-14
**Status:** Implemented (2026-06-14)

## Purpose

Once a workout is saved, there is currently no way to change it. The
`WorkoutDetailPage` (`/workouts/:id`) is read-only — it only offers **Copiar** and
**Eliminar**. A user who wants to fix a set, change the date/name, or add/remove an
exercise after saving has to delete and re-create the whole session.

This feature adds the ability to **edit an existing workout**: change its date/name,
edit each exercise's sets, and add or remove exercises.

## What already exists (no backend work needed)

The backend fully supports editing already:

- **`PATCH /workouts/:id`** (`apps/api/src/routes/workouts.ts`) accepts
  `updateWorkoutSchema` and calls `replaceWorkout`.
- **`replaceWorkout`** (`apps/api/src/services/workouts.ts`): when `entries` is
  present it deletes all existing entries (cascading to sets) and re-inserts the
  supplied set — exactly the semantics needed for "edit / add / remove exercises". It
  also patches `date` / `name` / `notes`, and validates that every `exerciseId`
  exists.
- **`useUpdateWorkout(id)`** (`apps/web/src/features/workouts/useWorkoutMutations.ts`)
  already wraps that endpoint and invalidates both `["workouts"]` and
  `["workout", id]`. It is currently **unused**.

So this feature is **frontend-only**: surface an edit screen that reuses the existing
new-workout form and saves through the existing hook.

## The core technical wrinkle

The create form works with a **collapsed** representation — a `UniformLine`
(`count`, `reps`, `weight`, `weightUnit`, `loadType`, `barWeight`) that describes N
identical sets at once (see `apps/web/src/features/workouts/EntryEditor.tsx` and
`sets.ts`). A **saved** workout, however, stores **expanded** individual `sets`
(`WorkoutDetail` from `GET /workouts/:id`).

To edit, each saved entry must be converted back into the editor's `DraftEntry`
shape. Because the app only ever _creates_ uniform sets (via `uniformToSets`), this
round-trips cleanly: derive `count` from the number of sets and read
`reps`/`weight`/`weightUnit`/`loadType`/`barWeight` from the first set.

**Known limitation (accepted):** if a workout somehow contained non-uniform sets
(only possible by editing the DB/API directly — the UI never produces them), opening
it in the editor and saving would re-uniform all its sets to match the first one.
This is consistent with the app's uniform-sets model and is acceptable.

## Approach (chosen)

**Dedicated edit page** at `/workouts/:id/edit`, reusing the new-workout form via a
shared component. (Alternative considered: in-place inline edit mode on the detail
page — rejected as more state-juggling for no real benefit given the form already
exists.)

## Design

### 1. Extract a shared `WorkoutForm` component

Today the entire form lives inside `NewWorkoutPage`
(`apps/web/src/features/workouts/NewWorkoutPage.tsx`). Extract it into a reusable
component so both New and Edit render the same UI.

**New file:** `apps/web/src/features/workouts/WorkoutForm.tsx`

Responsibilities (the current `NewWorkoutPage` body, made controlled):

- Renders: date input, name input, the entries list (`EntryEditor` per entry), the
  "Agregar ejercicio" picker, and the save button.
- Owns the draft state for `date`, `name`, and `entries: DraftEntry[]`, initialized
  from props.
- Calls back to the parent to persist.

Proposed props:

```ts
interface WorkoutFormProps {
  initialDate: string;
  initialName: string;
  initialEntries: DraftEntry[];
  submitLabel: string; // "Guardar entrenamiento" | "Guardar cambios"
  pendingLabel: string; // "Guardando…"
  isPending: boolean;
  onSubmit: (payload: {
    date: string;
    name: string | null;
    entries: DraftEntry[];
  }) => void;
  // header text differs slightly between create/edit
  eyebrow: string;
  title: string;
}
```

The form converts entries to `EntryInput[]` via the existing `toEntryInput` before
calling `onSubmit` (or passes `DraftEntry[]` up and lets the page map — decide during
implementation; keep `toEntryInput` as the single source of the draft→API mapping).

### 2. `NewWorkoutPage` becomes a thin wrapper

- Builds an empty initial state (`initialEntries: []`, `initialDate: todayIso()`,
  `initialName: ""`).
- Wires `useCreateWorkout`; on success navigates to `/workouts/:id` of the created
  workout.
- Keeps `draftFor(ex)` (used when adding a new exercise) — this likely moves into
  `WorkoutForm` since adding an exercise happens inside the form. `todayIso` /
  `prettyDate` move/stay as needed.

### 3. New `EditWorkoutPage`

**New file:** `apps/web/src/features/workouts/EditWorkoutPage.tsx`

- Reads `:id` from the route.
- Loads the workout with `useWorkout(id)` and the catalog with `useExercises()`
  (needed to resolve each entry's `type` and display name).
- Converts the loaded `WorkoutDetail` into `DraftEntry[]` via a new
  `fromEntryDetail` helper (see below).
- Renders `WorkoutForm` with `submitLabel="Guardar cambios"`.
- On submit, calls `useUpdateWorkout(id).mutateAsync({ date, name, entries })` and
  navigates back to `/workouts/:id`.
- Handles loading / not-found states (mirror `WorkoutDetailPage`: "Cargando…" /
  "No encontrado.").

### 4. The conversion helper `fromEntryDetail`

**Location:** `apps/web/src/features/workouts/EntryEditor.tsx` (next to
`toEntryInput`, its inverse) — or a small `draft.ts`; decide during implementation.

Signature:

```ts
function fromEntryDetail(
  entry: EntryDetail,
  exercise: { name: string; type: ExerciseType },
): DraftEntry;
```

Mapping (inverse of `toEntryInput`):

- **strength** — collapse `entry.sets` into a `UniformLine`:
  - `count = entry.sets.length` (fallback 1 if empty)
  - `reps`, `weight`, `weightUnit`, `loadType`, `barWeight` from `entry.sets[0]`
    (guard the index access — `noUncheckedIndexedAccess` is on)
  - sensible defaults when there are no sets (`reps: null`, `weightUnit: "kg"`,
    `loadType: "total"`, etc.) to match `draftFor`.
- **cardio** — `durationMinutes = entry.durationSeconds != null ?
Math.round(entry.durationSeconds / 60) : null`; `distance = entry.distance`;
  `distanceUnit = entry.distanceUnit ?? "km"`.
- **mobility** — just `comment`.
- All types: `comment = entry.comment ?? ""`, plus `exerciseId`, `exerciseName`,
  `exerciseType`.

An exercise referenced by the entry but missing from the catalog (e.g. deactivated)
should still be editable — fall back to a placeholder name and the entry's stored
shape. Resolve `type` from the catalog when present.

### 5. Wire the route and the button

- **`apps/web/src/app/router.tsx`** — add
  `{ path: "/workouts/:id/edit", element: <EditWorkoutPage /> }` inside the existing
  `Layout` children.
- **`apps/web/src/features/history/WorkoutDetailPage.tsx`** — add an **"Editar"**
  button (lucide `Pencil` icon) in the actions sidebar, linking to
  `/workouts/${id}/edit`.

## Data flow

```
WorkoutDetailPage ──"Editar"──▶ /workouts/:id/edit
                                       │
                            useWorkout(id) + useExercises()
                                       │  fromEntryDetail (per entry)
                                       ▼
                                 DraftEntry[]
                                       │
                                  WorkoutForm  ◀── shared with NewWorkoutPage
                                       │  toEntryInput (per entry)
                                       ▼
                  useUpdateWorkout(id).mutateAsync({ date, name, entries })
                                       │  PATCH /workouts/:id → replaceWorkout
                                       ▼
                       invalidate ["workouts"], ["workout", id]
                                       │
                                 navigate /workouts/:id
```

## Error handling

- **Load failure / not found** — show the same messaging as `WorkoutDetailPage`.
- **Empty workout** — saving a workout with zero entries stays disabled, matching the
  create form (to truly empty a session, delete it). The save button also stays
  disabled while `isPending`.
- **Unknown exerciseId** — not expected through the UI (exercises come from the
  catalog), but the backend already returns `400 { error: "unknown exerciseId" }`;
  surface a generic failure if it occurs.

## Testing

- **Unit:** `fromEntryDetail` for each exercise type, including the round-trip
  `toEntryInput(fromEntryDetail(...))` preserving values for a uniform strength entry,
  a cardio entry, and a mobility entry. Add to
  `apps/web/src/features/workouts/sets.test.ts` or a new `draft.test.ts`.
- **Existing coverage:** the `replaceWorkout` / `PATCH /workouts/:id` backend path is
  already exercised by `apps/api/test/workouts.routes.test.ts` and
  `workouts.service.test.ts` — no new backend tests required.
- Keep web tests network-free (stub `fetch`); guard indexed access for
  `noUncheckedIndexedAccess`.

## Out of scope (YAGNI)

- Per-set custom values (different reps/weight per set) — stays uniform.
- Autosave / draft persistence.
- Optimistic UI beyond the existing invalidate-on-success.
- Reordering exercises (current order is by add position; not part of this change).

## Files touched

| File                                                             | Change                           |
| ---------------------------------------------------------------- | -------------------------------- |
| `apps/web/src/features/workouts/WorkoutForm.tsx`                 | **new** — shared form            |
| `apps/web/src/features/workouts/EditWorkoutPage.tsx`             | **new** — edit screen            |
| `apps/web/src/features/workouts/EntryEditor.tsx` (or `draft.ts`) | **new** `fromEntryDetail` helper |
| `apps/web/src/features/workouts/NewWorkoutPage.tsx`              | refactor to use `WorkoutForm`    |
| `apps/web/src/app/router.tsx`                                    | add `/workouts/:id/edit` route   |
| `apps/web/src/features/history/WorkoutDetailPage.tsx`            | add "Editar" button              |
| `apps/web/src/features/workouts/*.test.ts`                       | unit tests for the conversion    |

## Docs to update after implementation

- `docs/web/features.md` — the Workout Detail section currently notes that in-place
  editing "is not wired into the detail UI"; update it once Edit ships.
- `docs/web/routing-and-state.md` — add the `/workouts/:id/edit` route and note
  `useUpdateWorkout` is now used.

## Implementation notes

Implemented directly from this spec (TDD on the `fromEntryDetail` conversion). The
helper landed in `EntryEditor.tsx` next to its inverse `toEntryInput`, with tests in
`apps/web/src/features/workouts/draft.test.ts`. Docs (`docs/web/features.md`,
`docs/web/routing-and-state.md`) were updated. `make typecheck` and `make test` pass;
`web build` succeeds. No backend or schema changes were required.
