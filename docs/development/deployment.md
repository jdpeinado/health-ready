# Deployment (Cloudflare)

The whole app deploys as **one Cloudflare Worker** that serves both the API and the
built SPA. There is no separate frontend host.

## How the deploy works

`make deploy` does two things:

1. `make build` → builds the web app to `apps/web/dist`.
2. `wrangler deploy` (in `apps/api`) → deploys the Worker.

The Worker's `wrangler.toml` declares the built web app as a static-asset binding:

```toml
[assets]
directory = "../web/dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
run_worker_first = true
```

So the deployed Worker (`src/worker.ts`) handles `/api/*` itself and serves
everything else from `dist`, with an `index.html` SPA fallback. See
[Architecture](../architecture/README.md#request-lifecycle-production).

> Always `make build` before deploying (or just use `make deploy`, which builds
> first). Deploying without rebuilding ships a stale SPA.

## First-time setup (in order)

```bash
make login              # authenticate with Cloudflare (opens a browser)

make db-create          # create the remote D1 database…
#                       # …then paste the printed database_id into
#                       # apps/api/wrangler.toml — KEEP binding = "DB"

make db-migrate         # apply the schema to the remote database

make secret-bootstrap   # set BOOTSTRAP_SECRET (choose a strong value)

make deploy             # build the web app + deploy the Worker

make bootstrap-admin \  # create the first admin (works only once)
  EMAIL=you@example.com PASSWORD=yourpass8 NAME="You" SECRET=the-secret-you-set
```

### Notes on each step

- **`db-create`** — `wrangler d1 create` prints a config snippet with a _different_
  binding name. Ignore that; keep `binding = "DB"` in `wrangler.toml` (code reads
  `c.env.DB`). Paste only the `database_id`.
- **`secret-bootstrap`** — sets `BOOTSTRAP_SECRET` in Cloudflare (not the repo).
  Secrets are never committed.
- **`bootstrap-admin`** — curls `POST /api/auth/bootstrap-admin` with the secret.
  It succeeds once; afterwards it returns `409` (an admin already exists).

## Everyday deploy

```bash
make deploy
```

If you changed the schema, also apply migrations to production:

```bash
make migrate-generate    # if you edited schema.ts and haven't generated yet
make db-migrate          # apply to remote
make deploy
```

## Managing users in production

After the first admin exists, create more accounts with an admin's credentials:

```bash
# regular user
make add-user ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... \
  EMAIL=friend@example.com PASSWORD=theirpass8 NAME="Friend"

# another admin
make add-user ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=... \
  EMAIL=other@example.com PASSWORD=theirpass8 NAME="Other" ROLE=admin
```

`add-user` logs in as the admin (storing the session cookie in a temp jar) and then
calls `POST /api/users`.

## Configuration reference

| Setting            | Where                      | Value / note                                       |
| ------------------ | -------------------------- | -------------------------------------------------- |
| Worker name        | `wrangler.toml`            | `health-ready-api`                                 |
| Entrypoint         | `wrangler.toml` `main`     | `src/worker.ts`                                    |
| Compatibility      | `wrangler.toml`            | `compatibility_date`, `nodejs_compat` flag         |
| D1 binding         | `wrangler.toml`            | **`DB`** → database `health-ready` (`database_id`) |
| Static assets      | `wrangler.toml` `[assets]` | `../web/dist`, SPA fallback, `run_worker_first`    |
| `ALLOWED_ORIGIN`   | `wrangler.toml` `[vars]`   | CORS origin (dev: `http://localhost:5173`)         |
| `BOOTSTRAP_SECRET` | Cloudflare secret          | set via `make secret-bootstrap`                    |
| `VITE_API_URL`     | `apps/web/.env.production` | `/api` (same origin)                               |

## Observability

```bash
make logs    # wrangler tail — live production logs
```

## Cookie & domain caveat

Because the SPA and API share an origin, the session cookie is **first-party**
(required for iOS Safari). Do **not** move the web app to a different domain without
revisiting the cookie's `SameSite=None; Secure` settings (and ideally adding a
Bearer-token auth path). See [Authentication](../architecture/authentication.md).
