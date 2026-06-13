import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  plugins: [
    cloudflareTest(async () => ({
      miniflare: {
        compatibilityFlags: ["nodejs_compat"],
        d1Databases: { DB: "health-ready" },
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations(path.join(__dirname, "migrations")),
          BOOTSTRAP_SECRET: "test-secret",
        },
      },
      wrangler: { configPath: "./wrangler.toml" },
    })),
  ],
  test: {
    setupFiles: ["./test/apply-migrations.ts"],
  },
});
