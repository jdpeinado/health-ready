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

The primary logging screen. Local component state holds a **draft** workout:

- `date` (defaults to today via `todayIso()`), optional `name`.
- `entries: DraftEntry[]` — added by picking from the exercise `Select`.

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
- **Copy** — pick a date and `useCopyWorkout()` duplicates the whole session to that
  date, then navigates to the new workout.
- **Delete** — `useDeleteWorkout()` removes it and navigates back to `/history`.

> Note: although the API supports editing (`PATCH /workouts/:id` and
> `useUpdateWorkout`), this page exposes copy + delete; full in-place editing of an
> existing workout is not wired into the detail UI.

---

## Progress (`/progress`) — `features/progress/ProgressPage.tsx`

Per-exercise progress visualization with Recharts.

- Pick an exercise (`useExercises()`); `useProgress(exerciseId)` fetches the time
  series (only once an exercise is chosen).
- **Metric selection** (matches the API's returned fields):
  - **cardio** → minutes (`maxDurationSeconds / 60`).
  - **strength where every point has `bestTotalLoadKg == null`** (bodyweight) →
    `topReps`.
  - **otherwise** → `bestTotalLoadKg` (kg).
    The y-axis unit label (`kg` / `reps` / `min`) follows the same logic.
- Renders three stat tiles — **Actual** (latest value), **Mejor marca** (peak), and
  **Sesiones** (number of points) — above an amber gradient `AreaChart`.
- States: prompt to choose an exercise; a pulsing skeleton while loading; "Sin datos
  todavía." when the exercise has no recorded sessions.

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
