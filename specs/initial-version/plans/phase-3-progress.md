# Phase 3: Progress — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Git policy:** The user performs ALL git staging and commits. Never run `git add`/`git commit`/`git push`. Checkpoint notes mark good commit points.

**Goal:** Turn logged workouts into per-exercise progress time series for charting: a pure, unit-normalizing load-computation helper (shared with the frontend) plus a `GET /progress/exercises/:id` endpoint.

**Architecture:** A pure `computeTotalLoadKg` helper in `@health-ready/shared` (reused by both the API and Phase 4's charts) normalizes mixed kg/lb loads into a single canonical kg figure. A progress service aggregates a user's sets/entries for one exercise into per-workout points; a thin route exposes it.

**Tech Stack:** Same as Phases 1–2.

**Depends on:** Phase 2 complete (workouts/entries/sets and the exercise library exist).

---

## API Contract (authoritative — Phase 4 charts depend on this)

```
GET /progress/exercises/:id   (requireAuth)   → 200 ExerciseProgress | 404 (unknown exercise)
```

```ts
type ProgressPoint = {
  date: string;                  // YYYY-MM-DD
  workoutId: string;
  bestTotalLoadKg: number | null;  // heaviest single set, normalized to kg (strength)
  totalVolumeKg: number | null;    // sum over sets of totalLoadKg * reps (strength)
  topReps: number | null;          // most reps in any set (drives bodyweight progress)
  maxDurationSeconds: number | null; // cardio
  totalDistance: number | null;      // cardio (sum of entry distances on that day)
};

type ExerciseProgress = {
  exerciseId: string;
  type: "strength" | "cardio" | "mobility";
  points: ProgressPoint[]; // ascending by date — ready to plot
};
```

Notes:
- Loads are normalized to **kg** (1 lb = 0.45359237 kg) so mixed-unit logging charts cleanly.
- **Bodyweight** sets contribute `null` to load/volume; their progression is `topReps`.
- **Mobility** exercises return `type: "mobility"` with points carrying only dates (all metrics null) — the frontend simply won't chart them.

---

## Task 1: Canonical load computation helper (shared)

**Files:**
- Create: `packages/shared/src/load.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `apps/api/test/load.test.ts` (tested from the api package, which already has Vitest configured; the helper is pure so it needs no Workers bindings)

- [ ] **Step 1: Write the failing test**

`apps/api/test/load.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toKg, computeTotalLoadKg } from "@health-ready/shared";

