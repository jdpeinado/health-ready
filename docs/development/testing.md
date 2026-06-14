# Testing

Run everything with `make test` (`pnpm -r test`). There are two distinct test setups:
the API runs inside the Workers runtime; the web runs in jsdom.

## API tests (`apps/api/test/`)

Stack: **Vitest** + **`@cloudflare/vitest-pool-workers`**. Tests run inside a real
Workers runtime (Miniflare), with an **in-memory D1** database per test file.

### Config (`apps/api/vitest.config.ts`)

- `cloudflareTest(...)` boots Miniflare with:
  - `compatibilityFlags: ["nodejs_compat"]`
  - `d1Databases: { DB: "health-ready" }` — the `DB` binding tests use.
  - bindings: `TEST_MIGRATIONS` (read from `migrations/` via `readD1Migrations`),
    `BOOTSTRAP_SECRET: "test-secret"`, `ALLOWED_ORIGIN: "http://localhost:5173"`.
  - `wrangler.configPath: "./wrangler.toml"`.
- `setupFiles: ["./test/apply-migrations.ts"]` — applies all migrations to the
  isolated DB before each test file:

  ```ts
  import { applyD1Migrations, env } from "cloudflare:test";
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
  ```

### Convention: import the app at the root

Tests import the API app from `src/index.ts` (**not** `worker.ts`) and call routes at
the **root** (no `/api` prefix):

```ts
import app from "../src/index.js";
const res = await app.request("/auth/login", { method: "POST", body: ... }, env);
```

### Helpers (`test/helpers.ts`)

- `seedUser(role = "user")` — inserts a user and a session, returns
  `{ id, cookie: "session=<token>" }` so tests can make authenticated requests.
- `seedExercise(overrides?)` — inserts an exercise (defaults: name "Dominada",
  strength, active), returns its id.

### What's covered

The suite spans routes, services, middleware, and libs:

```
auth.routes        exercises.routes     workouts.routes     users.routes
progress.routes    progress.service     workouts.service
middleware         session              password            encoding
cors               load                 (load math)
```

(See the files under `apps/api/test/`.)

## Web tests (`apps/web/src/**`)

Stack: **Vitest** + **jsdom** + Testing Library.

### Config (`apps/web/vite.config.ts`, `test` block)

- `environment: "jsdom"`, `globals: true`
- `setupFiles: ["./src/test/setup.ts"]`

### Convention: no network

Web tests must not hit the network — **stub `fetch`**. Tests live next to the code
they cover (e.g. `app/Protected.test.tsx`, `api/client.test.ts`,
`features/workouts/sets.test.ts`).

## TypeScript in tests

Because `noUncheckedIndexedAccess` is on and `tsc` typechecks test files too, indexed
access in tests must be guarded (`arr[0]!` or an existence check) or `make typecheck`
fails. Keep this in mind when writing assertions over arrays.

## Working agreement

Follow TDD where practical and keep the suite green (`make test`) before deploying.
