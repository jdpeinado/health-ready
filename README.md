# Health Ready

A personal training tracker — log workouts (strength & cardio), copy past sessions,
browse history, and see per-exercise progress charts. Built as an installable PWA so
it works like a native app on a phone.

Runs entirely on Cloudflare's free tier: a single Worker serves both the JSON API and
the React app from one origin.

## Stack

- **API** — [Hono](https://hono.dev) on Cloudflare Workers, [D1](https://developers.cloudflare.com/d1/) (SQLite) via [Drizzle ORM](https://orm.drizzle.team). Roll-your-own auth (PBKDF2 password hashing, opaque session tokens in an `httpOnly` cookie).
- **Web** — Vite + React + TypeScript PWA. React Router, TanStack Query, [shadcn/ui](https://ui.shadcn.com) (Radix + Tailwind CSS v4), Recharts.
- **Shared** — Zod schemas and shared types (`@health-ready/shared`), used by both ends.
- **Tooling** — pnpm workspace monorepo, Vitest, Wrangler.

```
apps/
  api/      Cloudflare Worker: API (/api/*) + serves the built web app
  web/      React PWA (built to apps/web/dist, bundled into the Worker)
packages/
  shared/   Zod schemas + types shared by api and web
```

## Develop

Requires Node 18+ and pnpm.

```bash
make install            # install dependencies
make db-migrate-local   # set up the local D1 database
make dev                # full app (API + SPA) on http://localhost:8787
```

For web work with hot reload, run `make dev` in one terminal and `make dev-web`
in another (web on http://localhost:5173, talking to the API on :8787).

```bash
make test       # run all test suites
make typecheck  # typecheck every package
```

## Deploy (Cloudflare)

First-time setup, in order:

```bash
make login              # authenticate with Cloudflare
make db-create          # create the D1 database, then paste the printed
                        #   database_id into apps/api/wrangler.toml (keep binding = "DB")
make db-migrate         # apply the schema to the remote database
make secret-bootstrap   # set BOOTSTRAP_SECRET (choose a strong value)
make deploy             # build the web app + deploy the Worker
make bootstrap-admin EMAIL=you@example.com PASSWORD=yourpass8 NAME="You" SECRET=the-secret-you-set
```

Everyday deploy is just `make deploy` (it builds the web app, then deploys the Worker
which serves both the API and the SPA). Run `make` to see all available commands.

### Managing users

The first admin is created with `make bootstrap-admin` (works only once). After that,
an existing admin creates more accounts:

```bash
# regular user
make add-user ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... EMAIL=friend@example.com PASSWORD=theirpass8 NAME="Friend"
# another admin
make add-user ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... EMAIL=other@example.com PASSWORD=theirpass8 NAME="Other" ROLE=admin
```

## License

[MIT](./LICENSE) © 2026 Jose Peinado
