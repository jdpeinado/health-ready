# Endpoint Reference

Complete reference for every API route. Paths are shown at the **root** (as in
`src/index.ts` and tests). In production prepend **`/api`** (e.g.
`POST /api/auth/login`); the web client does this via `VITE_API_URL`.

Conventions:

- **Auth** column: `public` = none; `auth` = `requireAuth`; `admin` = `requireAuth` +
  `requireAdmin`; `secret` = bootstrap secret.
- Request bodies are validated with Zod schemas from `@health-ready/shared`
  ([details](../shared/README.md)).

---

## Health

### `GET /health`

**Auth:** public
Returns `{ "ok": true }`. Liveness check.

---

## Auth (`/auth`)

### `POST /auth/bootstrap-admin`

**Auth:** secret · **Body:** `bootstrapAdminSchema`

```json
{
  "secret": "…",
  "email": "you@example.com",
  "password": "min8chars",
  "displayName": "You"
}
```

Creates the first admin. Returns `201 { "ok": true }`.

- `403 { "error": "forbidden" }` if `secret` ≠ `BOOTSTRAP_SECRET`.
- `409 { "error": "admin already exists" }` if any admin already exists.

### `POST /auth/login`

**Auth:** public · **Body:** `loginSchema` `{ email, password }`

On success: sets the `session` cookie and returns the public user:

```json
{ "id": "…", "email": "…", "displayName": "…", "role": "user" }
```

- `401 { "error": "invalid credentials" }` for wrong email **or** password.

### `POST /auth/logout`

**Auth:** public (acts on the cookie) · **Body:** none

Revokes the session (if any) and clears the cookie. Returns `{ "ok": true }`.

### `GET /auth/me`

**Auth:** auth

Returns the current user `{ id, email, displayName, role }`, or `401` if not logged
in. The web app treats `401` here as "logged out".

---

## Exercises (`/exercises`)

All routes require auth. Writes additionally require admin.

### `GET /exercises`

**Auth:** auth · **Query:** `includeInactive=true` (admins only)

Returns an array of exercises. By default only **active** exercises. If the caller is
an admin **and** `includeInactive=true`, inactive ones are included too (non-admins
silently get the active-only list regardless of the query param).

Each exercise:

```json
{
  "id": "…",
  "name": "…",
  "type": "strength",
  "muscleGroup": null,
  "isActive": true,
  "createdAt": 1718000000000
}
```

### `POST /exercises`

**Auth:** admin · **Body:** `createExerciseSchema`

```json
{ "name": "Press de banca", "type": "strength", "muscleGroup": "chest" }
```

`muscleGroup` is optional. Returns `201` with the created exercise.

### `PATCH /exercises/:id`

**Auth:** admin · **Body:** `updateExerciseSchema` (all fields optional)

```json
{ "name": "…", "type": "cardio", "muscleGroup": null, "isActive": false }
```

Applies only the provided fields. Returns the updated exercise, or
`404 { "error": "not found" }`.

### `DELETE /exercises/:id`

**Auth:** admin

**Soft delete** — sets `isActive = false` (does not remove the row). Returns
`{ "ok": true }`, or `404` if the exercise doesn't exist.

---

## Workouts (`/workouts`)

All routes require auth and are **scoped to the caller's user id**.

### `GET /workouts`

**Auth:** auth · **Query:** `from`, `to` (ISO dates), `q` (name search)

Returns workout **summaries** (no entries), newest first (`date` desc, then
`createdAt` desc). Filters:

- `from` / `to` → inclusive date range (`date >= from`, `date <= to`).
- `q` → `LIKE %q%` on the workout `name`.

```json
[
  {
    "id": "…",
    "date": "2026-06-14",
    "name": "Pull day",
    "notes": null,
    "createdAt": 1718000000000,
    "entryCount": 5
  }
]
```

### `GET /workouts/:id`

**Auth:** auth

Returns the full workout **detail** (summary + nested `entries` + `sets`), ordered by
`order_index` / `set_index`. `404` if missing or not owned by the caller.

```json
{
  "id": "…",
  "date": "2026-06-14",
  "name": "Pull day",
  "notes": null,
  "createdAt": 1718000000000,
  "entryCount": 1,
  "entries": [
    {
      "id": "…",
      "exerciseId": "…",
      "orderIndex": 0,
      "comment": null,
      "durationSeconds": null,
      "distance": null,
      "distanceUnit": null,
      "sets": [
        {
          "id": "…",
          "setIndex": 0,
          "reps": 10,
          "weight": 60,
          "weightUnit": "kg",
          "loadType": "total",
          "barWeight": null
        }
      ]
    }
  ]
}
```

### `POST /workouts`

**Auth:** auth · **Body:** `createWorkoutSchema`

```json
{
  "date": "2026-06-14",
  "name": "Pull day",
  "notes": null,
  "entries": [
    {
      "exerciseId": "…",
      "comment": null,
      "durationSeconds": null,
      "distance": null,
      "distanceUnit": null,
      "sets": [
        {
          "reps": 10,
          "weight": 60,
          "weightUnit": "kg",
          "loadType": "total",
          "barWeight": null
        }
      ]
    }
  ]
}
```

Validates that every `exerciseId` exists (`400 { "error":"unknown exerciseId",
"missing":[…] }` otherwise), inserts workout + entries + sets in a `batch`, and
returns `201` with the full detail.

### `PATCH /workouts/:id`

**Auth:** auth · **Body:** `updateWorkoutSchema`

Partial update of `date` / `name` / `notes`. If `entries` is **present**, it
**replaces all** entries (and their sets) wholesale — see
[Services: replaceWorkout](./services.md#replaceworkout). Same `exerciseId`
validation as create. Returns the updated detail, or `404`.

### `DELETE /workouts/:id`

**Auth:** auth

Deletes the workout (cascades to entries and sets). Returns `{ "ok": true }`, or
`404`.

### `POST /workouts/:id/copy`

**Auth:** auth · **Body:** `copyWorkoutSchema` `{ "date": "YYYY-MM-DD" }`

Deep-copies an existing workout (name, notes, entries, sets) into a **new** workout on
the given date. Returns `201` with the new workout's detail, or `404` if the source
doesn't exist / isn't owned by the caller.

---

## Users (`/users`)

### `POST /users`

**Auth:** admin · **Body:** `createUserSchema`

```json
{
  "email": "friend@example.com",
  "password": "min8chars",
  "displayName": "Friend",
  "role": "user"
}
```

`role` defaults to `user`. Creates a user (password hashed) and returns
`201 { id, email, displayName, role }`.

- `409 { "error": "email already exists" }` if the email is taken.

> There is no "list users", "update user", or "delete user" endpoint — user
> management is intentionally minimal (create-only via admin).

---

## Progress (`/progress`)

### `GET /progress/exercises/:id`

**Auth:** auth

Returns a per-exercise progress time series for the **caller's** workouts. One point
per workout that includes the exercise, oldest first. See
[Services: progress](./services.md#progress-aggregation) and
[Domain Concepts](../reference/domain-concepts.md#progress-metrics) for how each
metric is computed.

```json
{
  "exerciseId": "…",
  "type": "strength",
  "points": [
    {
      "date": "2026-06-01",
      "workoutId": "…",
      "bestTotalLoadKg": 80,
      "totalVolumeKg": 2400,
      "topReps": 10,
      "maxDurationSeconds": null,
      "totalDistance": null
    }
  ]
}
```

`404 { "error": "not found" }` if the exercise id doesn't exist. If the exercise
exists but the user has never done it, `points` is an empty array.
