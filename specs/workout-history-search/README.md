# Workout History — Search & Date Range — Spec

**Date:** 2026-06-15
**Status:** Implemented (2026-06-15)

## Purpose

When a user has logged many workouts, the History grid (`/history`) gets long and
hard to scan. Two filters fix this:

1. **Search by name** — a text input filtering workouts whose `name` matches.
2. **Date range** — a `from` / `to` pair (a range is friendlier than an exact date;
   either bound is optional).

## Key finding: the backend already supports this

`GET /workouts` **already** accepts `q`, `from`, `to` query params end-to-end:

```ts
// routes/workouts.ts
listWorkouts(db, userId, { from: c.req.query("from"), to: c.req.query("to"), q: c.req.query("q") });

// services/workouts.ts — listWorkouts
if (filters.from) conds.push(gte(workouts.date, filters.from)); // date >= from
if (filters.to)   conds.push(lte(workouts.date, filters.to));   // date <= to
if (filters.q)    conds.push(like(workouts.name, `%${filters.q}%`));
```

So no new endpoint and no query-shape changes. The work is: **harden** the existing
params (validation + tests) and **surface** them in the History UI.

## Scope

### 1. Backend hardening (`apps/api`)

- **Validate the query params.** Add a shared schema and apply it on the list route so
  bad input is rejected (or coerced) rather than silently passed to SQL.

  ```ts
  // packages/shared/src/schemas/workout.ts
  export const listWorkoutsQuerySchema = z.object({
    q: z.string().trim().min(1).max(100).optional(),
    from: isoDate.optional(),
    to: isoDate.optional(),
  });
  export type ListWorkoutsQuery = z.infer<typeof listWorkoutsQuerySchema>;
  ```

  Apply with `zValidator("query", listWorkoutsQuerySchema)` in `routes/workouts.ts`
  and pass `c.req.valid("query")` to `listWorkouts`. An empty/whitespace `q` becomes
  "no filter" (validation strips it via `.trim().min(1)` → omit when blank; the client
  simply won't send a blank `q`). Malformed `from`/`to` → `400`.

- **Tests** (`apps/api/test/workouts.routes.test.ts`, and/or
  `workouts.service.test.ts`). Seed a few workouts with distinct names/dates, then:
  - `?q=` substring match returns only matching named workouts.
  - `?from=` / `?to=` / both bound the date range inclusively.
  - `q` + range combine (AND).
  - No params → unchanged (all of the user's workouts, newest first).
  - Filters never leak across users (scope by `userId`).
  - Malformed `from` → `400`.

### 2. Web (`apps/web`)

- **`useWorkouts(filters?)`** (`features/history/useWorkouts.ts`) takes
  `{ q?: string; from?: string; to?: string }`, builds a query string (omitting blank
  values), and **includes the filters in the query key** so each filter combo caches
  independently:

  ```ts
  useQuery({ queryKey: ["workouts", filters], queryFn: () => api(`/workouts${qs}`) });
  ```

- **`HistoryPage`** gains a filter bar above the grid:
  - a search `Input` (lucide `Search` icon), **debounced ~300 ms** so typing doesn't
    fire a request per keystroke;
  - two `type="date"` inputs labelled **Desde** / **Hasta** (`from` / `to`);
  - a "Limpiar" affordance to reset filters when any are active.
- **Empty states** — distinguish "you have no workouts at all" (existing copy) from
  "no workouts match these filters" (new copy, e.g. "Ningún entrenamiento coincide con
  los filtros."). The skeleton still shows while a filtered query loads.

## Decisions / edge cases

- **Unnamed workouts and search.** `like(workouts.name, …)` matches on `name` only, so
  workouts saved without a name (rendered as "Entrenamiento") **won't** appear in a
  text search. This is acceptable: searching by name implies the user named it. We will
  **not** coalesce the placeholder server-side. (Documented, not a bug.)
- **Accents / case.** SQLite `LIKE` is case-insensitive for ASCII only; accented
  characters (`é`, `ñ`) match case-sensitively. Acceptable for v1; a normalized search
  column is out of scope.
- **Date range semantics.** Inclusive on both ends (`>= from`, `<= to`), comparing the
  `YYYY-MM-DD` string lexicographically — valid because the format sorts chronologically.

## Out of scope (YAGNI)

- Server-side pagination / infinite scroll (the list is still small; filters suffice).
- Full-text search, fuzzy matching, accent-insensitive search.
- Filtering by exercise contained in the workout, by muscle group, or by notes.
- Saved/!persisted filter state across navigation.

## Files touched

| File                                                  | Change                                            |
| ----------------------------------------------------- | ------------------------------------------------- |
| `packages/shared/src/schemas/workout.ts`              | add `listWorkoutsQuerySchema`                     |
| `apps/api/src/routes/workouts.ts`                     | validate query with the schema                    |
| `apps/api/test/workouts.routes.test.ts`               | filter tests (q / from / to / combine / scope / 400) |
| `apps/web/src/features/history/useWorkouts.ts`        | `useWorkouts(filters)` + query string + key       |
| `apps/web/src/features/history/HistoryPage.tsx`       | filter bar (search + date range), filtered empty state |
| `apps/web/src/features/history/HistoryPage.test.tsx`  | **new** — debounced search + range wire-through    |

## Docs to update after implementation

- `docs/api/endpoints.md` — document the `q` / `from` / `to` query params on
  `GET /workouts` (validated).
- `docs/web/features.md` — History section: search + date-range filter bar.
