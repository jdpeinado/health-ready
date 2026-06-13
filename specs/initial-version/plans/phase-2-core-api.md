# Phase 2: Core API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Git policy:** The user performs ALL git staging and commits. Never run `git add`/`git commit`/`git push`. Checkpoint notes mark good commit points.

**Goal:** Build the resource API on top of Phase 1's foundation: the shared exercise library with admin CRUD, full workout logging (workouts → entries → sets), copy-a-workout, and admin user creation.

**Architecture:** New Hono route modules mounted on the Phase 1 app, each guarded by `requireAuth` (and `requireAdmin` for admin-only operations). Write-heavy workout operations go through thin service functions in `src/services/` that compose multi-row writes with `db.batch(...)` (D1's atomic batch). Validation schemas live in `@health-ready/shared` so Phase 4's frontend reuses them.

**Tech Stack:** Same as Phase 1 — Hono, Drizzle ORM, D1, Zod, Vitest + `@cloudflare/vitest-pool-workers`.

**Depends on:** Phase 1 complete (schema, middleware, auth, test harness all in place).

---

## API Contract (authoritative — Phases 3 & 4 depend on these shapes)

All routes require a valid `session` cookie (`requireAuth`). Admin-only routes also require `requireAdmin`.

```
# Exercises (shared library)
GET    /exercises?includeInactive=true     → 200 Exercise[]      (includeInactive admin-only; ignored for users)
POST   /exercises            (admin)        → 201 Exercise
PATCH  /exercises/:id        (admin)        → 200 Exercise | 404
DELETE /exercises/:id        (admin)        → 200 {ok:true}       (soft delete: isActive=false)

# Workouts (scoped to the authenticated user)
GET    /workouts?from=YYYY-MM-DD&to=YYYY-MM-DD&q=text  → 200 WorkoutSummary[]  (date desc)
GET    /workouts/:id                        → 200 WorkoutDetail | 404
POST   /workouts                            → 201 WorkoutDetail | 400 (bad exerciseId)
PATCH  /workouts/:id                        → 200 WorkoutDetail | 404
DELETE /workouts/:id                        → 200 {ok:true} | 404
POST   /workouts/:id/copy                   → 201 WorkoutDetail | 404

# Admin user management
POST   /users                (admin)        → 201 PublicUser | 409 (email exists)
```

Shapes (TypeScript, returned as JSON):

```ts
type Exercise = {
  id: string; name: string; type: "strength" | "cardio" | "mobility";
  muscleGroup: string | null; isActive: boolean; createdAt: number; // epoch ms
};

type SetDetail = {
  id: string; setIndex: number; reps: number | null; weight: number | null;
  weightUnit: "kg" | "lb" | null;
  loadType: "total" | "per_side" | "per_dumbbell" | "bodyweight" | "bodyweight_added" | null;
  barWeight: number | null;
};

type EntryDetail = {
  id: string; exerciseId: string; orderIndex: number; comment: string | null;
  durationSeconds: number | null; distance: number | null; distanceUnit: string | null;
  sets: SetDetail[];
};

type WorkoutSummary = {
  id: string; date: string; name: string | null; notes: string | null;
  createdAt: number; entryCount: number;
};

type WorkoutDetail = WorkoutSummary & { entries: EntryDetail[] };

type PublicUser = { id: string; email: string; displayName: string; role: "admin" | "user" };
```

---

## Task 1: Shared schemas for exercises, workouts, users

**Files:**
- Create: `packages/shared/src/schemas/exercise.ts`
- Create: `packages/shared/src/schemas/workout.ts`
- Create: `packages/shared/src/schemas/user.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create `packages/shared/src/schemas/exercise.ts`**

```ts
import { z } from "zod";
import { exerciseTypeSchema } from "./common.js";

export const createExerciseSchema = z.object({
  name: z.string().min(1),
  type: exerciseTypeSchema,
  muscleGroup: z.string().min(1).nullish(),
});
export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;

export const updateExerciseSchema = z.object({
  name: z.string().min(1).optional(),
  type: exerciseTypeSchema.optional(),
  muscleGroup: z.string().min(1).nullish(),
  isActive: z.boolean().optional(),
});
export type UpdateExerciseInput = z.infer<typeof updateExerciseSchema>;
```

- [ ] **Step 2: Create `packages/shared/src/schemas/workout.ts`**

```ts
import { z } from "zod";
import { weightUnitSchema, loadTypeSchema } from "./common.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const setInputSchema = z.object({
  reps: z.number().int().nonnegative().nullish(),
  weight: z.number().nonnegative().nullish(),
  weightUnit: weightUnitSchema.nullish(),
  loadType: loadTypeSchema.nullish(),
  barWeight: z.number().nonnegative().nullish(),
});
export type SetInput = z.infer<typeof setInputSchema>;

