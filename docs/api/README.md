# API Overview & Conventions

The API is a [Hono](https://hono.dev) app running on a Cloudflare Worker, backed by
D1 (SQLite) through Drizzle ORM. This page covers structure and cross-cutting
conventions; see [Endpoints](./endpoints.md) for the full route reference and
[Services](./services.md) for the business logic.

## Structure

```
apps/api/src/
├── index.ts            API app: CORS + mounts route groups at the ROOT
├── worker.ts           deployed entrypoint: mounts API under /api, serves SPA
├── db/
│   ├── schema.ts       Drizzle table definitions
│   └── client.ts       getDb(d1) → drizzle instance; exports the Db type
├── middleware/
│   └── auth.ts         requireAuth / requireAdmin + AppEnv type
├── lib/
│   ├── password.ts     PBKDF2 hash/verify
│   ├── session.ts      session create/validate/revoke
│   └── encoding.ts     hex + timing-safe compare
├── routes/
│   ├── auth.ts         /auth/*
│   ├── exercises.ts    /exercises/*
│   ├── workouts.ts     /workouts/*
│   ├── users.ts        /users/*
│   └── progress.ts     /progress/*
└── services/
    ├── workouts.ts     workout CRUD, copy, list (business logic)
    └── progress.ts     per-exercise progress aggregation
```

**Routes** are thin: validate input, check auth, call a **service**, shape the
response. Data-access and domain logic live in `services/` and `lib/`.

## Route map

Defined in `src/index.ts` (mounted at the root; in production each is under `/api`):


| Prefix        | File                  | Auth posture                                                     |
| ------------- | --------------------- | ---------------------------------------------------------------- |
| `GET /health` | inline                | public                                                           |
| `/auth`       | `routes/auth.ts`      | mixed (login/logout public, `me` authed, bootstrap secret-gated) |
| `/exercises`  | `routes/exercises.ts` | `requireAuth` for all; `requireAdmin` for writes                 |
| `/workouts`   | `routes/workouts.ts`  | `requireAuth` for all                                            |
| `/users`      | `routes/users.ts`     | `requireAuth` + `requireAdmin` for all                           |
| `/progress`   | `routes/progress.ts`  | `requireAuth` for all                                            |


> **Path-prefix reminder:** these are root paths. The web client targets them under
> `/api` (its `VITE_API_URL` includes `/api`). Tests hit them at the root. See
> [Architecture](../architecture/README.md#two-entrypoints-in-the-api-package).

## CORS

Applied globally in `src/index.ts`:

```ts
app.use("*", cors({ origin: c.env.ALLOWED_ORIGIN, credentials: true }));
```

- `origin` is the `ALLOWED_ORIGIN` env var (`http://localhost:5173` for dev).
- `credentials: true` is required so the browser sends/accepts the session cookie.

CORS matters mainly in `make dev-web` mode, where the Vite dev server (`:5173`) is a
different origin than the API (`:8787`). In production they share an origin.

## Input validation

Request bodies are validated with **Zod** via `@hono/zod-validator`:

```ts
import { zValidator } from "@hono/zod-validator";
import { createWorkoutSchema } from "@health-ready/shared";

workoutRoutes.post("/", zValidator("json", createWorkoutSchema), async (c) => {
  const input = c.req.valid("json"); // typed + validated
  ...
});
```

Schemas come from `@health-ready/shared` so the **same** validation contract is
shared with the web app. A validation failure returns Hono's default `400` with the
Zod error detail. See [Shared Schemas](../shared/README.md).

Beyond schema validation, some routes do **referential** validation — e.g.
`validateExerciseIds` rejects workouts that reference unknown exercise IDs with
`400 {"error":"unknown exerciseId","missing":[...]}`.

## Response & error conventions

- Success responses are JSON. Mutations return the affected resource (often via a
re-read with `getWorkout`) and use `201` on create.
- Errors are JSON objects of the shape `{ "error": "<message>" }`, sometimes with
extra fields (e.g. `missing`).

Common status codes:


| Status | Meaning      | Example                                        |
| ------ | ------------ | ---------------------------------------------- |
| `200`  | OK           | reads, updates, logout                         |
| `201`  | Created      | new workout / exercise / user / admin          |
| `400`  | Bad request  | Zod failure, unknown exerciseId                |
| `401`  | Unauthorized | missing/invalid session                        |
| `403`  | Forbidden    | non-admin on admin route; bad bootstrap secret |
| `404`  | Not found    | resource missing or not owned by the caller    |
| `409`  | Conflict     | email already exists; admin already exists     |


## Serialization rules

- **Timestamps** stored as `Date` (`timestamp_ms`) are serialized to **epoch
millis** for the client. Exercises use a `serialize()` helper
(`createdAt: row.createdAt.getTime()`); workouts do the same in the service layer.
- `**workouts.date`** is already a `"YYYY-MM-DD"` string and is passed through.
- Nullable DB columns surface as `null` in JSON.

## Ownership scoping

Every workout/progress query filters by the authenticated user's id
(`c.get("user").id`). A request for a workout owned by someone else returns `404`,
not `403` — the resource simply "doesn't exist" for that caller.

## Database access

`getDb(c.env.DB)` returns a Drizzle client bound to the D1 database. Multi-statement
writes use `db.batch([...])` so related inserts/deletes are applied together (e.g.
workout + entries + sets). The binding **must** be named `DB` (`c.env.DB`).

Continue to the [Endpoint Reference »](./endpoints.md)