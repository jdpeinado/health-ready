# Data Model

The database is Cloudflare **D1** (SQLite). The schema is defined with Drizzle ORM
in [`apps/api/src/db/schema.ts`](../../apps/api/src/db/schema.ts) and materialized as
SQL in [`apps/api/migrations/0000_bored_sprite.sql`](../../apps/api/migrations/0000_bored_sprite.sql).

## Entity relationships

```
users ──┐
        │ 1                      1 ┌── workouts
        ├──────< sessions          │      │ 1
        │                          │      │
        └──────────────────────────┘      ├──────< workout_entries >────── exercises
              1 (user owns workouts)       │              │ 1                 (catalog)
                                           │              │
                                           │              └──────< sets
                                           │
         legend:  A ──< B   = one A has many B
```

- A **user** has many **sessions** and many **workouts**.
- A **workout** has many **workout_entries** (one per exercise performed).
- A **workout_entry** belongs to one **exercise** (from the shared catalog) and has
  many **sets**.
- **exercises** are a _shared catalog_ (not per-user); admins manage them.

## Tables

### `users`

The account record.

| Column          | Type                             | Notes                                                                  |
| --------------- | -------------------------------- | ---------------------------------------------------------------------- |
| `id`            | text (PK)                        | UUID                                                                   |
| `email`         | text, **unique**, not null       | login identifier                                                       |
| `password_hash` | text, not null                   | `pbkdf2$<iters>$<saltHex>$<hashHex>` (see [Auth](./authentication.md)) |
| `role`          | text, not null, default `user`   | enum `admin` \| `user`                                                 |
| `display_name`  | text, not null                   | shown in UI                                                            |
| `created_at`    | integer (timestamp_ms), not null |                                                                        |

### `sessions`

Opaque, server-side session tokens (only the **hash** is stored).

| Column       | Type                             | Notes                                  |
| ------------ | -------------------------------- | -------------------------------------- |
| `id`         | text (PK)                        | UUID                                   |
| `user_id`    | text, not null                   | FK → `users.id`, **ON DELETE CASCADE** |
| `token_hash` | text, **unique**, not null       | SHA-256 of the cookie token            |
| `expires_at` | integer (timestamp_ms), not null | 30 days from creation                  |
| `created_at` | integer (timestamp_ms), not null |                                        |

Deleting a user cascades to delete their sessions.

### `exercises`

The shared catalog of movements.

| Column         | Type                                        | Notes                                     |
| -------------- | ------------------------------------------- | ----------------------------------------- |
| `id`           | text (PK)                                   | UUID                                      |
| `name`         | text, not null                              | e.g. "Press de banca"                     |
| `type`         | text, not null                              | enum `strength` \| `cardio` \| `mobility` |
| `muscle_group` | text, nullable                              | optional grouping                         |
| `is_active`    | integer (boolean), not null, default `true` | **soft-delete flag**                      |
| `created_at`   | integer (timestamp_ms), not null            |                                           |

> Exercises are never hard-deleted via the API — `DELETE /exercises/:id` flips
> `is_active` to `false`. This preserves referential integrity for historical
> workout entries that reference the exercise.

### `workouts`

A dated training session belonging to a user.

| Column       | Type                             | Notes                                            |
| ------------ | -------------------------------- | ------------------------------------------------ |
| `id`         | text (PK)                        | UUID                                             |
| `user_id`    | text, not null                   | FK → `users.id`, **ON DELETE CASCADE**           |
| `date`       | text, not null                   | ISO date string `"YYYY-MM-DD"` (not a timestamp) |
| `name`       | text, nullable                   | optional label, e.g. "Pull day"                  |
| `notes`      | text, nullable                   | optional free text                               |
| `created_at` | integer (timestamp_ms), not null | insertion time                                   |

> `date` is a **string**, intentionally. This avoids timezone drift — the day you
> trained is a calendar date, not an instant. Sorting and range filters compare
> these strings lexicographically (valid because of the fixed `YYYY-MM-DD` format).

### `workout_entries`

One exercise performed within a workout (a workout can include the same exercise
more than once).

| Column             | Type              | Notes                                      |
| ------------------ | ----------------- | ------------------------------------------ |
| `id`               | text (PK)         | UUID                                       |
| `workout_id`       | text, not null    | FK → `workouts.id`, **ON DELETE CASCADE**  |
| `exercise_id`      | text, not null    | FK → `exercises.id` (**no** cascade)       |
| `order_index`      | integer, not null | display order within the workout (0-based) |
| `comment`          | text, nullable    | per-exercise note                          |
| `duration_seconds` | integer, nullable | cardio: time                               |
| `distance`         | real, nullable    | cardio: distance                           |
| `distance_unit`    | text, nullable    | cardio: e.g. "km"                          |

The cardio fields (`duration_seconds`, `distance`, `distance_unit`) live on the
**entry**, not on sets — cardio entries have no sets.

### `sets`

One set of a strength entry.

| Column        | Type              | Notes                                                                       |
| ------------- | ----------------- | --------------------------------------------------------------------------- |
| `id`          | text (PK)         | UUID                                                                        |
| `entry_id`    | text, not null    | FK → `workout_entries.id`, **ON DELETE CASCADE**                            |
| `set_index`   | integer, not null | order within the entry (0-based)                                            |
| `reps`        | integer, nullable | repetitions                                                                 |
| `weight`      | real, nullable    | the number the user entered                                                 |
| `weight_unit` | text, nullable    | enum `kg` \| `lb`                                                           |
| `load_type`   | text, nullable    | enum: `total`, `per_side`, `per_dumbbell`, `bodyweight`, `bodyweight_added` |
| `bar_weight`  | real, nullable    | only meaningful for `per_side` (barbell)                                    |

The combination of `weight`, `weight_unit`, `load_type`, and `bar_weight` is what the
canonical [load calculation](../reference/domain-concepts.md#load-types) turns into a
single kg value for progress tracking.

## Cascade summary

Deleting a row cascades **downward** through ownership:

- delete a **user** → their **sessions** and **workouts** go
- delete a **workout** → its **workout_entries** go
- delete a **workout_entry** → its **sets** go

The one FK without cascade is `workout_entries.exercise_id → exercises.id`. That is
why exercises are soft-deleted (deactivated) rather than removed — a real delete
would orphan historical entries.

> **Replace semantics:** editing a workout's entries (`PATCH /workouts/:id` with an
> `entries` array) **deletes all existing entries** (cascading to their sets) and
> re-inserts the new set. See [Services](../api/services.md#replaceworkout).

## Timestamps vs. dates

- `created_at` / `expires_at` are stored as **epoch milliseconds** (Drizzle
  `timestamp_ms` mode; `Date` objects in code). When serialized to JSON for the
  client, `created_at` is converted to a number via `.getTime()`.
- `workouts.date` is a **calendar string** `"YYYY-MM-DD"` and is passed through as-is.

## Modifying the schema

1. Edit `apps/api/src/db/schema.ts`.
2. `make migrate-generate` → Drizzle Kit writes a new file under `migrations/`.
3. `make db-migrate-local` (local) and later `make db-migrate` (remote).

See [Database & Migrations](../api/database.md) for details.
