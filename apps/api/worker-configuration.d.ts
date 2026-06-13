import type { D1Database, D1Migration } from "@cloudflare/workers-types";

// Bindings are declared on the global `Cloudflare.Env` interface — the convention
// `wrangler types` and `@cloudflare/vitest-pool-workers` both rely on (the test
// pool types `env` as `Cloudflare.Env`).
declare global {
  namespace Cloudflare {
    interface Env {
      DB: D1Database;
      BOOTSTRAP_SECRET: string;
      // Test-only: injected by the vitest pool (see vitest.config.ts). Unused in production.
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}

// Re-exported so app code can `import type { Env }` for Hono `Bindings`.
export type Env = Cloudflare.Env;
