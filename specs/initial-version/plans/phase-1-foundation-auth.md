# Phase 1: Foundation + Database + Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the pnpm monorepo, the D1/Drizzle data layer (full schema), and a fully tested custom auth system (password hashing, sessions, login/logout/me, admin bootstrap, route guards) on Cloudflare Workers + Hono.

**Architecture:** A pnpm-workspace monorepo with `apps/api` (Hono on Workers + D1) and `packages/shared` (Zod schemas/types shared across apps). Auth is roll-your-own: PBKDF2 password hashing via Web Crypto, opaque session tokens stored hashed in D1, delivered as an httpOnly secure cookie, validated by Hono middleware. `apps/web` is scaffolded in Phase 4.

**Tech Stack:** TypeScript, pnpm workspaces, Hono, Cloudflare Workers (wrangler), Cloudflare D1, Drizzle ORM + drizzle-kit, Zod, Vitest + `@cloudflare/vitest-pool-workers`.

**Prerequisites:** Node 20+, pnpm 9+, a Cloudflare account, and `wrangler` authenticated (`pnpm dlx wrangler login`) before Task 6.

---

## File Structure (created in this phase)

```
health-ready/
  package.json                      # root workspace scripts
  pnpm-workspace.yaml
  tsconfig.base.json
  packages/
    shared/
      package.json
      tsconfig.json
      src/
        index.ts                    # barrel re-export
        schemas/common.ts           # role / exercise-type / weight-unit / load-type enums
        schemas/auth.ts             # login + bootstrap schemas
  apps/
    api/
      package.json
      tsconfig.json
      wrangler.toml
      drizzle.config.ts
      vitest.config.ts
      worker-configuration.d.ts     # Env binding types
      src/
        index.ts                    # Hono app entry, route mounting
        db/schema.ts                # ALL Drizzle tables (users..sets)
        db/client.ts                # drizzle(env.DB) helper
        lib/encoding.ts             # hex helpers + constant-time compare
        lib/password.ts             # hashPassword / verifyPassword
        lib/session.ts              # create / validate / revoke session
        middleware/auth.ts          # requireAuth / requireAdmin
        routes/auth.ts              # bootstrap-admin / login / logout / me
      migrations/                   # drizzle-kit generated SQL
      test/
        apply-migrations.ts         # vitest setup: applies migrations to test D1
        password.test.ts
        session.test.ts
        auth.routes.test.ts
        middleware.test.ts
```

---

## Task 1: Root monorepo scaffold

**Files:**

- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Modify: `.gitignore`

- [ ] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: Create root `package.json`**

```json
{
  "name": "health-ready",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "build:shared": "pnpm --filter @health-ready/shared build",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  }
}
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true
  }
}
```

- [ ] **Step 4: Update `.gitignore`**

Append these lines (the file already contains `node_modules`, `.wrangler`, `dist`, `.dev.vars`):

```
*.log
.DS_Store
apps/api/.wrangler
coverage
```

- [ ] **Step 5: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `chore: scaffold pnpm monorepo root`

---

## Task 2: Shared package (Zod schemas)

**Files:**

- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/schemas/common.ts`
- Create: `packages/shared/src/schemas/auth.ts`
- Create: `packages/shared/src/index.ts`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@health-ready/shared",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": { "zod": "^3.23.8" }
}
```

> We consume `src` directly (TypeScript path), so no build is required for dev. `build`/`typecheck` exist for CI.

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `packages/shared/src/schemas/common.ts`**

```ts
import { z } from "zod";

export const roleSchema = z.enum(["admin", "user"]);
export type Role = z.infer<typeof roleSchema>;

export const exerciseTypeSchema = z.enum(["strength", "cardio", "mobility"]);
export type ExerciseType = z.infer<typeof exerciseTypeSchema>;

export const weightUnitSchema = z.enum(["kg", "lb"]);
export type WeightUnit = z.infer<typeof weightUnitSchema>;

export const loadTypeSchema = z.enum([
  "total",
  "per_side",
  "per_dumbbell",
  "bodyweight",
  "bodyweight_added",
]);
export type LoadType = z.infer<typeof loadTypeSchema>;
```

