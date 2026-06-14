# Architecture Overview

Health Ready is a **pnpm-workspace monorepo** with three packages and a deliberately
simple deployment topology: one Cloudflare Worker serves everything.

## The three packages

```
┌─────────────────────────────────────────────────────────────┐
│  packages/shared  (@health-ready/shared)                     │
│  Zod schemas + inferred TS types + load math.                │
│  Imported by BOTH api and web.                               │
└───────────────▲───────────────────────────▲─────────────────┘
                │                             │
   ┌────────────┴───────────┐    ┌────────────┴──────────────┐
   │  apps/api              │    │  apps/web                  │
   │  Cloudflare Worker     │    │  Vite + React + TS PWA     │
   │  Hono + D1 (Drizzle)   │    │  Router + TanStack Query   │
   │  Auth                  │    │  shadcn/ui + Recharts      │
   └────────────────────────┘    └────────────────────────────┘
            builds to                     builds to
        the deployed Worker  ◄────────  apps/web/dist
                                        (bundled as the Worker's
                                         ASSETS binding)
```

- **`packages/shared`** — the contract. Validation schemas and the canonical
  load-to-kg function live here so the API and the web client agree on shapes and
  math. See [Shared Schemas](../shared/README.md).
- **`apps/api`** — the Cloudflare Worker. A Hono app + D1 (via Drizzle) + hand-rolled
  cookie auth. See [API Overview](../api/README.md).
- **`apps/web`** — the React PWA. Built to `apps/web/dist`, which the Worker serves.
  See [Web Overview](../web/README.md).

## Two entrypoints in the API package

This is the single most important architectural detail to internalize. The API
package has **two** Hono apps:

### 1. `src/index.ts` — the API app (routes at the root)

```ts
const app = new Hono<AppEnv>();
app.use("*", cors({ origin: ALLOWED_ORIGIN, credentials: true }));
app.get("/health", ...);
app.route("/auth", authRoutes);
app.route("/exercises", exerciseRoutes);
app.route("/workouts", workoutRoutes);
app.route("/users", userRoutes);
app.route("/progress", progressRoutes);
export default app;
```

Routes are mounted at the **root** (`/auth/login`, `/workouts`, …). **Tests import
this app and hit routes at the root** — there is no `/api` prefix in the test world.

### 2. `src/worker.ts` — the deployed entrypoint

```ts
const worker = new Hono<AppEnv>();
worker.route("/api", app);                       // API under /api/*
worker.all("*", (c) => c.env.ASSETS.fetch(...)); // everything else → static assets
export default worker;
```

`worker.ts` is the `main` in `wrangler.toml`. It mounts the API app under `/api`
and delegates **everything else** to the `ASSETS` binding (the built web app).

> **Why this split matters:** in production the public path is `/api/auth/login`,
> but in tests (and in `src/index.ts`) it's `/auth/login`. The web client bakes the
> `/api` prefix into `VITE_API_URL`. Keep these consistent when adding routes.

## Request lifecycle (production)

`wrangler.toml` sets `run_worker_first = true`, so the Worker runs for **every**
request:

```
                         Incoming request
                               │
                    ┌──────────▼───────────┐
                    │  worker.ts (Hono)    │
                    └──────────┬───────────┘
                               │
              path starts      │      everything
              with /api ?      │       else
                  ┌────────────┴────────────┐
                  ▼                          ▼
        ┌──────────────────┐      ┌──────────────────────┐
        │  API app          │      │  ASSETS binding       │
        │  (src/index.ts)   │      │  serve static file    │
        │                   │      │  or, if not found,    │
        │  CORS → route →   │      │  fall back to         │
        │  middleware →     │      │  index.html (SPA)     │
        │  handler → D1     │      └──────────────────────┘
        └─────────┬─────────┘
                  ▼
            JSON response
```

- **`/api/*`** → handled by the API app. CORS runs, then the matched route's
  middleware (`requireAuth` / `requireAdmin`), then the handler, which talks to D1.
- **Anything else** → served from `apps/web/dist`. If the requested file doesn't
  exist, `not_found_handling = "single-page-application"` returns `index.html` so
  React Router can handle client-side routes (e.g. a hard refresh on `/history`).

## Why one origin

Co-hosting the SPA and API on a single origin makes the session cookie
**first-party**. This is deliberate:

- iOS Safari blocks third-party cookies. If the web app and API lived on different
  registrable domains, the credentialed cookie wouldn't be sent reliably.
- See [Authentication](./authentication.md) for the cookie's `SameSite`/`Secure`
  logic, which also handles the _local_ dev case where the web app (`:5173`) and API
  (`:8787`) are on different ports.

## Local development topologies

There are two ways to run locally:

| Mode     | Command                       | What runs                                                   | URL                     |
| -------- | ----------------------------- | ----------------------------------------------------------- | ----------------------- |
| Full app | `make dev`                    | Worker serving API **and** the built SPA                    | `http://localhost:8787` |
| Web HMR  | `make dev-web` (+ `make dev`) | Vite dev server with hot reload, calling the API on `:8787` | `http://localhost:5173` |

In HMR mode the web app is genuinely cross-origin to the API, which is why CORS
(`ALLOWED_ORIGIN`) and the dev cookie settings exist. See
[Getting Started](../development/getting-started.md).

## Configuration that ties it together

| File                        | Role                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `apps/api/wrangler.toml`    | Worker name, `main = src/worker.ts`, D1 binding `DB`, `ASSETS` from `../web/dist`, `ALLOWED_ORIGIN` var |
| `apps/web/.env.development` | `VITE_API_URL=http://localhost:8787/api`                                                                |
| `apps/web/.env.production`  | `VITE_API_URL=/api` (same origin)                                                                       |
| `tsconfig.base.json`        | Shared compiler options; `noUncheckedIndexedAccess` on                                                  |

## Where to go next

- [Data Model](./data-model.md) — the database tables and relationships.
- [Authentication](./authentication.md) — the auth system end to end.
- [API Overview](../api/README.md) — conventions and the route map.
