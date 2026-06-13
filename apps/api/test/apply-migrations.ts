import { applyD1Migrations, env } from "cloudflare:test";

// Applies all generated D1 migrations to the per-test isolated database.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
