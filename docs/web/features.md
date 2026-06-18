# Features / Pages

A tour of each screen, what it does, and the code behind it. The UI labels are in
Spanish; the route paths and code are English.

---

## Login (`/login`) — `auth/LoginPage.tsx`

A two-panel layout: a branded marketing panel on desktop (hidden on mobile) and the
sign-in form.

- Controlled `email` / `password` inputs; submit calls `useLogin().mutateAsync`.
- On success, navigates to `/`.
- Error mapping: an `ApiError` with status `401` → "Email o contraseña incorrectos";
  any other error → "No se pudo iniciar sesión".
- The submit button shows "Entrando…" and is disabled while `login.isPending`.

---

## New Workout (`/`, "Hoy") — `features/workouts/NewWorkoutPage.tsx`

The primary logging screen. `NewWorkoutPage` is a thin wrapper that renders the
shared **`WorkoutForm`** (`features/workouts/WorkoutForm.tsx`) with an empty draft and
wires `useCreateWorkout`; the same form powers
[Edit Workout](#edit-workout-workoutsidedit--featuresworkoutseditworkoutpagetsx). The
form holds a **draft** workout in local state:

- `date` (defaults to today via `todayIso()`), optional `name`.
- `entries: DraftEntry[]` — added via the **`ExercisePicker`**, a searchable combobox
  (`components/ui/popover.tsx` + `command.tsx`, vendored from Radix Popover + `cmdk`).
  It loads the full catalog client-side (`useExercises`) and filters as you type — no
  server-side search, since a personal catalog is small. Picking an exercise appends a
  draft entry for it.
- **Inline exercise creation (admin only):** when `useMe().data?.role === "admin"`,
  a "Crear ejercicio" button appears under the picker and opens `CreateExerciseDialog`
  (a vendored Radix `Dialog`). On success the exercise is created via
  `useCreateExercise` and appended to the current draft immediately (from the returned
  object, no refetch wait). Non-admins don't see the button; `POST /exercises` is also
  `requireAdmin` server-side, so the gating is enforced, not just hidden.

### Draft model & the hybrid set entry

Each `DraftEntry` (`features/workouts/EntryEditor.tsx`) adapts to the exercise's
`type`:

- **strength** — one or more **set groups** (`lines: SetGroup[]`). Each group is a
  **`UniformLine`** (`count`, `reps`, `weight`, `weightUnit`, `loadType`, `barWeight`)
  describing N identical sets at once (e.g. 3 series × 10 reps @ 60kg total). The
  common case is a single group; varying weights use several (e.g. a heavier first
  set, or a ramp). "Añadir grupo de series" adds a group; "Editar series individuales"
  splits a group of N into N single-set groups for fully per-set editing.
- **cardio** — `durationMinutes` and `distance` (+ `distanceUnit`, default "km").
- **mobility** — just a comment.

On save, `toEntryInput(draft)` converts each draft to the API `EntryInput`:

- strength → `uniformLinesToSets(lines)` flattens the groups in order into `SetInput`
  rows (`features/workouts/sets.ts`; **≤20** sets per group, **≤50** total per entry).
- cardio → `durationSeconds = durationMinutes × 60`, plus `distance`/`distanceUnit`,
  with `sets: []`.
- mobility → just the comment, `sets: []`.

When editing, `fromEntryDetail` does the inverse: `setsToUniformLines` run-length
groups a saved entry's sets back into `lines`, so uniform **and** varying-weight
workouts round-trip losslessly.

The `EntryEditor` form conditionally renders fields per group:

- `weight` is disabled when `loadType === "bodyweight"`.
- the "Peso de la barra" (bar weight) field only appears for `loadType === "per_side"`.
- the per-group header and remove button only appear once an entry has 2+ groups.

Saving calls `useCreateWorkout().mutateAsync({...})` and navigates to the new
workout's detail page. The save button is disabled with no entries or while pending.

### Grouping exercises into bi/tri-series

The form models the workout as an ordered list of **blocks** (`features/workouts/blocks.ts`):
each block is either a standalone exercise or a **group** (bi-series / tri-series /
superserie / circuito) holding 2+ exercises. **"Añadir serie agrupada"** picks a group
type and appends an empty group container; each group has its own embedded
`ExercisePicker` to add exercises into it ("container first").

On save, `blocksToEntries` flattens the blocks to the ordered `EntryInput[]`,
assigning every entry in a group the same client-generated `groupId` plus the group's
`groupType`. Standalone exercises get `groupId: null`. A group left with **<2**
exercises is degraded to standalone entries, and empty groups are dropped — so a
normal save never trips the API's "≥2 entries per group" validation. When editing,
`entriesToBlocks` does the inverse, collapsing consecutive entries that share a
`groupId` back into a group block.

---

## History (`/history`) — `features/history/HistoryPage.tsx`

A responsive grid of workout cards from `useWorkouts(filters)` (`GET /workouts`, newest
first). Each card links to `/workouts/:id` and shows the name (or "Entrenamiento"),
the pretty-printed date, and the exercise count (`entryCount`).

- **Filter bar** — a search `Input` (debounced ~300 ms into the `q` param) plus two
  date inputs, **Desde** / **Hasta** (`from` / `to`, an inclusive range). The filters
  are part of the query key so each combination caches independently. A **Limpiar**
  button appears when any filter is active. Name search matches named workouts only
  (server-side `LIKE` on `name`).

States: a skeleton grid while loading; a "no workouts at all" empty state; and a
distinct "Ningún entrenamiento coincide con los filtros" empty state when filters are
active but match nothing.

---

## Workout Detail (`/workouts/:id`) — `features/history/WorkoutDetailPage.tsx`

Shows one workout in full, plus actions.

- `useWorkout(id)` loads the detail; `useExercises()` provides a id→name map so each
  entry shows its exercise name (entries store `exerciseId`, not the name).
- For each entry it renders the comment (if any) and a list of sets via `setLabel()`,
  which formats each set into a human string, e.g.:
  - bodyweight → `"10 reps · peso corporal"`
  - weighted → `"10 reps · 60kg"`, with ` + barra X` for bar weight and a suffix like
    `(por lado)` / `(por mancuerna)` / `(corporal + lastre)` based on `loadType`.
  - cardio entries instead render minutes and distance.
- **Grouped series** — consecutive entries sharing a `groupId` are collapsed into one
  bordered card labelled by `groupType` ("Bi-serie", "Tri-serie", …); standalone
  entries render as individual cards.
- **Edit** — an "Editar entrenamiento" button links to `/workouts/:id/edit` (see
  below).
- **Copy** — pick a date and `useCopyWorkout()` duplicates the whole session to that
  date, then navigates to the new workout.
- **Delete** — `useDeleteWorkout()` removes it and navigates back to `/history`.

---

## Edit Workout (`/workouts/:id/edit`) — `features/workouts/EditWorkoutPage.tsx`

Edits an existing workout — change its date/name, edit each exercise's sets, and
add/remove exercises.

- Loads the workout with `useWorkout(id)` and the catalog with `useExercises()`, then
  converts each saved entry into the editor's draft shape via `fromEntryDetail`
  (the inverse of `toEntryInput`; collapses a strength entry's uniform sets back into
  a single `UniformLine`).
- Renders the shared **`WorkoutForm`** component (the same form used by New Workout
  above), with the "Guardar cambios" label.
- Saves via `useUpdateWorkout(id)` → `PATCH /workouts/:id`. Because `entries` is
  present, the backend's `replaceWorkout` wipes and recreates all entries/sets. The
  `notes` field is intentionally omitted from the payload so existing notes are
  preserved (the form doesn't edit them). On success it navigates back to
  `/workouts/:id`.
- States mirror the detail page: "Cargando…" while loading, "No encontrado." if the
  workout is missing. An entry whose exercise was deactivated/removed from the catalog
  still loads (falls back to a placeholder name).

> **Shared form:** both New Workout and Edit Workout render `WorkoutForm`, which owns
> the date/name/entries draft state, the "Agregar ejercicio" picker, and the
> draft→API mapping (`toEntryInput`). Saving an empty workout (zero entries) is
> disabled in both, consistent with create.

---

## Progress (`/progress`) — `features/progress/ProgressPage.tsx`

Per-exercise progress visualization with Recharts.

- **Preview grid** — `useProgressSummary()` (`GET /progress/summary`) returns one
  lightweight sparkline series per exercise with data; the page renders them as a grid
  of `SparklineCard`s (axis-less mini `AreaChart` + headline number). Clicking a card
  selects that exercise. kg headline values are rounded to one decimal server-side.
- Pick an exercise via a card or the `<Select>` (`useExercises()`);
  `useProgress(exerciseId)` fetches the full time series for the detail chart (only
  once an exercise is chosen).
- **Metric selection** (matches the API's returned fields):
  - **cardio** → minutes (`maxDurationSeconds / 60`).
  - **strength where every point has `bestTotalLoadKg == null`** (bodyweight) →
    `topReps`.
  - **otherwise** → `bestTotalLoadKg` (kg).
    The y-axis unit label (`kg` / `reps` / `min`) follows the same logic.
- Renders three stat tiles — **Actual** (latest value), **Mejor marca** (peak), and
  **Sesiones** (number of points) — above an amber gradient `AreaChart`.
- States: the preview grid (or an "Aún no hay datos" empty state when nothing is
  logged); a pulsing skeleton while a selected exercise's detail loads; "Sin datos
  todavía." when the chosen exercise has no recorded sessions.

See [Domain Concepts: progress metrics](../reference/domain-concepts.md#progress-metrics)
for how the metrics are computed server-side.

---

## Exercises Admin (`/exercises`) — `features/exercises/ExercisesAdminPage.tsx`

The catalog manager (nav link is admin-only; writes are admin-enforced by the API).

- Calls `useExercises(true)` → `includeInactive=true`, so admins see inactive
  exercises too (shown dimmed with an "inactivo" label).
- **Create** form (sticky on desktop): name + type (`strength`/`cardio`/`mobility`)
  → `useCreateExercise()`.
- **Deactivate**: the `X` button on an active exercise calls `useDeleteExercise()`
  (which soft-deletes via the API — sets `isActive=false`).
- Each row has a type chip styled per type (`TYPE_META` → primary / chart-2 /
  chart-5 colors).

---

## Cross-cutting UI behaviors

- **Loading**: skeleton cards (history, exercises), pulsing chart placeholder
  (progress), spinner (auth gate), and "Cargando…" text (workout detail).
- **Empty states**: dashed-border panels with an icon and helper text.
- **Entrance animation**: pages use the `.animate-rise` class for a subtle staggered
  fade/slide-in (respects `prefers-reduced-motion`). See
  [Design System](./design-system.md).
