# Getting Started

How to get Health Ready running on your machine.

## Prerequisites

- **Node.js 18+**
- **pnpm** (the repo pins `pnpm@9.12.0` via `packageManager`)
- A Cloudflare account is only needed for **deploying** (not for local dev).

## Install

```bash
make install          # pnpm install (all workspaces)
```

## Set up the local database

The app uses a local D1 (SQLite, via Miniflare) for development. Initialize it by
applying migrations:

```bash
make db-migrate-local
```

This creates/updates the local D1 under `apps/api/.wrangler/state/v3/d1/…`
(gitignored).

## Run it

### Option A — full app on one port

```bash
make dev              # Worker serving API + the built SPA at http://localhost:8787
```

This runs `wrangler dev`. It serves the API at `/api/*` and the web app for
everything else — same topology as production. Note it serves the **built**
`apps/web/dist`, so for active web development use Option B.

### Option B — web with hot reload

```bash
make dev              # terminal 1: the API/Worker on :8787
make dev-web          # terminal 2: Vite dev server on :5173 (HMR)
```

The Vite dev server proxies your code with hot-module reload and calls the API on
`:8787` (via `VITE_API_URL=http://localhost:8787/api`). This is cross-origin, which
is why CORS (`ALLOWED_ORIGIN=http://localhost:5173`) and the dev cookie settings
exist. Open `http://localhost:5173`.

## Local secret

Local dev secrets live in `apps/api/.dev.vars` (gitignored). In particular
`BOOTSTRAP_SECRET` is read from there for the local bootstrap-admin flow. (For
production the secret is set in Cloudflare via `wrangler secret put`, not committed.)

## Create a local account

There's no public sign-up. Create the first admin against your local API, then log in:

```bash
# with `make dev` running on :8787 and BOOTSTRAP_SECRET set in apps/api/.dev.vars
curl -i http://localhost:8787/api/auth/bootstrap-admin \
  -H 'content-type: application/json' \
  -d '{"secret":"<your .dev.vars secret>","email":"you@example.com","password":"yourpass8","displayName":"You"}'
```

Then open the app and log in with those credentials. As an admin you can add
exercises and create more users in-app / via the API.

> A seeded local dev user may already exist in your environment
> (`demo@health.app` / `demopass123`) along with sample exercises/workouts.

## Quality checks

```bash
make test             # all test suites (API + web)
make typecheck        # typecheck every package
```

Keep both green before deploying. See [Testing](./testing.md) and
[Commands](./commands.md).

## Common gotcha — `noUncheckedIndexedAccess`

It's on globally. Indexed access (`arr[0]`, `obj[key]`) yields `T | undefined`, and
`tsc` typechecks test files too. Guard indexed access (e.g. `arr[0]!` or an existence
check) or the build fails.
