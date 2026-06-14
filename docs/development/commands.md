# Commands (Makefile Reference)

All common tasks are fronted by the `Makefile`. Run `make` (or `make help`) for the
auto-generated list. This page documents each target and what it actually runs.

Key variables (top of `Makefile`):

- `API_DIR = apps/api`
- `DB_NAME = health-ready`
- `APP_URL = https://health-ready-api.jhosedo.workers.dev` (used by the curl helpers)
- `ROLE ?= user` (default role for `add-user`, override with `ROLE=admin`)

## Setup & quality

| Target           | Runs                                    | Purpose                                    |
| ---------------- | --------------------------------------- | ------------------------------------------ |
| `make install`   | `pnpm install`                          | Install all workspace dependencies         |
| `make typecheck` | `pnpm -r typecheck`                     | Typecheck every package                    |
| `make test`      | `pnpm -r test`                          | Run all test suites (API + web)            |
| `make build`     | `pnpm --filter @health-ready/web build` | Build the web app (required before deploy) |

## Local development

| Target         | Runs                                  | Purpose                                                      |
| -------------- | ------------------------------------- | ------------------------------------------------------------ |
| `make dev`     | `cd apps/api && npx wrangler dev`     | Full app (API + built SPA) at `http://localhost:8787`        |
| `make dev-web` | `pnpm --filter @health-ready/web dev` | Web with HMR at `http://localhost:5173` (run `make dev` too) |

## Cloudflare auth

| Target        | Runs              | Purpose                                      |
| ------------- | ----------------- | -------------------------------------------- |
| `make login`  | `wrangler login`  | Authenticate with Cloudflare (opens browser) |
| `make whoami` | `wrangler whoami` | Show the logged-in account                   |

## Database (D1)

| Target                  | Runs                                                 | Purpose                                                                                                               |
| ----------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `make db-create`        | `wrangler d1 create health-ready`                    | **First time only** — create the remote DB, then paste its `database_id` into `wrangler.toml` (keep `binding = "DB"`) |
| `make migrate-generate` | `pnpm --filter @health-ready/api db:generate`        | Generate a new SQL migration from Drizzle schema changes                                                              |
| `make db-migrate-local` | `wrangler d1 migrations apply health-ready --local`  | Apply migrations to the local dev DB                                                                                  |
| `make db-migrate`       | `wrangler d1 migrations apply health-ready --remote` | Apply migrations to the remote (production) DB                                                                        |

## Secrets & deploy

| Target                  | Runs                                                   | Purpose                                                      |
| ----------------------- | ------------------------------------------------------ | ------------------------------------------------------------ |
| `make secret-bootstrap` | `wrangler secret put BOOTSTRAP_SECRET`                 | Set the production `BOOTSTRAP_SECRET` (interactive)          |
| `make deploy`           | `make build` then `cd apps/api && npx wrangler deploy` | Build the web app, then deploy the Worker (serves API + SPA) |
| `make logs`             | `wrangler tail`                                        | Tail live production logs                                    |

## One-off helpers (user management)

| Target                                                                                       | Purpose                                                              |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `make bootstrap-admin EMAIL=.. PASSWORD=.. NAME=".." SECRET=..`                              | Create the first prod admin (curls `/api/auth/bootstrap-admin`)      |
| `make add-user ADMIN_EMAIL=.. ADMIN_PASSWORD=.. EMAIL=.. PASSWORD=.. NAME=".." [ROLE=admin]` | Log in as an admin (cookie jar), then create a user via `/api/users` |

`add-user` logs in as the given admin first; if that login fails it aborts with a
clear message. `ROLE` defaults to `user`.

## Typical workflows

**Daily dev:**

```bash
make dev            # (and make dev-web in another terminal for HMR)
make test
make typecheck
```

**Schema change:**

```bash
# edit apps/api/src/db/schema.ts
make migrate-generate
make db-migrate-local      # local
make db-migrate            # later, for production
```

**Deploy:**

```bash
make deploy
```

See [Deployment](./deployment.md) for the full first-time setup sequence.