- [ ] **Step 4: Create `packages/shared/src/schemas/auth.ts`**

```ts
import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const bootstrapAdminSchema = z.object({
  secret: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1),
});
export type BootstrapAdminInput = z.infer<typeof bootstrapAdminSchema>;

export const publicUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  role: z.enum(["admin", "user"]),
});
export type PublicUser = z.infer<typeof publicUserSchema>;
```

- [ ] **Step 5: Create `packages/shared/src/index.ts`**

```ts
export * from "./schemas/common.js";
export * from "./schemas/auth.js";
```

- [ ] **Step 6: Install and verify typecheck**

Run: `pnpm install && pnpm --filter @health-ready/shared typecheck`
Expected: installs deps, typecheck passes with no errors.

- [ ] **Step 7: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(shared): add zod schemas for auth and common enums`

---

## Task 3: API app scaffold

**Files:**

- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/wrangler.toml`
- Create: `apps/api/worker-configuration.d.ts`
- Create: `apps/api/src/index.ts`

- [ ] **Step 1: Create `apps/api/package.json`**

```json
{
  "name": "@health-ready/api",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "db:generate": "drizzle-kit generate",
    "db:migrate:local": "wrangler d1 migrations apply health-ready --local",
    "db:migrate:remote": "wrangler d1 migrations apply health-ready --remote"
  },
  "dependencies": {
    "@health-ready/shared": "workspace:*",
    "drizzle-orm": "^0.36.4",
    "hono": "^4.6.13",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.5.40",
    "@cloudflare/workers-types": "^4.20241127.0",
    "drizzle-kit": "^0.28.1",
    "typescript": "^5.7.2",
    "vitest": "2.1.8",
    "wrangler": "^3.91.0"
  }
}
```

- [ ] **Step 2: Create `apps/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["@cloudflare/workers-types", "@cloudflare/vitest-pool-workers"],
    "jsx": "react-jsx",
    "noEmit": true
  },
  "include": ["src", "test", "worker-configuration.d.ts", "*.ts"]
}
```

- [ ] **Step 3: Create `apps/api/wrangler.toml`**

```toml
name = "health-ready-api"
main = "src/index.ts"
compatibility_date = "2024-11-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "health-ready"
database_id = "PLACEHOLDER_SET_IN_TASK_6"
migrations_dir = "migrations"
```

> `database_id` is filled in Task 6 after `wrangler d1 create`. `BOOTSTRAP_SECRET` is supplied as a secret/`.dev.vars`, not committed.

- [ ] **Step 4: Create `apps/api/worker-configuration.d.ts`**

```ts
import type { D1Database } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
  BOOTSTRAP_SECRET: string;
}

// Types for the cloudflare:test module used by vitest-pool-workers.
declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: import("@cloudflare/workers-types").D1Migration[];
  }
}
```

- [ ] **Step 5: Create `apps/api/src/index.ts` (minimal app)**

```ts
import { Hono } from "hono";
import type { Env } from "../worker-configuration";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true }));

export default app;
```

- [ ] **Step 6: Create `apps/api/.dev.vars` (NOT committed — in .gitignore)**

```
BOOTSTRAP_SECRET=dev-only-change-me
```

- [ ] **Step 7: Install and typecheck**

Run: `pnpm install && pnpm --filter @health-ready/api typecheck`
Expected: passes (no D1 calls yet).