export const entryInputSchema = z.object({
  exerciseId: z.string().min(1),
  comment: z.string().nullish(),
  durationSeconds: z.number().int().nonnegative().nullish(),
  distance: z.number().nonnegative().nullish(),
  distanceUnit: z.string().min(1).nullish(),
  sets: z.array(setInputSchema).default([]),
});
export type EntryInput = z.infer<typeof entryInputSchema>;

export const createWorkoutSchema = z.object({
  date: isoDate,
  name: z.string().min(1).nullish(),
  notes: z.string().nullish(),
  entries: z.array(entryInputSchema).default([]),
});
export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;

export const updateWorkoutSchema = z.object({
  date: isoDate.optional(),
  name: z.string().min(1).nullish(),
  notes: z.string().nullish(),
  entries: z.array(entryInputSchema).optional(), // when present, replaces all entries
});
export type UpdateWorkoutInput = z.infer<typeof updateWorkoutSchema>;

export const copyWorkoutSchema = z.object({ date: isoDate });
export type CopyWorkoutInput = z.infer<typeof copyWorkoutSchema>;
```

- [ ] **Step 3: Create `packages/shared/src/schemas/user.ts`**

```ts
import { z } from "zod";
import { roleSchema } from "./common.js";

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1),
  role: roleSchema.default("user"),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;
```

- [ ] **Step 4: Update `packages/shared/src/index.ts`**

```ts
export * from "./schemas/common.js";
export * from "./schemas/auth.js";
export * from "./schemas/exercise.js";
export * from "./schemas/workout.js";
export * from "./schemas/user.js";
```

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @health-ready/shared typecheck`
Expected: PASS.

- [ ] **Step 6: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(shared): add exercise, workout, user schemas`

---

## Task 2: Test helper for authenticated requests

**Files:**
- Create: `apps/api/test/helpers.ts`

This helper seeds a user directly and returns a ready-to-send `cookie` header value, so resource tests don't depend on the login route.

- [ ] **Step 1: Create `apps/api/test/helpers.ts`**

```ts
import { env } from "cloudflare:test";
import { getDb } from "../src/db/client.js";
import { users, exercises } from "../src/db/schema.js";
import { createSession } from "../src/lib/session.js";

export async function seedUser(role: "admin" | "user" = "user") {
  const db = getDb(env.DB);
  const id = crypto.randomUUID();
  await db.insert(users).values({
    id,
    email: `${id}@example.com`,
    passwordHash: "x",
    role,
    displayName: role === "admin" ? "Admin" : "User",
    createdAt: new Date(),
  });
  const { token } = await createSession(db, id);
  return { id, cookie: `session=${token}` };
}

export async function seedExercise(
  overrides: Partial<{ name: string; type: "strength" | "cardio" | "mobility"; isActive: boolean }> = {},
) {
  const db = getDb(env.DB);
  const id = crypto.randomUUID();
  await db.insert(exercises).values({
    id,
    name: overrides.name ?? "Dominada",
    type: overrides.type ?? "strength",
    muscleGroup: null,
    isActive: overrides.isActive ?? true,
    createdAt: new Date(),
  });
  return id;
}
```

- [ ] **Step 2: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `test(api): add auth/exercise seed helpers`

---

## Task 3: Exercises routes (list + admin CRUD)

**Files:**
- Create: `apps/api/src/routes/exercises.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/test/exercises.routes.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/api/test/exercises.routes.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import app from "../src/index.js";
import { seedUser } from "./helpers.js";

async function create(cookie: string, body: object) {
  return app.request(
    "/exercises",
    {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    },
    env,
  );
}

