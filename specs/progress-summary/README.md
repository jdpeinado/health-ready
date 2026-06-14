# Progress Summary — Mini Preview Charts — Spec

**Date:** 2026-06-14
**Status:** Implemented (2026-06-14)

## Purpose

The Progress page (`apps/web/src/features/progress/ProgressPage.tsx`) currently
shows **one** exercise at a time: pick an exercise from a `<Select>`, see one large
`AreaChart`. To compare or scan your training you have to open each exercise
individually.

This feature adds a **grid of small sparkline preview charts** — one per exercise
that has logged data — shown above the detail area. Clicking a preview (or using the
existing dropdown) selects that exercise and renders the current large, detailed
chart below.

## The core decision: one batched endpoint

Today progress is fetched **one exercise at a time** via
`GET /progress/exercises/:id` (`useProgress(exerciseId)`). Rendering N previews by
calling that hook N times would mean N HTTP round-trips on page load — wasteful and
slow as the catalog grows.

**Chosen approach:** add a single batched endpoint
**`GET /progress/summary`** that returns a lightweight sparkline series for every
exercise the user has data for, in one call. The detail view keeps using the existing
per-exercise endpoint (full points) only for the currently-selected exercise.

## API contract

```
GET /progress/summary   (requireAuth)   → 200 ProgressSummary
```

```ts
type SparklinePoint = {
  date: string; // YYYY-MM-DD, ascending
  value: number; // the headline metric for the exercise's type (see below)
};

type ProgressSummaryItem = {
  exerciseId: string;
  name: string; // denormalized so the grid needs no second lookup
  type: "strength" | "cardio" | "mobility";
  unit: "kg" | "reps" | "min"; // what `value` represents
  points: SparklinePoint[]; // ascending by date; only exercises with ≥1 point appear
  latest: number; // last point's value (for the card's headline number)
  peak: number; // max value across points
};

type ProgressSummary = {
  items: ProgressSummaryItem[]; // sorted by most-recently-trained first
};
```

### How `value` / `unit` is chosen per exercise

This mirrors the existing `ProgressPage` logic so previews and the detail chart agree:

- **cardio** → `unit: "min"`, `value = round(maxDurationSeconds / 60)`.
- **strength with any load** → `unit: "kg"`, `value = roundKg(bestTotalLoadKg)`.
- **strength, all bodyweight (load always null)** → `unit: "reps"`, `value = topReps`.
- **mobility** → no meaningful series; **excluded** from `items` (nothing to chart).

`roundKg` rounding (one decimal) is applied **server-side** here so the payload is
already display-ready and small. (The existing per-exercise endpoint stays raw; the
detail view rounds client-side via the `roundKg` helper added in the decimals fix.)

### Why a dedicated shape rather than reusing `ExerciseProgress`

`ExerciseProgress` carries five metrics per point (load, volume, reps, duration,
distance). A sparkline needs exactly one. Returning the full shape for every exercise
would bloat the payload for no benefit. The summary collapses each point to a single
`{ date, value }`.

## Backend design

**New service:** `getProgressSummary(db, userId): Promise<ProgressSummary>` in
`apps/api/src/services/progress.ts` (next to `getExerciseProgress`).

- Load the user's exercises **that have at least one entry** (join `workout_entries`
  → `workouts` filtered by `userId`), plus their `type` and `name`.
- Reuse the **same aggregation** as `getExerciseProgress` — extract the
  per-workout accumulation loop into a shared helper so both endpoints stay
  consistent and we don't duplicate the load/reps/duration logic.
- Collapse each workout point to the single headline `value` per the rules above,
  apply `roundKg` for kg series, compute `latest`/`peak`, drop mobility and
  empty-series exercises, and sort items by most-recent activity.

**Performance:** one pass over the user's sets/entries (same data
`getExerciseProgress` already reads, just not filtered to a single exercise). Bounded
by the user's own logged volume — fine for a personal tracker.

**New route:** `GET /progress/summary` in `apps/api/src/routes/progress.ts`, behind
the existing `requireAuth`. Register it **before** `/exercises/:id` is irrelevant
(different path), but keep it above the param route for clarity.

## Frontend design

**New hook:** `useProgressSummary()` in
`apps/web/src/features/progress/useProgress.ts` — `useQuery(["progress-summary"], …)`.

**New component:** `SparklineCard` (small `AreaChart`, no axes / grid / tooltip; just
the amber line + fill, the exercise name, and the `latest`/`peak` headline). Reuse the
existing `AMBER` color and gradient styling so previews match the detail chart.

**`ProgressPage` changes:**

- Fetch `useProgressSummary()`. Render a responsive grid of `SparklineCard`s (e.g.
  `grid-cols-2 sm:grid-cols-3`), each `onClick` → `setExerciseId(item.exerciseId)`.
- Keep the existing `<Select>` as an alternate selector (handy when there are many
  exercises). Highlight the selected card.
- When an exercise is selected, render the existing large `AreaChart` + `StatTile`s
  below the grid, driven by `useProgress(exerciseId)` as today.
- The empty state ("Elige un ejercicio") shows when nothing is selected **and** there
  are no previews; if previews exist, they ARE the call to action.

## Data flow

```
ProgressPage
  useProgressSummary()  ── GET /progress/summary ──▶ ProgressSummaryItem[]
        │
        ▼
  grid of SparklineCard  ──click──▶ setExerciseId(id)
        │
        ▼
  useProgress(id)  ── GET /progress/exercises/:id ──▶ full points
        │
        ▼
  large AreaChart + StatTiles  (existing, unchanged except roundKg already applied)
```

## Testing

- **API service:** `getProgressSummary` — excludes mobility and exercises with no
  data; picks `kg` vs `reps` headline correctly (loaded vs all-bodyweight strength);
  cardio → minutes; `latest`/`peak` correct; scoped to the requesting user; kg values
  rounded to one decimal. Add to a new `apps/api/test/progress.summary.test.ts`
  (mirror the structure of the existing `progress.service.test.ts`).
- **API route:** `GET /progress/summary` — 401 without auth; 200 with the user's
  items; another user's data not leaked. Add to `apps/api/test/progress.routes.test.ts`.
- **Web:** keep tests network-free. A small unit test for any pure "pick headline
  metric" helper if one is extracted client-side; otherwise rely on the API tests
  (the page itself is thin glue).
- Guard indexed access (`noUncheckedIndexedAccess`).

## Out of scope (YAGNI)

- Date-range filtering / zoom on previews.
- Caching beyond TanStack Query defaults.
- Showing mobility exercises (no meaningful single metric).
- Reordering / favoriting previews.

## Files touched

| File                                                       | Change                                  |
| ---------------------------------------------------------- | --------------------------------------- |
| `apps/api/src/services/progress.ts`                        | extract shared aggregation; add `getProgressSummary` |
| `apps/api/src/routes/progress.ts`                          | add `GET /progress/summary`             |
| `apps/web/src/api/types.ts`                                | add `ProgressSummary` types             |
| `apps/web/src/features/progress/useProgress.ts`            | add `useProgressSummary`                |
| `apps/web/src/features/progress/SparklineCard.tsx`         | **new** — preview card                  |
| `apps/web/src/features/progress/ProgressPage.tsx`          | render preview grid + keep detail view  |
| `apps/api/test/progress.summary.test.ts`                   | **new** — service tests                 |
| `apps/api/test/progress.routes.test.ts`                    | add summary route tests                 |

## Docs to update after implementation

- `docs/web/features.md` — Progress page now has preview sparklines.
- `docs/api/endpoints.md` — document `GET /progress/summary`.