- [ ] **Step 8: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(api): scaffold hono worker app with health endpoint`

---

## Task 4: Drizzle schema (all tables) + client

**Files:**

- Create: `apps/api/src/db/schema.ts`
- Create: `apps/api/src/db/client.ts`
- Create: `apps/api/drizzle.config.ts`

- [ ] **Step 1: Create `apps/api/src/db/schema.ts`**

```ts
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "user"] })
    .notNull()
    .default("user"),
  displayName: text("display_name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const exercises = sqliteTable("exercises", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", { enum: ["strength", "cardio", "mobility"] }).notNull(),
  muscleGroup: text("muscle_group"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const workouts = sqliteTable("workouts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // ISO date "YYYY-MM-DD"
  name: text("name"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const workoutEntries = sqliteTable("workout_entries", {
  id: text("id").primaryKey(),
  workoutId: text("workout_id")
    .notNull()
    .references(() => workouts.id, { onDelete: "cascade" }),
  exerciseId: text("exercise_id")
    .notNull()
    .references(() => exercises.id),
  orderIndex: integer("order_index").notNull(),
  comment: text("comment"),
  durationSeconds: integer("duration_seconds"),
  distance: real("distance"),
  distanceUnit: text("distance_unit"),
});

export const sets = sqliteTable("sets", {
  id: text("id").primaryKey(),
  entryId: text("entry_id")
    .notNull()
    .references(() => workoutEntries.id, { onDelete: "cascade" }),
  setIndex: integer("set_index").notNull(),
  reps: integer("reps"),
  weight: real("weight"),
  weightUnit: text("weight_unit", { enum: ["kg", "lb"] }),
  loadType: text("load_type", {
    enum: [
      "total",
      "per_side",
      "per_dumbbell",
      "bodyweight",
      "bodyweight_added",
    ],
  }),
  barWeight: real("bar_weight"),
});
```

- [ ] **Step 2: Create `apps/api/src/db/client.ts`**

```ts
import { drizzle } from "drizzle-orm/d1";
import type { D1Database } from "@cloudflare/workers-types";
import * as schema from "./schema.js";

export function getDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Db = ReturnType<typeof getDb>;
```

- [ ] **Step 3: Create `apps/api/drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  driver: "d1-http",
});
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @health-ready/api typecheck`
Expected: passes.

- [ ] **Step 5: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(api): add drizzle schema and d1 client`

---

## Task 5: Generate migrations + wire Vitest with test migrations

**Files:**

- Create: `apps/api/migrations/*.sql` (generated)
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/test/apply-migrations.ts`

- [ ] **Step 1: Generate the initial migration**

Run: `pnpm --filter @health-ready/api db:generate`
Expected: a file like `apps/api/migrations/0000_*.sql` is created containing `CREATE TABLE` statements for all six tables.

- [ ] **Step 2: Create `apps/api/vitest.config.ts`**

```ts
import {
  defineWorkersProject,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";
import path from "node:path";

export default defineWorkersProject(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, "migrations"));
  return {
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
      poolOptions: {
        workers: {
          singleWorker: true,
          isolatedStorage: true,
          miniflare: {
            compatibilityFlags: ["nodejs_compat"],
            d1Databases: { DB: "health-ready" },
            bindings: {
              TEST_MIGRATIONS: migrations,
              BOOTSTRAP_SECRET: "test-secret",
            },
          },
          wrangler: { configPath: "./wrangler.toml" },
        },
      },
    },
  };
});
```

- [ ] **Step 3: Create `apps/api/test/apply-migrations.ts`**

```ts
import { applyD1Migrations, env } from "cloudflare:test";

// Applies all generated D1 migrations to the per-test isolated database.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
```

- [ ] **Step 4: Add a temporary smoke test to confirm the harness boots**

Create `apps/api/test/smoke.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { getDb } from "../src/db/client.js";
import { users } from "../src/db/schema.js";