describe("computeTotalLoadKg", () => {
  it("converts lb to kg", () => {
    expect(toKg(100, "lb")).toBeCloseTo(45.359237, 5);
    expect(toKg(50, "kg")).toBe(50);
  });

  it("total load is the weight as-is", () => {
    expect(computeTotalLoadKg({ weight: 57, weightUnit: "kg", loadType: "total", barWeight: null })).toBe(57);
  });

  it("per_side doubles and adds bar weight", () => {
    expect(
      computeTotalLoadKg({ weight: 25, weightUnit: "kg", loadType: "per_side", barWeight: 20 }),
    ).toBe(70);
  });

  it("per_dumbbell doubles", () => {
    expect(
      computeTotalLoadKg({ weight: 50, weightUnit: "lb", loadType: "per_dumbbell", barWeight: null }),
    ).toBeCloseTo(45.359237, 4);
  });

  it("bodyweight has no load", () => {
    expect(
      computeTotalLoadKg({ weight: null, weightUnit: null, loadType: "bodyweight", barWeight: null }),
    ).toBeNull();
  });

  it("bodyweight_added is the added weight", () => {
    expect(
      computeTotalLoadKg({ weight: 5, weightUnit: "kg", loadType: "bodyweight_added", barWeight: null }),
    ).toBe(5);
  });

  it("returns null when load is unspecified", () => {
    expect(computeTotalLoadKg({ weight: null, weightUnit: null, loadType: null, barWeight: null })).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @health-ready/api test load`
Expected: FAIL — `toKg`/`computeTotalLoadKg` are not exported.

- [ ] **Step 3: Create `packages/shared/src/load.ts`**

```ts
import type { LoadType, WeightUnit } from "./schemas/common.js";

const LB_TO_KG = 0.45359237;

export function toKg(weight: number, unit: WeightUnit | null): number {
  return unit === "lb" ? weight * LB_TO_KG : weight;
}

export interface LoadInput {
  weight: number | null;
  weightUnit: WeightUnit | null;
  loadType: LoadType | null;
  barWeight: number | null;
}

// Canonical total external load in kg. Returns null for bodyweight-only work
// (whose progression is reps, not load) or when load is unspecified.
export function computeTotalLoadKg(set: LoadInput): number | null {
  if (set.loadType === "bodyweight") return null;
  if (set.weight == null || set.loadType == null) return null;
  const w = toKg(set.weight, set.weightUnit);
  const bar = set.barWeight != null ? toKg(set.barWeight, set.weightUnit) : 0;
  switch (set.loadType) {
    case "total":
      return w;
    case "per_side":
      return w * 2 + bar;
    case "per_dumbbell":
      return w * 2;
    case "bodyweight_added":
      return w;
    default:
      return null;
  }
}
```

- [ ] **Step 4: Update `packages/shared/src/index.ts`**

Append the load export:

```ts
export * from "./schemas/common.js";
export * from "./schemas/auth.js";
export * from "./schemas/exercise.js";
export * from "./schemas/workout.js";
export * from "./schemas/user.js";
export * from "./load.js";
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @health-ready/api test load`
Expected: PASS (all 7 cases).

- [ ] **Step 6: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(shared): add canonical load computation helper`

---

## Task 2: Progress service

**Files:**
- Create: `apps/api/src/services/progress.ts`
- Test: `apps/api/test/progress.service.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/api/test/progress.service.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { getDb } from "../src/db/client.js";
import { createWorkout } from "../src/services/workouts.js";
import { getExerciseProgress } from "../src/services/progress.js";
import { seedUser, seedExercise } from "./helpers.js";

describe("getExerciseProgress", () => {
  it("returns null for an unknown exercise", async () => {
    const db = getDb(env.DB);
    const { id: userId } = await seedUser();
    expect(await getExerciseProgress(db, userId, "nope")).toBeNull();
  });

  it("builds ascending strength points with best load, volume, and top reps", async () => {
    const db = getDb(env.DB);
    const { id: userId } = await seedUser();
    const exId = await seedExercise({ name: "Press banca", type: "strength" });

    await createWorkout(db, userId, {
      date: "2026-05-08", name: null, notes: null,
      entries: [{
        exerciseId: exId, comment: null, durationSeconds: null, distance: null, distanceUnit: null,
        sets: [
          { reps: 10, weight: 50, weightUnit: "kg", loadType: "total", barWeight: null },
          { reps: 8, weight: 60, weightUnit: "kg", loadType: "total", barWeight: null },
        ],
      }],
    });
    await createWorkout(db, userId, {
      date: "2026-05-02", name: null, notes: null,
      entries: [{
        exerciseId: exId, comment: null, durationSeconds: null, distance: null, distanceUnit: null,
        sets: [{ reps: 10, weight: 40, weightUnit: "kg", loadType: "total", barWeight: null }],
      }],
    });

    const progress = await getExerciseProgress(db, userId, exId);
    expect(progress?.type).toBe("strength");
    expect(progress?.points.map((p) => p.date)).toEqual(["2026-05-02", "2026-05-08"]); // ascending
    const last = progress!.points[1];
    expect(last.bestTotalLoadKg).toBe(60);
    expect(last.totalVolumeKg).toBe(50 * 10 + 60 * 8); // 980
    expect(last.topReps).toBe(10);
  });

  it("uses top reps for bodyweight exercises (no load)", async () => {
    const db = getDb(env.DB);
    const { id: userId } = await seedUser();
    const exId = await seedExercise({ name: "Dominada", type: "strength" });
    await createWorkout(db, userId, {
      date: "2026-05-05", name: null, notes: null,
      entries: [{
        exerciseId: exId, comment: null, durationSeconds: null, distance: null, distanceUnit: null,
        sets: [
          { reps: 6, weight: null, weightUnit: null, loadType: "bodyweight", barWeight: null },
          { reps: 7, weight: null, weightUnit: null, loadType: "bodyweight", barWeight: null },
        ],
      }],
    });
    const progress = await getExerciseProgress(db, userId, exId);
    expect(progress?.points[0].bestTotalLoadKg).toBeNull();
    expect(progress?.points[0].topReps).toBe(7);
  });

  it("aggregates cardio duration and distance", async () => {
    const db = getDb(env.DB);
    const { id: userId } = await seedUser();
    const exId = await seedExercise({ name: "Caminar", type: "cardio" });
    await createWorkout(db, userId, {
      date: "2026-05-05", name: null, notes: null,
      entries: [{
        exerciseId: exId, comment: null, durationSeconds: 1800, distance: 3, distanceUnit: "km",
        sets: [],
      }],
    });
    const progress = await getExerciseProgress(db, userId, exId);
    expect(progress?.type).toBe("cardio");
    expect(progress?.points[0].maxDurationSeconds).toBe(1800);
    expect(progress?.points[0].totalDistance).toBe(3);
  });

  it("scopes to the requesting user", async () => {
    const db = getDb(env.DB);
    const owner = await seedUser();
    const other = await seedUser();
    const exId = await seedExercise({ type: "strength" });
    await createWorkout(db, owner.id, {
      date: "2026-05-05", name: null, notes: null,
      entries: [{ exerciseId: exId, comment: null, durationSeconds: null, distance: null, distanceUnit: null, sets: [{ reps: 5, weight: 100, weightUnit: "kg", loadType: "total", barWeight: null }] }],
    });
    const progress = await getExerciseProgress(db, other.id, exId);
    expect(progress?.points).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @health-ready/api test progress.service`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `apps/api/src/services/progress.ts`**

```ts
import { and, eq, inArray, asc } from "drizzle-orm";
import { computeTotalLoadKg } from "@health-ready/shared";
import type { ExerciseType } from "@health-ready/shared";
import type { Db } from "../db/client.js";
import { exercises, workouts, workoutEntries, sets } from "../db/schema.js";

export interface ProgressPoint {
  date: string;
  workoutId: string;
  bestTotalLoadKg: number | null;
  totalVolumeKg: number | null;
  topReps: number | null;
  maxDurationSeconds: number | null;
  totalDistance: number | null;
}

export interface ExerciseProgress {
  exerciseId: string;
  type: ExerciseType;
  points: ProgressPoint[];
}

interface Accumulator {
  date: string;
  workoutId: string;
  bestTotalLoadKg: number | null;
  totalVolumeKg: number | null;
  topReps: number | null;
  maxDurationSeconds: number | null;
  totalDistance: number | null;
}

export async function getExerciseProgress(
  db: Db,
  userId: string,
  exerciseId: string,
): Promise<ExerciseProgress | null> {
  const exercise = await db
    .select({ id: exercises.id, type: exercises.type })
    .from(exercises)
    .where(eq(exercises.id, exerciseId))
    .get();
  if (!exercise) return null;

  // All of this user's entries for this exercise, with their workout date, oldest first.
  const entryRows = await db
    .select({
      entryId: workoutEntries.id,
      workoutId: workouts.id,
      date: workouts.date,
      durationSeconds: workoutEntries.durationSeconds,
      distance: workoutEntries.distance,
    })
    .from(workoutEntries)
    .innerJoin(workouts, eq(workouts.id, workoutEntries.workoutId))
    .where(and(eq(workouts.userId, userId), eq(workoutEntries.exerciseId, exerciseId)))
    .orderBy(asc(workouts.date));

  if (entryRows.length === 0) {
    return { exerciseId, type: exercise.type, points: [] };
  }

  const setRows = await db
    .select()
    .from(sets)
    .where(inArray(sets.entryId, entryRows.map((e) => e.entryId)));
  const setsByEntry = new Map<string, typeof setRows>();
  for (const s of setRows) {
    const list = setsByEntry.get(s.entryId) ?? [];
    list.push(s);
    setsByEntry.set(s.entryId, list);
  }

  // One point per workout (a workout could contain the exercise more than once).
  const byWorkout = new Map<string, Accumulator>();
  const order: string[] = [];

  for (const entry of entryRows) {
    let acc = byWorkout.get(entry.workoutId);
    if (!acc) {
      acc = {
        date: entry.date,
        workoutId: entry.workoutId,
        bestTotalLoadKg: null,
        totalVolumeKg: null,
        topReps: null,
        maxDurationSeconds: null,
        totalDistance: null,
      };
      byWorkout.set(entry.workoutId, acc);
      order.push(entry.workoutId);
    }

    if (entry.durationSeconds != null) {
      acc.maxDurationSeconds = Math.max(acc.maxDurationSeconds ?? 0, entry.durationSeconds);
    }
    if (entry.distance != null) {
      acc.totalDistance = (acc.totalDistance ?? 0) + entry.distance;
    }

    for (const s of setsByEntry.get(entry.entryId) ?? []) {
      if (s.reps != null) acc.topReps = Math.max(acc.topReps ?? 0, s.reps);
      const load = computeTotalLoadKg({
        weight: s.weight,
        weightUnit: s.weightUnit,
        loadType: s.loadType,
        barWeight: s.barWeight,
      });
      if (load != null) {
        acc.bestTotalLoadKg = Math.max(acc.bestTotalLoadKg ?? 0, load);
        const volume = s.reps != null ? load * s.reps : 0;
        acc.totalVolumeKg = (acc.totalVolumeKg ?? 0) + volume;
      }
    }
  }

  const points = order.map((id) => byWorkout.get(id)!);
  return { exerciseId, type: exercise.type, points };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @health-ready/api test progress.service`
Expected: PASS (all 5 cases).

- [ ] **Step 5: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(api): add exercise progress aggregation service`

---

## Task 3: Progress route

**Files:**
- Create: `apps/api/src/routes/progress.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/test/progress.routes.test.ts`

- [ ] **Step 1: Write the failing test**

`apps/api/test/progress.routes.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import app from "../src/index.js";
import { getDb } from "../src/db/client.js";
import { createWorkout } from "../src/services/workouts.js";
import { seedUser, seedExercise } from "./helpers.js";

describe("progress routes", () => {
  it("requires auth", async () => {
    expect((await app.request("/progress/exercises/x", {}, env)).status).toBe(401);
  });

  it("404s for an unknown exercise", async () => {
    const { cookie } = await seedUser();
    const res = await app.request("/progress/exercises/nope", { headers: { cookie } }, env);
    expect(res.status).toBe(404);
  });

  it("returns the time series for the current user", async () => {
    const { id: userId, cookie } = await seedUser();
    const db = getDb(env.DB);
    const exId = await seedExercise({ type: "strength" });
    await createWorkout(db, userId, {
      date: "2026-05-05", name: null, notes: null,
      entries: [{ exerciseId: exId, comment: null, durationSeconds: null, distance: null, distanceUnit: null, sets: [{ reps: 5, weight: 100, weightUnit: "kg", loadType: "total", barWeight: null }] }],
    });
    const res = await app.request(`/progress/exercises/${exId}`, { headers: { cookie } }, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ points: Array<{ bestTotalLoadKg: number }> }>();
    expect(body.points[0].bestTotalLoadKg).toBe(100);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @health-ready/api test progress.routes`
Expected: FAIL — `/progress` 404.

- [ ] **Step 3: Implement `apps/api/src/routes/progress.ts`**

```ts
import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { requireAuth, type AppEnv } from "../middleware/auth.js";
import { getExerciseProgress } from "../services/progress.js";

export const progressRoutes = new Hono<AppEnv>();

progressRoutes.use("*", requireAuth);

progressRoutes.get("/exercises/:id", async (c) => {
  const db = getDb(c.env.DB);
  const result = await getExerciseProgress(db, c.get("user").id, c.req.param("id"));
  if (!result) return c.json({ error: "not found" }, 404);
  return c.json(result);
});
```

- [ ] **Step 4: Mount in `apps/api/src/index.ts`**

```ts
import { Hono } from "hono";
import { authRoutes } from "./routes/auth.js";
import { exerciseRoutes } from "./routes/exercises.js";
import { workoutRoutes } from "./routes/workouts.js";
import { userRoutes } from "./routes/users.js";
import { progressRoutes } from "./routes/progress.js";
import type { AppEnv } from "./middleware/auth.js";

const app = new Hono<AppEnv>();

app.get("/health", (c) => c.json({ ok: true }));
app.route("/auth", authRoutes);
app.route("/exercises", exerciseRoutes);
app.route("/workouts", workoutRoutes);
app.route("/users", userRoutes);
app.route("/progress", progressRoutes);

export default app;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @health-ready/api test progress.routes`
Expected: PASS (all 3 cases).

- [ ] **Step 6: Run the full suite + typecheck**

Run: `pnpm --filter @health-ready/api test && pnpm -r typecheck`
Expected: every test file PASS; typecheck clean.

- [ ] **Step 7: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(api): add progress endpoint`

---

## Phase 3 Done — Definition of Done

- `computeTotalLoadKg` correctly normalizes all five load types (and bodyweight → null), tested.
- `GET /progress/exercises/:id` returns ascending per-workout points scoped to the user, 404 for unknown exercises, 401 without auth.
- Full API test suite green; `pnpm -r typecheck` clean.

The backend is now feature-complete for the initial version. Next: `phase-4-frontend.md`.
