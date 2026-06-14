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
- `entries: DraftEntry[]` — added by picking from the exercise `Select`.
- **Inline exercise creation (admin only):** when `useMe().data?.role === "admin"`,
  a "Crear ejercicio" button appears under the picker and opens `CreateExerciseDialog`
  (a vendored Radix `Dialog`). On success the exercise is created via
  `useCreateExercise` and appended to the current draft immediately (from the returned
  object, no refetch wait). Non-admins don't see the button; `POST /exercises` is also
  `requireAdmin` server-side, so the gating is enforced, not just hidden.

### Draft model & the hybrid set entry

Each `DraftEntry` (`features/workouts/EntryEditor.tsx`) adapts to the exercise's
`type`:

- **strength** — a single **`UniformLine`**: `count`, `reps`, `weight`,
  `weightUnit`, `loadType`, `barWeight`. You describe the sets _once_ (e.g. 3 series
  × 10 reps @ 60kg total) instead of typing each row.
- **cardio** — `durationMinutes` and `distance` (+ `distanceUnit`, default "km").
- **mobility** — just a comment.

On save, `toEntryInput(draft)` converts each draft to the API `EntryInput`:

- strength → `uniformToSets(line)` expands the uniform line into N identical
  `SetInput` rows (`features/workouts/sets.ts`; clamped to **1–20** sets).
- cardio → `durationSeconds = durationMinutes × 60`, plus `distance`/`distanceUnit`,
  with `sets: []`.
- mobility → just the comment, `sets: []`.

The `EntryEditor` form conditionally renders fields:

- `weight` is disabled when `loadType === "bodyweight"`.
- the "Peso de la barra" (bar weight) field only appears for `loadType === "per_side"`.

Saving calls `useCreateWorkout().mutateAsync({...})` and navigates to the new
workout's detail page. The save button is disabled with no entries or while pending.

---

## History (`/history`) — `features/history/HistoryPage.tsx`

A responsive grid of workout cards from `useWorkouts()` (`GET /workouts`, newest
first). Each card links to `/workouts/:id` and shows the name (or "Entrenamiento"),
the pretty-printed date, and the exercise count (`entryCount`).

States: a skeleton grid while loading; an empty-state panel when there are no
workouts.

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