describe("test harness", () => {
  it("has a migrated, empty users table", async () => {
    const db = getDb(env.DB);
    const rows = await db.select().from(users);
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 5: Run the smoke test**

Run: `pnpm --filter @health-ready/api test`
Expected: PASS — confirms migrations apply and Drizzle can query D1 in the test pool.

- [ ] **Step 6: Delete the smoke test**

```bash
rm apps/api/test/smoke.test.ts
```

- [ ] **Step 7: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(api): generate initial migration and wire vitest workers pool`

---

## Task 6: Create the real D1 database (one-time, manual)

**Files:**

- Modify: `apps/api/wrangler.toml`

- [ ] **Step 1: Create the D1 database**

Run: `pnpm dlx wrangler d1 create health-ready`
Expected: output includes a `database_id` UUID. Copy it.

- [ ] **Step 2: Put the id into `wrangler.toml`**

Replace `PLACEHOLDER_SET_IN_TASK_6` with the real `database_id` from Step 1.

- [ ] **Step 3: Apply migrations to the local D1**

Run: `pnpm --filter @health-ready/api db:migrate:local`
Expected: migration `0000_*` reported as applied.

- [ ] **Step 4: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `chore(api): bind real d1 database id`

> Note: `db:migrate:remote` is run at deploy time, not in this phase.

---

## Task 7: Encoding helpers (hex + constant-time compare)

**Files:**

- Create: `apps/api/src/lib/encoding.ts`
- Test: `apps/api/test/encoding.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/api/test/encoding.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toHex, fromHex, timingSafeEqual } from "../src/lib/encoding.js";

describe("encoding", () => {
  it("round-trips bytes through hex", () => {
    const bytes = new Uint8Array([0, 1, 15, 16, 255]);
    expect(toHex(bytes)).toBe("00010f10ff");
    expect(Array.from(fromHex("00010f10ff"))).toEqual([0, 1, 15, 16, 255]);
  });

  it("compares equal strings as true and different as false", () => {
    expect(timingSafeEqual("abc123", "abc123")).toBe(true);
    expect(timingSafeEqual("abc123", "abc124")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @health-ready/api test encoding`
Expected: FAIL — cannot find module `../src/lib/encoding.js`.

- [ ] **Step 3: Implement `apps/api/src/lib/encoding.ts`**

```ts
export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export function fromHex(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// Constant-time string comparison to avoid leaking match length via timing.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @health-ready/api test encoding`
Expected: PASS.

- [ ] **Step 5: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(api): add hex + constant-time compare helpers`

---

## Task 8: Password hashing (PBKDF2)

**Files:**

- Create: `apps/api/src/lib/password.ts`
- Test: `apps/api/test/password.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/api/test/password.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/password.js";

describe("password", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("produces a different hash each time (random salt)", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same", a)).toBe(true);
    expect(await verifyPassword("same", b)).toBe(true);
  });

  it("returns false for a malformed stored hash", async () => {
    expect(await verifyPassword("x", "not-a-real-hash")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @health-ready/api test password`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/api/src/lib/password.ts`**

```ts
import { toHex, fromHex, timingSafeEqual } from "./encoding.js";

const ITERATIONS = 100_000;
const KEY_LEN_BYTES = 32;
const SALT_LEN_BYTES = 16;
const encoder = new TextEncoder();

async function derive(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    KEY_LEN_BYTES * 8,
  );
  return toHex(new Uint8Array(bits));
}

// Format: pbkdf2$<iterations>$<saltHex>$<hashHex>
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN_BYTES));
  const hash = await derive(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toHex(salt)}$${hash}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations <= 0) return false;
  const computed = await derive(password, fromHex(parts[2]), iterations);
  return timingSafeEqual(computed, parts[3]);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @health-ready/api test password`
Expected: PASS (all 4 cases).

- [ ] **Step 5: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(api): add PBKDF2 password hashing`

---

## Task 9: Session lifecycle (create / validate / revoke)

**Files:**

- Create: `apps/api/src/lib/session.ts`
- Test: `apps/api/test/session.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/api/test/session.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "../src/db/client.js";
import { users } from "../src/db/schema.js";
import {
  createSession,
  validateSession,
  revokeSession,
} from "../src/lib/session.js";

async function makeUser() {
  const db = getDb(env.DB);
  const id = crypto.randomUUID();
  await db.insert(users).values({
    id,
    email: `${id}@example.com`,
    passwordHash: "x",
    role: "user",
    displayName: "Test",
    createdAt: new Date(),
  });
  return id;
}

describe("session", () => {
  let userId: string;
  beforeEach(async () => {
    userId = await makeUser();
  });

  it("creates a session and validates its token", async () => {
    const db = getDb(env.DB);
    const { token } = await createSession(db, userId);
    const result = await validateSession(db, token);
    expect(result?.user.id).toBe(userId);
  });

  it("returns null for an unknown token", async () => {
    const db = getDb(env.DB);
    expect(await validateSession(db, "deadbeef")).toBeNull();
  });

  it("returns null after the session is revoked", async () => {
    const db = getDb(env.DB);
    const { token } = await createSession(db, userId);
    await revokeSession(db, token);
    expect(await validateSession(db, token)).toBeNull();
  });

  it("returns null for an expired session", async () => {
    const db = getDb(env.DB);
    const past = new Date(Date.now() - 1000);
    const { token } = await createSession(db, userId, past);
    expect(await validateSession(db, token)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @health-ready/api test session`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/api/src/lib/session.ts`**

```ts
import { and, eq, gt } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";
import { toHex } from "./encoding.js";

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const encoder = new TextEncoder();

function generateToken(): string {
  return toHex(crypto.getRandomValues(new Uint8Array(32)));
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return toHex(new Uint8Array(digest));
}

export interface CreatedSession {
  token: string;
  expiresAt: Date;
}

export async function createSession(
  db: Db,
  userId: string,
  expiresAt: Date = new Date(Date.now() + SESSION_TTL_MS),
): Promise<CreatedSession> {
  const token = generateToken();
  await db.insert(sessions).values({
    id: crypto.randomUUID(),
    userId,
    tokenHash: await hashToken(token),
    expiresAt,
    createdAt: new Date(),
  });
  return { token, expiresAt };
}

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "user";
}

export async function validateSession(
  db: Db,
  token: string,
): Promise<{ user: SessionUser } | null> {
  const tokenHash = await hashToken(token);
  const row = await db
    .select({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .get();
  return row ? { user: row } : null;
}

export async function revokeSession(db: Db, token: string): Promise<void> {
  const tokenHash = await hashToken(token);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @health-ready/api test session`
Expected: PASS (all 4 cases).

- [ ] **Step 5: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(api): add session create/validate/revoke`

---

## Task 10: Auth middleware (requireAuth / requireAdmin)

**Files:**

- Create: `apps/api/src/middleware/auth.ts`
- Test: `apps/api/test/middleware.test.ts`

The middleware reads the `session` cookie, validates it, and stores the user on the
Hono context under the `user` key. `requireAdmin` additionally enforces the role.

- [ ] **Step 1: Write the failing test**

`apps/api/test/middleware.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { getDb } from "../src/db/client.js";
import { users } from "../src/db/schema.js";
import { createSession } from "../src/lib/session.js";
import { requireAuth, requireAdmin } from "../src/middleware/auth.js";
import type { AppEnv } from "../src/middleware/auth.js";

function buildApp() {
  const app = new Hono<AppEnv>();
  app.use("/protected", requireAuth);
  app.get("/protected", (c) => c.json({ id: c.get("user").id }));
  app.use("/admin", requireAuth, requireAdmin);
  app.get("/admin", (c) => c.json({ ok: true }));
  // helper route to mint a cookie for a freshly created user
  app.post("/login-as/:role", async (c) => {
    const role = c.req.param("role") as "admin" | "user";
    const db = getDb(c.env.DB);
    const id = crypto.randomUUID();
    await db.insert(users).values({
      id,
      email: `${id}@e.com`,
      passwordHash: "x",
      role,
      displayName: "T",
      createdAt: new Date(),
    });
    const { token } = await createSession(db, id);
    setCookie(c, "session", token, { httpOnly: true, path: "/" });
    return c.json({ ok: true });
  });
  return app;
}

async function cookieFor(app: ReturnType<typeof buildApp>, role: string) {
  const res = await app.request(`/login-as/${role}`, { method: "POST" }, env);
  return res.headers.get("set-cookie")!.split(";")[0];
}

describe("auth middleware", () => {
  it("rejects requests without a session", async () => {
    const app = buildApp();
    const res = await app.request("/protected", {}, env);
    expect(res.status).toBe(401);
  });

  it("allows an authenticated user", async () => {
    const app = buildApp();
    const cookie = await cookieFor(app, "user");
    const res = await app.request("/protected", { headers: { cookie } }, env);
    expect(res.status).toBe(200);
  });

  it("forbids a non-admin on admin routes", async () => {
    const app = buildApp();
    const cookie = await cookieFor(app, "user");
    const res = await app.request("/admin", { headers: { cookie } }, env);
    expect(res.status).toBe(403);
  });

  it("allows an admin on admin routes", async () => {
    const app = buildApp();
    const cookie = await cookieFor(app, "admin");
    const res = await app.request("/admin", { headers: { cookie } }, env);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @health-ready/api test middleware`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/api/src/middleware/auth.ts`**

```ts
import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { Env } from "../../worker-configuration.js";
import { getDb } from "../db/client.js";
import { validateSession, type SessionUser } from "../lib/session.js";

export const SESSION_COOKIE = "session";

export interface AppEnv {
  Bindings: Env;
  Variables: { user: SessionUser };
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const session = await validateSession(getDb(c.env.DB), token);
  if (!session) return c.json({ error: "unauthorized" }, 401);
  c.set("user", session.user);
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("user").role !== "admin") {
    return c.json({ error: "forbidden" }, 403);
  }
  await next();
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @health-ready/api test middleware`
Expected: PASS (all 4 cases).

- [ ] **Step 5: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(api): add requireAuth and requireAdmin middleware`

---

## Task 11: Auth routes (bootstrap-admin / login / logout / me)

**Files:**

- Create: `apps/api/src/routes/auth.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/test/auth.routes.test.ts`

Behavior:

- `POST /auth/bootstrap-admin` — body `{secret,email,password,displayName}`. If `secret`
  mismatches `BOOTSTRAP_SECRET` → 403. If an admin already exists → 409. Otherwise create
  an admin user → 201.
- `POST /auth/login` — body `{email,password}`. On success set the `session` cookie → 200
  with the public user. On failure → 401.
- `POST /auth/logout` — clears the cookie and revokes the session → 200.
- `GET /auth/me` — `requireAuth`; returns the current public user → 200.

- [ ] **Step 1: Write the failing test**

`apps/api/test/auth.routes.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import app from "../src/index.js";

const SECRET = "test-secret"; // matches vitest.config BOOTSTRAP_SECRET

async function bootstrap() {
  return app.request(
    "/auth/bootstrap-admin",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        secret: SECRET,
        email: "admin@e.com",
        password: "supersecret",
        displayName: "Admin",
      }),
    },
    env,
  );
}

describe("auth routes", () => {
  it("rejects bootstrap with a bad secret", async () => {
    const res = await app.request(
      "/auth/bootstrap-admin",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          secret: "wrong",
          email: "a@e.com",
          password: "supersecret",
          displayName: "A",
        }),
      },
      env,
    );
    expect(res.status).toBe(403);
  });

  it("bootstraps the first admin, then refuses a second", async () => {
    expect((await bootstrap()).status).toBe(201);
    expect((await bootstrap()).status).toBe(409);
  });

  it("logs in with correct credentials and rejects wrong ones", async () => {
    await bootstrap();
    const ok = await app.request(
      "/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "admin@e.com", password: "supersecret" }),
      },
      env,
    );
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toContain("session=");
    const body = await ok.json<{ role: string }>();
    expect(body.role).toBe("admin");

    const bad = await app.request(
      "/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "admin@e.com", password: "nope-nope" }),
      },
      env,
    );
    expect(bad.status).toBe(401);
  });

  it("returns the current user from /auth/me and 401 without a cookie", async () => {
    await bootstrap();
    const login = await app.request(
      "/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "admin@e.com", password: "supersecret" }),
      },
      env,
    );
    const cookie = login.headers.get("set-cookie")!.split(";")[0];

    const me = await app.request("/auth/me", { headers: { cookie } }, env);
    expect(me.status).toBe(200);
    expect((await me.json<{ email: string }>()).email).toBe("admin@e.com");

    const anon = await app.request("/auth/me", {}, env);
    expect(anon.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @health-ready/api test auth.routes`
Expected: FAIL — `/auth/*` routes return 404 (not yet mounted).

- [ ] **Step 3: Implement `apps/api/src/routes/auth.ts`**

```ts
import { Hono } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { loginSchema, bootstrapAdminSchema } from "@health-ready/shared";
import { getDb } from "../db/client.js";
import { users } from "../db/schema.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { createSession, revokeSession } from "../lib/session.js";
import {
  requireAuth,
  SESSION_COOKIE,
  type AppEnv,
} from "../middleware/auth.js";

// Secure is required in production (HTTPS) but must be off for local `wrangler dev`
// over http, otherwise clients (curl, browsers) won't return the cookie.
function cookieOpts(c: { req: { url: string } }) {
  return {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
  } as const;
}

export const authRoutes = new Hono<AppEnv>();

authRoutes.post(
  "/bootstrap-admin",
  zValidator("json", bootstrapAdminSchema),
  async (c) => {
    const { secret, email, password, displayName } = c.req.valid("json");
    if (secret !== c.env.BOOTSTRAP_SECRET) {
      return c.json({ error: "forbidden" }, 403);
    }
    const db = getDb(c.env.DB);
    const existingAdmin = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .get();
    if (existingAdmin) return c.json({ error: "admin already exists" }, 409);

    await db.insert(users).values({
      id: crypto.randomUUID(),
      email,
      passwordHash: await hashPassword(password),
      role: "admin",
      displayName,
      createdAt: new Date(),
    });
    return c.json({ ok: true }, 201);
  },
);

authRoutes.post("/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  const db = getDb(c.env.DB);
  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get();
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return c.json({ error: "invalid credentials" }, 401);
  }
  const { token, expiresAt } = await createSession(db, user.id);
  setCookie(c, SESSION_COOKIE, token, { ...cookieOpts(c), expires: expiresAt });
  return c.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  });
});

authRoutes.post("/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await revokeSession(getDb(c.env.DB), token);
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

authRoutes.get("/me", requireAuth, (c) => {
  const u = c.get("user");
  return c.json({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
  });
});
```

- [ ] **Step 4: Add the `@hono/zod-validator` dependency**

Run: `pnpm --filter @health-ready/api add @hono/zod-validator@^0.4.1`
Expected: dependency added.

- [ ] **Step 5: Mount the routes in `apps/api/src/index.ts`**

Replace the file contents with:

```ts
import { Hono } from "hono";
import { authRoutes } from "./routes/auth.js";
import type { AppEnv } from "./middleware/auth.js";

const app = new Hono<AppEnv>();

app.get("/health", (c) => c.json({ ok: true }));
app.route("/auth", authRoutes);

export default app;
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @health-ready/api test auth.routes`
Expected: PASS (all 4 cases).

- [ ] **Step 7: Run the full suite + typecheck**

Run: `pnpm --filter @health-ready/api test && pnpm --filter @health-ready/api typecheck`
Expected: all test files PASS; typecheck clean.

- [ ] **Step 8: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(api): add bootstrap-admin, login, logout, me auth routes`

---

## Task 12: Manual end-to-end smoke (local Worker)

**Files:** none (manual verification)

- [ ] **Step 1: Start the dev server**

Run: `pnpm --filter @health-ready/api dev`
Expected: `wrangler dev` serves on `http://localhost:8787`.

- [ ] **Step 2: Bootstrap an admin against local D1**

In a second terminal:

```bash
curl -i -X POST http://localhost:8787/auth/bootstrap-admin \
  -H 'content-type: application/json' \
  -d '{"secret":"dev-only-change-me","email":"me@example.com","password":"supersecret","displayName":"Me"}'
```

Expected: `HTTP/1.1 201`.

- [ ] **Step 3: Log in and capture the cookie**

```bash
curl -i -c cookies.txt -X POST http://localhost:8787/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"me@example.com","password":"supersecret"}'
```

Expected: `HTTP/1.1 200`, a `set-cookie: session=...` header, and a JSON body with `"role":"admin"`.

- [ ] **Step 4: Call /auth/me with the cookie**

```bash
curl -s -b cookies.txt http://localhost:8787/auth/me
```

Expected: JSON with `"email":"me@example.com"`.

- [ ] **Step 5: Clean up**

```bash
rm -f cookies.txt
```

Stop the dev server. No commit (no file changes).

---

## Phase 1 Done — Definition of Done

- `pnpm --filter @health-ready/api test` — all suites green.
- `pnpm -r typecheck` — clean.
- Local Worker boots; bootstrap → login → me works end-to-end via curl.
- Monorepo, full Drizzle schema (all 6 tables), and a tested custom auth system are in place.

Next: `phase-2-core-api.md` (exercises, workouts, copy-workout, admin user creation).