describe("exercises routes", () => {
  it("requires auth to list", async () => {
    const res = await app.request("/exercises", {}, env);
    expect(res.status).toBe(401);
  });

  it("forbids non-admin from creating", async () => {
    const { cookie } = await seedUser("user");
    const res = await create(cookie, { name: "Press", type: "strength" });
    expect(res.status).toBe(403);
  });

  it("admin creates, everyone lists active only", async () => {
    const admin = await seedUser("admin");
    const created = await create(admin.cookie, { name: "Press banca", type: "strength" });
    expect(created.status).toBe(201);
    const ex = await created.json<{ id: string; isActive: boolean }>();
    expect(ex.isActive).toBe(true);

    const user = await seedUser("user");
    const list = await app.request("/exercises", { headers: { cookie: user.cookie } }, env);
    expect(list.status).toBe(200);
    const items = await list.json<Array<{ id: string }>>();
    expect(items.some((i) => i.id === ex.id)).toBe(true);
  });

  it("admin updates and soft-deletes; soft-deleted hidden from users", async () => {
    const admin = await seedUser("admin");
    const created = await create(admin.cookie, { name: "Temp", type: "cardio" });
    const ex = await created.json<{ id: string }>();

    const patched = await app.request(
      `/exercises/${ex.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: admin.cookie },
        body: JSON.stringify({ name: "Caminar" }),
      },
      env,
    );
    expect(patched.status).toBe(200);
    expect((await patched.json<{ name: string }>()).name).toBe("Caminar");

    const del = await app.request(
      `/exercises/${ex.id}`,
      { method: "DELETE", headers: { cookie: admin.cookie } },
      env,
    );
    expect(del.status).toBe(200);

    const user = await seedUser("user");
    const list = await app.request("/exercises", { headers: { cookie: user.cookie } }, env);
    const items = await list.json<Array<{ id: string }>>();
    expect(items.some((i) => i.id === ex.id)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @health-ready/api test exercises.routes`
Expected: FAIL — `/exercises` routes 404.

- [ ] **Step 3: Implement `apps/api/src/routes/exercises.ts`**

```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { createExerciseSchema, updateExerciseSchema } from "@health-ready/shared";
import { getDb } from "../db/client.js";
import { exercises } from "../db/schema.js";
import { requireAuth, requireAdmin, type AppEnv } from "../middleware/auth.js";

function serialize(row: typeof exercises.$inferSelect) {
  return { ...row, createdAt: row.createdAt.getTime() };
}

export const exerciseRoutes = new Hono<AppEnv>();

exerciseRoutes.use("*", requireAuth);

exerciseRoutes.get("/", async (c) => {
  const db = getDb(c.env.DB);
  const isAdmin = c.get("user").role === "admin";
  const includeInactive =
    isAdmin && c.req.query("includeInactive") === "true";
  const rows = includeInactive
    ? await db.select().from(exercises)
    : await db.select().from(exercises).where(eq(exercises.isActive, true));
  return c.json(rows.map(serialize));
});

exerciseRoutes.post(
  "/",
  requireAdmin,
  zValidator("json", createExerciseSchema),
  async (c) => {
    const input = c.req.valid("json");
    const db = getDb(c.env.DB);
    const row = {
      id: crypto.randomUUID(),
      name: input.name,
      type: input.type,
      muscleGroup: input.muscleGroup ?? null,
      isActive: true,
      createdAt: new Date(),
    };
    await db.insert(exercises).values(row);
    return c.json(serialize(row), 201);
  },
);

exerciseRoutes.patch(
  "/:id",
  requireAdmin,
  zValidator("json", updateExerciseSchema),
  async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    const db = getDb(c.env.DB);
    const patch: Partial<typeof exercises.$inferInsert> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.type !== undefined) patch.type = input.type;
    if (input.muscleGroup !== undefined) patch.muscleGroup = input.muscleGroup ?? null;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    if (Object.keys(patch).length > 0) {
      await db.update(exercises).set(patch).where(eq(exercises.id, id));
    }
    const row = await db.select().from(exercises).where(eq(exercises.id, id)).get();
    if (!row) return c.json({ error: "not found" }, 404);
    return c.json(serialize(row));
  },
);

exerciseRoutes.delete("/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const db = getDb(c.env.DB);
  const row = await db.select().from(exercises).where(eq(exercises.id, id)).get();
  if (!row) return c.json({ error: "not found" }, 404);
  await db.update(exercises).set({ isActive: false }).where(eq(exercises.id, id));
  return c.json({ ok: true });
});
```

- [ ] **Step 4: Mount in `apps/api/src/index.ts`**

Add the import and route. The file becomes:

```ts
import { Hono } from "hono";
import { authRoutes } from "./routes/auth.js";
import { exerciseRoutes } from "./routes/exercises.js";
import type { AppEnv } from "./middleware/auth.js";

const app = new Hono<AppEnv>();

app.get("/health", (c) => c.json({ ok: true }));
app.route("/auth", authRoutes);
app.route("/exercises", exerciseRoutes);

export default app;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @health-ready/api test exercises.routes`
Expected: PASS (all 4 cases).

- [ ] **Step 6: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(api): add exercises list + admin CRUD`

---

## Task 4: Workout service (create / get / list helpers)

**Files:**
- Create: `apps/api/src/services/workouts.ts`
- Test: `apps/api/test/workouts.service.test.ts`

The service holds the multi-row write/read logic so routes stay thin. `createWorkout`
uses `db.batch(...)` so the workout + entries + sets are written atomically.

- [ ] **Step 1: Write the failing test**

`apps/api/test/workouts.service.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { getDb } from "../src/db/client.js";
import {
  createWorkout,
  getWorkout,
  listWorkouts,
  validateExerciseIds,
} from "../src/services/workouts.js";
import { seedUser, seedExercise } from "./helpers.js";

describe("workout service", () => {
  it("creates a workout with entries and sets, then reads it back nested", async () => {
    const db = getDb(env.DB);
    const { id: userId } = await seedUser();
    const exId = await seedExercise({ name: "Press banca" });

    const workoutId = await createWorkout(db, userId, {
      date: "2026-05-02",
      name: "Rutina 3",
      notes: null,
      entries: [
        {
          exerciseId: exId,
          comment: "felt good",
          durationSeconds: null,
          distance: null,
          distanceUnit: null,
          sets: [
            { reps: 10, weight: 57, weightUnit: "kg", loadType: "total", barWeight: null },
            { reps: 10, weight: 57, weightUnit: "kg", loadType: "total", barWeight: null },
          ],
        },
      ],
    });

    const detail = await getWorkout(db, userId, workoutId);
    expect(detail?.name).toBe("Rutina 3");
    expect(detail?.entries).toHaveLength(1);
    expect(detail?.entries[0].sets).toHaveLength(2);
    expect(detail?.entries[0].sets[0].setIndex).toBe(0);
    expect(detail?.entryCount).toBe(1);
  });

  it("scopes getWorkout to the owner", async () => {
    const db = getDb(env.DB);
    const owner = await seedUser();
    const other = await seedUser();
    const exId = await seedExercise();
    const id = await createWorkout(db, owner.id, {
      date: "2026-05-02", name: null, notes: null,
      entries: [{ exerciseId: exId, comment: null, durationSeconds: null, distance: null, distanceUnit: null, sets: [] }],
    });
    expect(await getWorkout(db, other.id, id)).toBeNull();
  });

  it("lists a user's workouts newest first and filters by date range", async () => {
    const db = getDb(env.DB);
    const { id: userId } = await seedUser();
    const exId = await seedExercise();
    const mk = (date: string) =>
      createWorkout(db, userId, { date, name: null, notes: null, entries: [{ exerciseId: exId, comment: null, durationSeconds: null, distance: null, distanceUnit: null, sets: [] }] });
    await mk("2026-05-01");
    await mk("2026-05-10");
    await mk("2026-05-20");

    const all = await listWorkouts(db, userId, {});
    expect(all.map((w) => w.date)).toEqual(["2026-05-20", "2026-05-10", "2026-05-01"]);

    const ranged = await listWorkouts(db, userId, { from: "2026-05-05", to: "2026-05-15" });
    expect(ranged.map((w) => w.date)).toEqual(["2026-05-10"]);
  });

  it("validateExerciseIds returns missing ids", async () => {
    const db = getDb(env.DB);
    const exId = await seedExercise();
    expect(await validateExerciseIds(db, [exId])).toEqual([]);
    expect(await validateExerciseIds(db, [exId, "nope"])).toEqual(["nope"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @health-ready/api test workouts.service`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/api/src/services/workouts.ts`**

```ts
import { and, desc, eq, gte, inArray, lte, like } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { workouts, workoutEntries, sets, exercises } from "../db/schema.js";
import type {
  CreateWorkoutInput,
  UpdateWorkoutInput,
} from "@health-ready/shared";

export async function validateExerciseIds(db: Db, ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const found = await db
    .select({ id: exercises.id })
    .from(exercises)
    .where(inArray(exercises.id, unique));
  const foundSet = new Set(found.map((r) => r.id));
  return unique.filter((id) => !foundSet.has(id));
}

function buildInserts(workoutId: string, userId: string, input: CreateWorkoutInput) {
  const workoutRow = {
    id: workoutId,
    userId,
    date: input.date,
    name: input.name ?? null,
    notes: input.notes ?? null,
    createdAt: new Date(),
  };
  const entryRows: (typeof workoutEntries.$inferInsert)[] = [];
  const setRows: (typeof sets.$inferInsert)[] = [];
  input.entries.forEach((entry, i) => {
    const entryId = crypto.randomUUID();
    entryRows.push({
      id: entryId,
      workoutId,
      exerciseId: entry.exerciseId,
      orderIndex: i,
      comment: entry.comment ?? null,
      durationSeconds: entry.durationSeconds ?? null,
      distance: entry.distance ?? null,
      distanceUnit: entry.distanceUnit ?? null,
    });
    entry.sets.forEach((s, j) => {
      setRows.push({
        id: crypto.randomUUID(),
        entryId,
        setIndex: j,
        reps: s.reps ?? null,
        weight: s.weight ?? null,
        weightUnit: s.weightUnit ?? null,
        loadType: s.loadType ?? null,
        barWeight: s.barWeight ?? null,
      });
    });
  });
  return { workoutRow, entryRows, setRows };
}

export async function createWorkout(
  db: Db,
  userId: string,
  input: CreateWorkoutInput,
): Promise<string> {
  const workoutId = crypto.randomUUID();
  const { workoutRow, entryRows, setRows } = buildInserts(workoutId, userId, input);
  const stmts = [db.insert(workouts).values(workoutRow)];
  if (entryRows.length) stmts.push(db.insert(workoutEntries).values(entryRows));
  if (setRows.length) stmts.push(db.insert(sets).values(setRows));
  await db.batch(stmts as [(typeof stmts)[number], ...(typeof stmts)[number][]]);
  return workoutId;
}

export interface SetDetail {
  id: string; setIndex: number; reps: number | null; weight: number | null;
  weightUnit: "kg" | "lb" | null;
  loadType: "total" | "per_side" | "per_dumbbell" | "bodyweight" | "bodyweight_added" | null;
  barWeight: number | null;
}
export interface EntryDetail {
  id: string; exerciseId: string; orderIndex: number; comment: string | null;
  durationSeconds: number | null; distance: number | null; distanceUnit: string | null;
  sets: SetDetail[];
}
export interface WorkoutSummary {
  id: string; date: string; name: string | null; notes: string | null;
  createdAt: number; entryCount: number;
}
export type WorkoutDetail = WorkoutSummary & { entries: EntryDetail[] };

export async function getWorkout(
  db: Db,
  userId: string,
  workoutId: string,
): Promise<WorkoutDetail | null> {
  const w = await db
    .select()
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .get();
  if (!w) return null;

  const entryRows = await db
    .select()
    .from(workoutEntries)
    .where(eq(workoutEntries.workoutId, workoutId))
    .orderBy(workoutEntries.orderIndex);

  const entryIds = entryRows.map((e) => e.id);
  const setRows = entryIds.length
    ? await db.select().from(sets).where(inArray(sets.entryId, entryIds)).orderBy(sets.setIndex)
    : [];

  const setsByEntry = new Map<string, SetDetail[]>();
  for (const s of setRows) {
    const list = setsByEntry.get(s.entryId) ?? [];
    list.push({
      id: s.id, setIndex: s.setIndex, reps: s.reps, weight: s.weight,
      weightUnit: s.weightUnit, loadType: s.loadType, barWeight: s.barWeight,
    });
    setsByEntry.set(s.entryId, list);
  }

  const entries: EntryDetail[] = entryRows.map((e) => ({
    id: e.id, exerciseId: e.exerciseId, orderIndex: e.orderIndex, comment: e.comment,
    durationSeconds: e.durationSeconds, distance: e.distance, distanceUnit: e.distanceUnit,
    sets: setsByEntry.get(e.id) ?? [],
  }));

  return {
    id: w.id, date: w.date, name: w.name, notes: w.notes,
    createdAt: w.createdAt.getTime(), entryCount: entries.length, entries,
  };
}

export interface ListFilters { from?: string; to?: string; q?: string }

export async function listWorkouts(
  db: Db,
  userId: string,
  filters: ListFilters,
): Promise<WorkoutSummary[]> {
  const conds = [eq(workouts.userId, userId)];
  if (filters.from) conds.push(gte(workouts.date, filters.from));
  if (filters.to) conds.push(lte(workouts.date, filters.to));
  if (filters.q) conds.push(like(workouts.name, `%${filters.q}%`));

  const rows = await db
    .select()
    .from(workouts)
    .where(and(...conds))
    .orderBy(desc(workouts.date), desc(workouts.createdAt));

  if (rows.length === 0) return [];

  const counts = await db
    .select({ workoutId: workoutEntries.workoutId })
    .from(workoutEntries)
    .where(inArray(workoutEntries.workoutId, rows.map((r) => r.id)));
  const countByWorkout = new Map<string, number>();
  for (const r of counts) {
    countByWorkout.set(r.workoutId, (countByWorkout.get(r.workoutId) ?? 0) + 1);
  }

  return rows.map((w) => ({
    id: w.id, date: w.date, name: w.name, notes: w.notes,
    createdAt: w.createdAt.getTime(), entryCount: countByWorkout.get(w.id) ?? 0,
  }));
}

export async function replaceWorkout(
  db: Db,
  userId: string,
  workoutId: string,
  input: UpdateWorkoutInput,
): Promise<boolean> {
  const existing = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .get();
  if (!existing) return false;

  const patch: Partial<typeof workouts.$inferInsert> = {};
  if (input.date !== undefined) patch.date = input.date;
  if (input.name !== undefined) patch.name = input.name ?? null;
  if (input.notes !== undefined) patch.notes = input.notes ?? null;

  const stmts: any[] = [];
  if (Object.keys(patch).length > 0) {
    stmts.push(db.update(workouts).set(patch).where(eq(workouts.id, workoutId)));
  }
  if (input.entries !== undefined) {
    // Deleting entries cascades to their sets.
    stmts.push(db.delete(workoutEntries).where(eq(workoutEntries.workoutId, workoutId)));
    const { entryRows, setRows } = buildInserts(workoutId, userId, {
      date: input.date ?? "2000-01-01", entries: input.entries,
    } as CreateWorkoutInput);
    if (entryRows.length) stmts.push(db.insert(workoutEntries).values(entryRows));
    if (setRows.length) stmts.push(db.insert(sets).values(setRows));
  }
  if (stmts.length > 0) {
    await db.batch(stmts as [any, ...any[]]);
  }
  return true;
}

export async function deleteWorkout(
  db: Db,
  userId: string,
  workoutId: string,
): Promise<boolean> {
  const existing = await db
    .select({ id: workouts.id })
    .from(workouts)
    .where(and(eq(workouts.id, workoutId), eq(workouts.userId, userId)))
    .get();
  if (!existing) return false;
  await db.delete(workouts).where(eq(workouts.id, workoutId)); // cascades
  return true;
}

export async function copyWorkout(
  db: Db,
  userId: string,
  sourceId: string,
  newDate: string,
): Promise<string | null> {
  const source = await getWorkout(db, userId, sourceId);
  if (!source) return null;
  return createWorkout(db, userId, {
    date: newDate,
    name: source.name,
    notes: source.notes,
    entries: source.entries.map((e) => ({
      exerciseId: e.exerciseId,
      comment: e.comment,
      durationSeconds: e.durationSeconds,
      distance: e.distance,
      distanceUnit: e.distanceUnit,
      sets: e.sets.map((s) => ({
        reps: s.reps, weight: s.weight, weightUnit: s.weightUnit,
        loadType: s.loadType, barWeight: s.barWeight,
      })),
    })),
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @health-ready/api test workouts.service`
Expected: PASS (all 4 cases).

- [ ] **Step 5: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(api): add workout service (create/get/list/replace/copy)`

---

## Task 5: Workout routes (CRUD + copy)

**Files:**
- Create: `apps/api/src/routes/workouts.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/test/workouts.routes.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/api/test/workouts.routes.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import app from "../src/index.js";
import { seedUser, seedExercise } from "./helpers.js";

function body(exId: string, date = "2026-05-02") {
  return {
    date, name: "Pull day", notes: null,
    entries: [
      { exerciseId: exId, sets: [{ reps: 6, weight: 0, loadType: "bodyweight" }] },
    ],
  };
}

async function post(cookie: string, b: object) {
  return app.request(
    "/workouts",
    { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(b) },
    env,
  );
}

describe("workouts routes", () => {
  it("requires auth", async () => {
    expect((await app.request("/workouts", {}, env)).status).toBe(401);
  });

  it("creates and fetches a workout", async () => {
    const { cookie } = await seedUser();
    const exId = await seedExercise();
    const created = await post(cookie, body(exId));
    expect(created.status).toBe(201);
    const w = await created.json<{ id: string; entries: unknown[] }>();
    expect(w.entries).toHaveLength(1);

    const got = await app.request(`/workouts/${w.id}`, { headers: { cookie } }, env);
    expect(got.status).toBe(200);
  });

  it("rejects a workout with an unknown exerciseId (400)", async () => {
    const { cookie } = await seedUser();
    const res = await post(cookie, body("does-not-exist"));
    expect(res.status).toBe(400);
  });

  it("does not leak another user's workout (404)", async () => {
    const owner = await seedUser();
    const other = await seedUser();
    const exId = await seedExercise();
    const created = await post(owner.cookie, body(exId));
    const w = await created.json<{ id: string }>();
    const got = await app.request(`/workouts/${w.id}`, { headers: { cookie: other.cookie } }, env);
    expect(got.status).toBe(404);
  });

  it("lists, updates, copies, and deletes", async () => {
    const { cookie } = await seedUser();
    const exId = await seedExercise();
    const created = await post(cookie, body(exId, "2026-05-02"));
    const w = await created.json<{ id: string }>();

    const list = await app.request("/workouts", { headers: { cookie } }, env);
    expect((await list.json<unknown[]>()).length).toBe(1);

    const patched = await app.request(
      `/workouts/${w.id}`,
      { method: "PATCH", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ name: "Pull A" }) },
      env,
    );
    expect(patched.status).toBe(200);
    expect((await patched.json<{ name: string }>()).name).toBe("Pull A");

    const copied = await app.request(
      `/workouts/${w.id}/copy`,
      { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ date: "2026-05-09" }) },
      env,
    );
    expect(copied.status).toBe(201);
    const copy = await copied.json<{ id: string; date: string }>();
    expect(copy.date).toBe("2026-05-09");
    expect(copy.id).not.toBe(w.id);

    const del = await app.request(`/workouts/${w.id}`, { method: "DELETE", headers: { cookie } }, env);
    expect(del.status).toBe(200);
    const after = await app.request("/workouts", { headers: { cookie } }, env);
    expect((await after.json<unknown[]>()).length).toBe(1); // only the copy remains
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @health-ready/api test workouts.routes`
Expected: FAIL — `/workouts` routes 404.

- [ ] **Step 3: Implement `apps/api/src/routes/workouts.ts`**

```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createWorkoutSchema,
  updateWorkoutSchema,
  copyWorkoutSchema,
} from "@health-ready/shared";
import { getDb } from "../db/client.js";
import { requireAuth, type AppEnv } from "../middleware/auth.js";
import {
  createWorkout,
  getWorkout,
  listWorkouts,
  replaceWorkout,
  deleteWorkout,
  copyWorkout,
  validateExerciseIds,
} from "../services/workouts.js";

export const workoutRoutes = new Hono<AppEnv>();

workoutRoutes.use("*", requireAuth);

workoutRoutes.get("/", async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get("user").id;
  const rows = await listWorkouts(db, userId, {
    from: c.req.query("from"),
    to: c.req.query("to"),
    q: c.req.query("q"),
  });
  return c.json(rows);
});

workoutRoutes.get("/:id", async (c) => {
  const db = getDb(c.env.DB);
  const detail = await getWorkout(db, c.get("user").id, c.req.param("id"));
  if (!detail) return c.json({ error: "not found" }, 404);
  return c.json(detail);
});

workoutRoutes.post("/", zValidator("json", createWorkoutSchema), async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get("user").id;
  const input = c.req.valid("json");
  const missing = await validateExerciseIds(db, input.entries.map((e) => e.exerciseId));
  if (missing.length) return c.json({ error: "unknown exerciseId", missing }, 400);
  const id = await createWorkout(db, userId, input);
  const detail = await getWorkout(db, userId, id);
  return c.json(detail, 201);
});

workoutRoutes.patch("/:id", zValidator("json", updateWorkoutSchema), async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get("user").id;
  const id = c.req.param("id");
  const input = c.req.valid("json");
  if (input.entries) {
    const missing = await validateExerciseIds(db, input.entries.map((e) => e.exerciseId));
    if (missing.length) return c.json({ error: "unknown exerciseId", missing }, 400);
  }
  const ok = await replaceWorkout(db, userId, id, input);
  if (!ok) return c.json({ error: "not found" }, 404);
  return c.json(await getWorkout(db, userId, id));
});

workoutRoutes.delete("/:id", async (c) => {
  const db = getDb(c.env.DB);
  const ok = await deleteWorkout(db, c.get("user").id, c.req.param("id"));
  if (!ok) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});

workoutRoutes.post("/:id/copy", zValidator("json", copyWorkoutSchema), async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get("user").id;
  const newId = await copyWorkout(db, userId, c.req.param("id"), c.req.valid("json").date);
  if (!newId) return c.json({ error: "not found" }, 404);
  return c.json(await getWorkout(db, userId, newId), 201);
});
```

- [ ] **Step 4: Mount in `apps/api/src/index.ts`**

```ts
import { Hono } from "hono";
import { authRoutes } from "./routes/auth.js";
import { exerciseRoutes } from "./routes/exercises.js";
import { workoutRoutes } from "./routes/workouts.js";
import type { AppEnv } from "./middleware/auth.js";

const app = new Hono<AppEnv>();

app.get("/health", (c) => c.json({ ok: true }));
app.route("/auth", authRoutes);
app.route("/exercises", exerciseRoutes);
app.route("/workouts", workoutRoutes);

export default app;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @health-ready/api test workouts.routes`
Expected: PASS (all 5 cases).

- [ ] **Step 6: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(api): add workouts CRUD + copy routes`

---

## Task 6: Admin user creation route

**Files:**
- Create: `apps/api/src/routes/users.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/test/users.routes.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/api/test/users.routes.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import app from "../src/index.js";
import { seedUser } from "./helpers.js";

async function createUser(cookie: string, body: object) {
  return app.request(
    "/users",
    { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) },
    env,
  );
}

describe("users routes", () => {
  it("forbids non-admins", async () => {
    const { cookie } = await seedUser("user");
    const res = await createUser(cookie, { email: "f@e.com", password: "supersecret", displayName: "F" });
    expect(res.status).toBe(403);
  });

  it("admin creates a user (201) and rejects duplicate email (409)", async () => {
    const admin = await seedUser("admin");
    const first = await createUser(admin.cookie, { email: "friend@e.com", password: "supersecret", displayName: "Friend" });
    expect(first.status).toBe(201);
    const pub = await first.json<{ role: string; email: string }>();
    expect(pub.role).toBe("user");
    expect(pub.email).toBe("friend@e.com");

    const dup = await createUser(admin.cookie, { email: "friend@e.com", password: "supersecret", displayName: "Friend2" });
    expect(dup.status).toBe(409);
  });

  it("created user can log in", async () => {
    const admin = await seedUser("admin");
    await createUser(admin.cookie, { email: "login@e.com", password: "supersecret", displayName: "L" });
    const login = await app.request(
      "/auth/login",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "login@e.com", password: "supersecret" }) },
      env,
    );
    expect(login.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @health-ready/api test users.routes`
Expected: FAIL — `/users` 404.

- [ ] **Step 3: Implement `apps/api/src/routes/users.ts`**

```ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { createUserSchema } from "@health-ready/shared";
import { getDb } from "../db/client.js";
import { users } from "../db/schema.js";
import { hashPassword } from "../lib/password.js";
import { requireAuth, requireAdmin, type AppEnv } from "../middleware/auth.js";

export const userRoutes = new Hono<AppEnv>();

userRoutes.use("*", requireAuth, requireAdmin);

userRoutes.post("/", zValidator("json", createUserSchema), async (c) => {
  const { email, password, displayName, role } = c.req.valid("json");
  const db = getDb(c.env.DB);
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
  if (existing) return c.json({ error: "email already exists" }, 409);

  const id = crypto.randomUUID();
  await db.insert(users).values({
    id,
    email,
    passwordHash: await hashPassword(password),
    role,
    displayName,
    createdAt: new Date(),
  });
  return c.json({ id, email, displayName, role }, 201);
});
```

- [ ] **Step 4: Mount in `apps/api/src/index.ts`**

```ts
import { Hono } from "hono";
import { authRoutes } from "./routes/auth.js";
import { exerciseRoutes } from "./routes/exercises.js";
import { workoutRoutes } from "./routes/workouts.js";
import { userRoutes } from "./routes/users.js";
import type { AppEnv } from "./middleware/auth.js";

const app = new Hono<AppEnv>();

app.get("/health", (c) => c.json({ ok: true }));
app.route("/auth", authRoutes);
app.route("/exercises", exerciseRoutes);
app.route("/workouts", workoutRoutes);
app.route("/users", userRoutes);

export default app;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @health-ready/api test users.routes`
Expected: PASS (all 3 cases).

- [ ] **Step 6: Run the full suite + typecheck**

Run: `pnpm --filter @health-ready/api test && pnpm --filter @health-ready/api typecheck`
Expected: every test file PASS; typecheck clean.

- [ ] **Step 7: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(api): add admin user creation route`

---

## Phase 2 Done — Definition of Done

- All Phase 2 test suites green; `pnpm -r typecheck` clean.
- Exercise library with admin CRUD + soft delete works; users see active only.
- Workouts can be created (with nested entries/sets), read, listed/filtered, updated (full entry replace), copied, and deleted — all scoped to the owner.
- Unknown `exerciseId` is rejected with 400.
- Admin can create accounts (409 on duplicate email); created users can log in.

Next: `phase-3-progress.md` (canonical load computation + progress endpoint).
