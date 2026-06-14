# Routing & State

## Routing (`app/router.tsx`)

The app uses React Router's `createBrowserRouter`. The route tree nests two layout
layers around the pages:

```
/login                      → LoginPage            (public)
<Protected>                 → auth gate
  <Layout>                  → app shell (nav)
    /                       → NewWorkoutPage        ("Hoy")
    /history                → HistoryPage
    /workouts/:id           → WorkoutDetailPage
    /workouts/:id/edit      → EditWorkoutPage
    /progress               → ProgressPage
    /exercises              → ExercisesAdminPage    (admin-only nav item)
```

- `/login` is **outside** `Protected`, so it's reachable when logged out.
- Everything else sits inside `<Protected>` (auth gate) and then `<Layout>` (the
  visual shell with navigation). Pages render into `<Layout>`'s `<Outlet />`.

## The auth gate (`app/Protected.tsx`)

```tsx
const me = useMe();
if (me.isLoading) return <Spinner />;
if (!me.data) return <Navigate to="/login" replace />;
return <Outlet />;
```

- While the `me` query is loading, it shows a centered spinner.
- If there is no user (`me.data` is `null` — i.e. a `401`), it redirects to `/login`.
- Otherwise it renders the protected subtree.

> `/exercises` is reachable by URL for any authenticated user, but the API enforces
> admin for all writes, and the nav link is hidden for non-admins (`adminOnly` in
> `Layout`). The list endpoint itself is readable by any authed user.

## The app shell (`app/Layout.tsx`)

Responsive shell with three navigation surfaces:

- **Desktop** — a fixed left sidebar (`md:` and up) with the brand, nav links, and a
  user card (initials avatar, name, email, logout button).
- **Mobile** — a sticky top bar (brand + logout) and a fixed bottom tab bar.

Nav items are data-driven (`NAV` array). The "Ejercicios" item has `adminOnly: true`
and is filtered out unless `me.data?.role === "admin"`. Active-link styling uses
`NavLink`'s `isActive`.

## Server state — TanStack Query

All server data flows through TanStack Query. There's no Redux/Zustand; component
`useState` covers local form state only.

### The API client (`api/client.ts`)

A tiny wrapper around `fetch`:

```ts
export async function api<T>(path, init = {}) {
  const res = await fetch(`${baseUrl()}${path}`, {
    credentials: "include", // send the session cookie
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
    ...init,
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export function apiJson<T>(path, method, data) {
  return api<T>(path, { method, body: JSON.stringify(data) });
}
```

Key points:

- `credentials: "include"` on **every** request → the `httpOnly` session cookie is
  sent/accepted (essential for auth).
- `baseUrl()` is `VITE_API_URL` (`/api` in prod, `:8787/api` in dev).
- Non-2xx responses throw an `ApiError` carrying `status` and parsed `body`, which
  callers can inspect (e.g. the login page distinguishes `401`).

### Query / mutation hooks per feature

| Hook                             | File                                       | Query key                                     | Endpoint                                                   |
| -------------------------------- | ------------------------------------------ | --------------------------------------------- | ---------------------------------------------------------- |
| `useMe`                          | `auth/useAuth.ts`                          | `["me"]`                                      | `GET /auth/me` (401 → `null`)                              |
| `useLogin`                       | `auth/useAuth.ts`                          | sets `["me"]`                                 | `POST /auth/login`                                         |
| `useLogout`                      | `auth/useAuth.ts`                          | clears `["me"]`                               | `POST /auth/logout`                                        |
| `useExercises(includeInactive?)` | `features/exercises/useExercises.ts`       | `["exercises", includeInactive]`              | `GET /exercises`                                           |
| `useCreateExercise`              | same                                       | invalidates `["exercises"]`                   | `POST /exercises`                                          |
| `useUpdateExercise`              | same                                       | invalidates `["exercises"]`                   | `PATCH /exercises/:id`                                     |
| `useDeleteExercise`              | same                                       | invalidates `["exercises"]`                   | `DELETE /exercises/:id`                                    |
| `useWorkouts`                    | `features/history/useWorkouts.ts`          | `["workouts"]`                                | `GET /workouts`                                            |
| `useWorkout(id)`                 | same                                       | `["workout", id]`                             | `GET /workouts/:id`                                        |
| `useCreateWorkout`               | `features/workouts/useWorkoutMutations.ts` | invalidates `["workouts"]`                    | `POST /workouts`                                           |
| `useUpdateWorkout(id)`           | same                                       | invalidates `["workouts"]`, `["workout", id]` | `PATCH /workouts/:id` (used by `EditWorkoutPage`)          |
| `useCopyWorkout`                 | same                                       | invalidates `["workouts"]`                    | `POST /workouts/:id/copy`                                  |
| `useDeleteWorkout`               | same                                       | invalidates `["workouts"]`                    | `DELETE /workouts/:id`                                     |
| `useProgress(exerciseId)`        | `features/progress/useProgress.ts`         | `["progress", exerciseId]`                    | `GET /progress/exercises/:id` (`enabled` only when id set) |

### Patterns

- **Auth as a query.** `useMe` has `staleTime: 60_000` and treats a `401` as a
  successful "logged out" (`null`) rather than an error, so the UI never error-flashes
  for logged-out users. `useLogin`/`useLogout` write `["me"]` directly via
  `setQueryData` for instant transitions.
- **Invalidate on mutate.** Mutations call `qc.invalidateQueries` for the lists/items
  they affect, so the UI refetches fresh data after writes.
- **Conditional queries.** `useProgress` uses `enabled: !!exerciseId` so it doesn't
  fire until the user picks an exercise.
- **Optimistic-ish UX.** Pages read `isLoading`/`isPending` to show skeletons,
  spinners, and disabled buttons.

See [Features / Pages](./features.md) for how each page composes these hooks.
