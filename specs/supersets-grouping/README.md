# Bi-series / Tri-series (exercise grouping) — Spec

**Date:** 2026-06-17
**Status:** Implemented (2026-06-18) — plan: [`plans/implementation.md`](plans/implementation.md)

## Problem

The workout model is currently flat:

```
workout → workoutEntries (1 exercise, orderIndex) → sets (reps, weight, …)
```

There is no way to mark that 2-3 exercises form a **bi-series / tri-series** (exercises
performed alternately, with no rest between them). The user wants to group exercises when
building a workout and see them grouped in the history.

## Chosen approach (Option A — group by label)

Exercises keep their own `sets` exactly as today. A **grouping** layer is added via an
identifier shared by the entries that form the series. The "rounds" stay implicit in the set
order (same as Hevy/Strong).

Option B (modeling explicit rounds as an entity) was discarded as over-engineering: it would
force inverting the `sets` model and rewriting the progress endpoint.

### Product decisions

- **Creation in the form:** "container first" — the user creates an empty bi/tri-series block
  and adds exercises into it.
- **Type:** explicit at creation. Values: `biserie`, `triserie`, `superserie`, `circuito`.
  (The number of exercises is not forced to match the name; the type is the label chosen by
  the user, so "circuito" can hold 4+.)

## Data model

**Additive** change to `workout_entries` (does not touch `sets`):

| column | type | meaning |
|---|---|---|
| `group_id` | `text` (nullable) | UUID shared by the entries of the same series. `null` = standalone exercise. |
| `group_type` | `text` enum (nullable) | `biserie` / `triserie` / `superserie` / `circuito`. Only set when grouped. |

- Ordering is still driven by `orderIndex`; entries of a group are **contiguous**.
- `group_type` is stored denormalized on each entry of the group (2-3 rows with the same
  value). Acceptable because entries are always rewritten as a block (`replaceWorkout`
  deletes and reinserts everything), so the inconsistency risk is nil in practice.
- **Discarded alternative (YAGNI):** a separate `workout_groups` table (more normalized, but
  adds a table + joins + delete/reinsert logic for something that is already rewritten whole).

### Migration

Edit `apps/api/src/db/schema.ts` (add the two columns to `workoutEntries`) →
`make migrate-generate` → `make db-migrate-local`. Both columns are nullable, so existing
workouts remain standalone exercises with no data migration needed.

## Validation and shared types (`packages/shared`)

In `entryInputSchema`:

```ts
groupId: z.string().min(1).nullish(),
groupType: z.enum(["biserie","triserie","superserie","circuito"]).nullish(),
```

`.superRefine` on `createWorkoutSchema` and `updateWorkoutSchema`: entries sharing a
`groupId` must (a) be **contiguous** by order, (b) share the same `groupType`, and (c) be
**≥2**. On failure → clear validation error.

## API (services + serialization)

- `buildInserts` (`services/workouts.ts`): propagate `groupId`/`groupType` to `entryRows`.
- `EntryDetail` (in `getWorkout`) gains `groupId` and `groupType` so the frontend receives them.
- `copyWorkout`: when copying, **regenerate the `groupId`s** via an old→new map, so the copied
  workout has its own IDs while keeping the grouping.
- **D1 limit gotcha:** `workout_entries` goes from 8 to 10 columns. The current INSERT chunk is
  10 rows (80 params with 8 columns); with 10 columns that would be 100 params. Lower the
  **entries** chunk to **8 rows** (80 params) with a specific value, leaving the `sets` chunk
  as is.

## Frontend — form (`apps/web/src/features/workouts/WorkoutForm.tsx`)

- The form state changes from a flat list of entries to a list of **blocks**: each block is
  either a standalone exercise or a group `{ groupType, exercises: [...] }`.
- **"Add bi/tri-series"** button → choose type → creates an empty container → add exercises
  inside (reusing the current `ExercisePicker`). Allow pulling an exercise out of the group
  and dissolving the group.
- On submit (POST/PATCH): **flatten** to `entries[]` assigning a global `orderIndex`; each
  entry of a group gets the same `groupId` (UUID generated client-side) and its `groupType`.

## Frontend — display (`WorkoutDetailPage.tsx` / history)

- When rendering, group consecutive entries sharing the same `groupId` inside a card with a
  bracket/label ("Bi-series", "Tri-series", …). Standalone entries render as today.

## Testing

- **API:**
  - Round-trip: create a workout with a group → read → verify `groupId`/`groupType` on the entries.
  - `copyWorkout` regenerates `groupId` (different from the original) while keeping the grouping.
  - Validation rejects a group of 1 entry and mixed types within a `groupId`.
- **Web:**
  - The form creates a group, adds 2 exercises, and on submit produces 2 entries with the same
    `groupId` and `groupType`.

## Out of scope (YAGNI)

- Explicit round tracking (Option B).
- Density/time-per-round metrics.
- Drag & drop reordering of exercises across groups (beyond what already exists).

## Documentation

When implementation is complete, update the project documentation under `docs/`.
