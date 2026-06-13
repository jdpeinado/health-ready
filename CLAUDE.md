# CLAUDE.md

Guidance for Claude Code (and other agents) working in this repository.

## What this is

Health Ready — a personal training tracker. A single Cloudflare Worker serves both a
JSON API (`/api/*`) and a React PWA (the built `apps/web/dist`) from one origin.

## Layout (pnpm workspace)

- `apps/api` — Cloudflare Worker. Hono app + D1 (Drizzle ORM) + roll-your-own auth.
  - `src/index.ts` — the API app: mounts routes at the root (`/auth`, `/exercises`,
    `/workouts`, `/users`, `/progress`, `/health`) + CORS. **Tests import this** and hit
    routes at the root.
  - `src/worker.ts` — the deployed entrypoint (`main` in `wrangler.toml`). Mounts the API
    app under `/api/*` and serves everything else from the `ASSETS` binding (the built
    web app), with SPA fallback.
  - `src/db/schema.ts` — Drizzle tables; `src/middleware/auth.ts` — `requireAuth` /
    `requireAdmin` + the `AppEnv` type.
- `apps/web` — Vite + React + TS PWA. React Router, TanStack Query, shadcn/ui, Recharts.
- `packages/shared` — Zod schemas + inferred types (`@health-ready/shared`). **Validation
  and shared types live here; import from this package on both ends rather than redefining.**

## Commands

Use the `Makefile` (run `make` for the list). Key ones:

- `make dev` — full app locally on `:8787`; `make dev-web` — web with HMR on `:5173`.
- `make test` (`pnpm -r test`) and `make typecheck` (`pnpm -r typecheck`).
- `make db-migrate-local` / `make db-migrate` — apply D1 migrations (local / remote).
- `make migrate-generate` — generate a new migration after editing `apps/api/src/db/schema.ts`.
- `make deploy` — build the web app, then deploy the Worker (serves API + SPA).

After changing the DB schema: edit `schema.ts` → `make migrate-generate` → `make db-migrate-local`.

## Conventions & gotchas

- **`noUncheckedIndexedAccess` is on** (`tsconfig.base.json`). Array/object index access yields
  `T | undefined`. `tsc` typechecks test files too (they live under `src`), so guard indexed
  access in tests (e.g. `arr[0]!` or an existence check) or the build fails.
- **Auth is cookie-based.** Login returns the user in the body and sets an `httpOnly` session
  cookie. In production the SPA and API share one origin, so the cookie is first-party — this is
  deliberate (iOS Safari blocks third-party cookies). Do not split the web app onto a different
  domain without switching the cookie to `SameSite=None` (and ideally adding a Bearer-token path).
- **D1 binding must be `DB`.** Code reads `c.env.DB`. When running `wrangler d1 create`, the
  snippet it prints uses a different binding name — keep `binding = "DB"` in `wrangler.toml`.
- **shadcn/ui components are vendored, Radix-based** (`apps/web/src/components/ui/*`). The live
  shadcn registry now serves Base UI ("Nova") components with a different API; do **not**
  regenerate these from the registry. Edit the local files or copy canonical Radix sources.
  Styling is Tailwind CSS v4 (`@tailwindcss/vite`), dark slate theme, `@/*` → `apps/web/src/*`.
- **API path prefix:** routes are defined at the root in `src/index.ts` but served under `/api`
  in production via `src/worker.ts`. The web client's `VITE_API_URL` includes the `/api` prefix
  (`/api` in prod, `http://localhost:8787/api` in dev).

## Testing

- API: Vitest + `@cloudflare/vitest-pool-workers` (in-memory D1, migrations applied per file).
  Import the app from `src/index.js` and call routes at the root.
- Web: Vitest + jsdom + Testing Library. Keep tests free of network — stub `fetch`.
- Follow TDD where practical; keep the suite green (`make test`) before deploying.

## Working agreement

- The maintainer handles all git operations (`git add` / `commit` / `push`) themselves —
  make file changes, but do not stage, commit, or push.
- Secrets are never committed. `apps/api/.dev.vars` (local dev secret) is gitignored; the
  production `BOOTSTRAP_SECRET` lives in Cloudflare (`wrangler secret put`), not the repo.
