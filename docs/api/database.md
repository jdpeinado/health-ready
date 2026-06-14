# Database & Migrations

The database is Cloudflare **D1** (SQLite), accessed through **Drizzle ORM**. For the
table-by-table breakdown see [Data Model](../architecture/data-model.md); this page
covers the wiring and the migration workflow.

## Binding

D1 is bound as `**DB`** in `apps/api/wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "health-ready"
database_id = "e7e03fa6-f8b4-4343-8716-c2053e31e8e0"
migrations_dir = "migrations"
```

> The binding **must** stay `DB` — code reads `c.env.DB`. When `wrangler d1 create`
> prints a config snippet it suggests a different binding name; ignore that and keep
> `binding = "DB"` (per `CLAUDE.md`).

## Drizzle client (`src/db/client.ts`)

```ts
export function getDb(d1: D1Database) {
  return drizzle(d1, { schema });
}
export type Db = ReturnType<typeof getDb>;
```

Handlers call `getDb(c.env.DB)` to get a typed Drizzle instance. The `Db` type is
passed to every service function. The schema object (all tables) is registered so
Drizzle's relational helpers and `$inferInsert` / `$inferSelect` types work.

## Schema definition (`src/db/schema.ts`)

Tables are declared with `drizzle-orm/sqlite-core` (`sqliteTable`, `text`, `integer`,
`real`). Notable column modes:

- `integer(..., { mode: "timestamp_ms" })` → maps to JS `Date`, stored as epoch ms.
- `integer(..., { mode: "boolean" })` → `is_active` boolean.
- `text(..., { enum: [...] })` → typed enums (`role`, `type`, `weightUnit`,
`loadType`).
- Foreign keys use `.references(() => other.id, { onDelete: "cascade" })` where
ownership cascades apply.

## Migration workflow

Drizzle Kit generates SQL migrations from the schema. Config is
`apps/api/drizzle.config.ts`:

```ts
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  driver: "d1-http",
});
```

Generated files live in `apps/api/migrations/` (e.g. `0000_bored_sprite.sql`) with
Drizzle metadata under `migrations/meta/`.

### After changing the schema

```bash
# 1. edit apps/api/src/db/schema.ts
make migrate-generate     # drizzle-kit generates a new migrations/NNNN_*.sql
make db-migrate-local     # apply to the LOCAL dev D1
# ...later, for production:
make db-migrate           # apply to the REMOTE D1
```

These map to:


| Make target        | Command                                                     |
| ------------------ | ----------------------------------------------------------- |
| `migrate-generate` | `pnpm --filter @health-ready/api db:generate` (drizzle-kit) |
| `db-migrate-local` | `wrangler d1 migrations apply health-ready --local`         |
| `db-migrate`       | `wrangler d1 migrations apply health-ready --remote`        |


## Local vs. remote databases

- **Local** — `wrangler dev` / the `--local` migration flag use a Miniflare-backed
SQLite file under `apps/api/.wrangler/state/v3/d1/…` (gitignored). This is your dev
database; `make db-migrate-local` initializes/updates it.
- **Remote** — the real Cloudflare D1 instance referenced by `database_id`.
`make db-migrate` applies migrations there.

## Querying patterns used in the codebase

- **Single row:** `.get()` (returns the row or `undefined`).
- **Multiple rows:** `await db.select()...` (returns an array).
- **Filters:** `and(...)`, `eq`, `gte`, `lte`, `gt`, `like`, `inArray`,
`asc`/`desc`.
- **Batched writes:** `db.batch([stmt1, stmt2, ...])` to apply related
inserts/deletes together (workout + entries + sets; replace = delete + re-insert).
- **No raw SQL** is used in the app code; everything goes through Drizzle's query
builder.

## Tests and migrations

API tests don't touch the real database. `@cloudflare/vitest-pool-workers` spins up
an **in-memory D1** per test file, and `test/apply-migrations.ts` applies the
generated migrations to it before each file runs (via `readD1Migrations` +
`applyD1Migrations`). See [Testing](../development/testing.md).