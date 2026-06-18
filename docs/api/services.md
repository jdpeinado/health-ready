# Services — Business Logic

Routes are thin; the real logic lives in `apps/api/src/services/`. Two service
modules:

- `services/workouts.ts` — workout CRUD, copy, list, exercise-id validation.
- `services/progress.ts` — per-exercise progress aggregation.

Both receive a Drizzle `Db` instance and the authenticated `userId`, and all queries
are **scoped to that user**.

---

## Workouts service (`services/workouts.ts`)

### Shared insert builder — `buildInserts`

`buildInserts(workoutId, userId, input)` turns a validated `CreateWorkoutInput` into
three row sets: the `workoutRow`, an array of `entryRows`, and an array of `setRows`.

- Each entry gets a fresh UUID and an `orderIndex` equal to its array position.
- Each set gets a fresh UUID and a `setIndex` equal to its array position within the
  entry.
- Optional fields are coalesced to `null` (`?? null`) — including `groupId` /
  `groupType`, which carry bi/tri-series grouping (see
  [data model](../architecture/data-model.md#workout_entries)).

This builder is reused by both `createWorkout` and `replaceWorkout`, so create and
replace produce identical row structures.

> **D1 parameter limit:** D1 caps a statement at ~100 bound parameters. `sets` has 8
> columns and `workout_entries` has 10, so the multi-row inserts are chunked —
> `INSERT_CHUNK` = 10 rows for sets (80 params), `ENTRY_INSERT_CHUNK` = 8 rows for
> entries (80 params).

### `validateExerciseIds(db, ids) → string[]`

De-dupes the supplied ids, queries which exist, and returns the **missing** ones.
Routes use this to reject `400 unknown exerciseId` before writing. An empty input
returns `[]` (nothing missing).

### `createWorkout(db, userId, input) → workoutId`

Generates a workout UUID, builds the rows, and writes them in a single
`db.batch([...])` (workout insert, then entries, then sets — the latter two only if
non-empty). Returns the new id. The route then re-reads with `getWorkout` to return
full detail.

### `getWorkout(db, userId, workoutId) → WorkoutDetail | null`

1. Fetch the workout, filtered by **both** id and `userId` (ownership). `null` if not
   found → route returns `404`.
2. Fetch its entries ordered by `orderIndex`.
3. Fetch all sets for those entries (`inArray`) ordered by `setIndex`, then group
   them by `entryId` in a `Map`.
4. Assemble the nested `WorkoutDetail` (summary fields + `entries[]` each with
   `sets[]`). `createdAt` is converted to epoch millis; `entryCount` is the number of
   entries.

### `listWorkouts(db, userId, filters) → WorkoutSummary[]`

Builds a `where` from `userId` plus optional `from` (`date >=`), `to` (`date <=`), and
`q` (`name LIKE %q%`). Orders by `date desc, createdAt desc`. Then it computes
`entryCount` per workout with a **second** query (count of entries grouped in
application code via a `Map`) rather than a SQL aggregate. Returns summaries (no
nested entries).

### `replaceWorkout`

`replaceWorkout(db, userId, workoutId, input) → boolean`

The update path for `PATCH /workouts/:id`:

1. Verify the workout exists and is owned by the user; `false` (→ `404`) otherwise.
2. Build a partial `patch` of whichever of `date` / `name` / `notes` were provided.
3. **If `input.entries` is present**, it is a **full replacement**:
   - delete **all** existing `workout_entries` for the workout (cascades to sets),
   - rebuild entries + sets via `buildInserts` and insert them.
4. Apply everything in one `db.batch([...])`.

> **Important semantic:** there is no per-entry diffing. Sending `entries` wipes and
> recreates the entire set of entries/sets. Omitting `entries` leaves them untouched
> and only patches workout metadata. (A throwaway `date` of `"2000-01-01"` is passed
> into `buildInserts` purely to satisfy the type when only entries are being
> rebuilt; it is never written because the workout row isn't re-inserted.)

### `deleteWorkout(db, userId, workoutId) → boolean`

Ownership check, then `delete` the workout row — cascades remove its entries and sets.
`false` (→ `404`) if not found/owned.

### `copyWorkout(db, userId, sourceId, newDate) → newId | null`

Reads the source via `getWorkout` (so it's ownership-checked), then calls
`createWorkout` with a deep copy of name, notes, entries, and sets, but with the new
`date`. New UUIDs are minted for everything. Each source `group_id` is mapped to a
fresh UUID (so the copy keeps its bi/tri-series grouping but owns its own ids).
Returns the new id, or `null` (→ `404`) if the source is missing.

### Returned types

`services/workouts.ts` defines `SetDetail`, `EntryDetail`, `WorkoutSummary`, and
`WorkoutDetail` (= summary + `entries`). These mirror the web client's
`apps/web/src/api/types.ts`.

---

## Progress aggregation (`services/progress.ts`)

### `getExerciseProgress(db, userId, exerciseId) → ExerciseProgress | null`

Produces a time series of **one point per workout** in which the user performed the
exercise. Steps:

1. **Look up the exercise** (id + `type`). `null` if it doesn't exist → route `404`.
2. **Fetch all of the user's entries** for that exercise, joined to their workouts to
   get the `date`, ordered by `date` ascending (oldest first). Also pulls
   `durationSeconds` and `distance` from the entry (cardio).
   - If there are none, return `{ exerciseId, type, points: [] }`.
3. **Fetch all sets** for those entries in one `inArray` query and group them by
   `entryId`.
4. **Accumulate per workout** (a workout may contain the exercise more than once, so
   results are keyed by `workoutId`, preserving first-seen order):
   - `maxDurationSeconds` = max entry duration
   - `totalDistance` = sum of entry distances
   - `topReps` = max `reps` across sets
   - `bestTotalLoadKg` = max canonical load across sets (see below)
   - `totalVolumeKg` = Σ `(load × reps)` across sets
5. Return points in workout order.

### Canonical load

For each set, `bestTotalLoadKg` and `totalVolumeKg` use
`computeTotalLoadKg({ weight, weightUnit, loadType, barWeight })` from
`@health-ready/shared`. That function:

- returns `null` for **bodyweight** sets (their progression is reps, not load) and
  when weight/loadType is unspecified — such sets contribute nothing to load/volume;
- otherwise converts to kg and applies the load convention (per-side doubles + bar,
  per-dumbbell doubles, etc.).

See [Shared / Load calculation](../shared/README.md#load-calculation) and
[Domain Concepts](../reference/domain-concepts.md).

### How the frontend picks a metric

The progress endpoint returns **all** metrics; the
[Progress page](../web/features.md#progress-progress) decides which to chart:

- **cardio** → minutes (from `maxDurationSeconds`)
- **strength with all-null loads** (i.e. bodyweight) → `topReps`
- **otherwise** → `bestTotalLoadKg`
