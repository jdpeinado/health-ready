# Bi-series / Tri-series (exercise grouping) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users group 2+ exercises into a bi-series / tri-series when building a workout, persist the grouping, and show it grouped in the history.

**Architecture:** Additive — exercises keep their own `sets`. A grouping layer is added via a `group_id` (UUID shared by the entries of one series) plus a `group_type` label on `workout_entries`. The frontend form models the workout as a list of *blocks* (a standalone exercise or a group of exercises) and flattens to the existing ordered `entries[]` on submit, assigning a shared `groupId` per group. See spec: [`../README.md`](../README.md).

**Tech Stack:** Cloudflare Workers + Hono + Drizzle (D1), Zod (shared validation), Vite + React + TS, Vitest.

> **Git note (project rule):** The maintainer handles all `git add` / `commit` / `push`. Do **NOT** stage or commit. Each task ends by running the relevant verification commands (`make typecheck`, `make test`) and pausing for review/commit by the maintainer.

> **Gotcha (`noUncheckedIndexedAccess` is ON):** `tsc` typechecks test files too. Guard every indexed access (`arr[0]!` or an existence check) or the build fails.

---

## File map

- Modify: `apps/api/src/db/schema.ts` — add `groupId` / `groupType` columns to `workoutEntries`.
- Create: `apps/api/migrations/<generated>.sql` — produced by `make migrate-generate`.
- Modify: `packages/shared/src/schemas/common.ts` — add `groupTypeSchema` + `GroupType`.
- Modify: `packages/shared/src/schemas/workout.ts` — add `groupId`/`groupType` to `entryInputSchema`; add group validation (`superRefine`) to create/update schemas.
- Modify: `apps/api/src/services/workouts.ts` — persist + serialize group fields; regenerate group ids on copy; lower the entries INSERT chunk.
- Modify: `apps/api/test/workouts.service.test.ts` — round-trip + copy tests.
- Modify: `apps/api/test/workouts.routes.test.ts` — validation (400) tests.
- Modify: `apps/web/src/api/types.ts` — add `groupId`/`groupType` to `EntryDetail`.
- Create: `apps/web/src/features/workouts/blocks.ts` — `Block` type + `blocksToEntries` / `entriesToBlocks`.
- Create: `apps/web/src/features/workouts/blocks.test.ts` — unit tests for the block helpers.
- Modify: `apps/web/src/features/workouts/WorkoutForm.tsx` — block-based state + group container UI.
- Modify: `apps/web/src/features/workouts/NewWorkoutPage.tsx` — pass `initialBlocks={[]}`.
- Modify: `apps/web/src/features/workouts/EditWorkoutPage.tsx` — build `initialBlocks` from saved entries.
- Modify: `apps/web/src/features/history/WorkoutDetailPage.tsx` — render grouped entries.
- Modify: `apps/web/src/features/workouts/WorkoutForm.test.tsx` — smoke test for the group container.
- Modify: docs (`README.md` and/or `docs/`) — document the feature (final task).

---

## Task 1: DB schema + migration

**Files:**
- Modify: `apps/api/src/db/schema.ts` (the `workoutEntries` table)
- Create: `apps/api/migrations/<generated>.sql` (via tooling)

- [ ] **Step 1: Add the two columns to `workoutEntries`**

In `apps/api/src/db/schema.ts`, inside the `workoutEntries` table definition, add after `distanceUnit`:

```ts
  distanceUnit: text("distance_unit"),
  groupId: text("group_id"),
  groupType: text("group_type", {
    enum: ["biserie", "triserie", "superserie", "circuito"],
  }),
```

- [ ] **Step 2: Generate the migration**

Run: `make migrate-generate`
Expected: a new file appears under `apps/api/migrations/` (drizzle-named, e.g. `0001_*.sql`) containing `ALTER TABLE \`workout_entries\` ADD \`group_id\` text;` and `ADD \`group_type\` text;`. Both columns are nullable — no data backfill needed.

- [ ] **Step 3: Apply the migration locally**

Run: `make db-migrate-local`
Expected: applies cleanly, reports the new migration as run.

- [ ] **Step 4: Typecheck**

Run: `make typecheck`
Expected: PASS.

- [ ] **Step 5: Checkpoint** — pause for maintainer review/commit (do not commit yourself).

---

## Task 2: Shared types — `GroupType` enum

**Files:**
- Modify: `packages/shared/src/schemas/common.ts`

- [ ] **Step 1: Add the enum + type**

Append to `packages/shared/src/schemas/common.ts`:

```ts
export const groupTypeSchema = z.enum([
  "biserie",
  "triserie",
  "superserie",
  "circuito",
]);
export type GroupType = z.infer<typeof groupTypeSchema>;
```

- [ ] **Step 2: Typecheck**

Run: `make typecheck`
Expected: PASS (new exports are re-exported automatically via `src/index.ts`'s `export * from "./schemas/common.js"`).

- [ ] **Step 3: Checkpoint** — pause for maintainer review/commit.

---

## Task 3: Shared schema — entry fields + group validation

**Files:**
- Modify: `packages/shared/src/schemas/workout.ts`

- [ ] **Step 1: Add `groupId`/`groupType` to `entryInputSchema`**

In `packages/shared/src/schemas/workout.ts`, update the import line and `entryInputSchema`:

```ts
import { weightUnitSchema, loadTypeSchema, groupTypeSchema } from "./common.js";
```

```ts
export const entryInputSchema = z.object({
  exerciseId: z.string().min(1),
  comment: z.string().nullish(),
  durationSeconds: z.number().int().nonnegative().nullish(),
  distance: z.number().nonnegative().nullish(),
  distanceUnit: z.string().min(1).nullish(),
  sets: z.array(setInputSchema).default([]),
  groupId: z.string().min(1).nullish(),
  groupType: groupTypeSchema.nullish(),
});
export type EntryInput = z.infer<typeof entryInputSchema>;
```

- [ ] **Step 2: Add the group-validation helper**

Add this function in `packages/shared/src/schemas/workout.ts` *above* `createWorkoutSchema`:

```ts
// Entries sharing a groupId must be contiguous, share one groupType, and number >= 2.
// A standalone entry (groupId null) must not carry a groupType.
function refineGroups(
  entries: EntryInput[] | undefined,
  ctx: z.RefinementCtx,
): void {
  if (!entries) return;
  const positionsByGroup = new Map<string, number[]>();
  entries.forEach((e, i) => {
    if (e.groupId == null) {
      if (e.groupType != null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["entries", i, "groupType"],
          message: "groupType requires a groupId",
        });
      }
      return;
    }
    if (e.groupType == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entries", i, "groupType"],
        message: "a grouped entry requires a groupType",
      });
    }
    const arr = positionsByGroup.get(e.groupId) ?? [];
    arr.push(i);
    positionsByGroup.set(e.groupId, arr);
  });
  for (const [groupId, positions] of positionsByGroup) {
    const first = positions[0]!;
    if (positions.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entries", first],
        message: `group ${groupId} must contain at least 2 entries`,
      });
    }
    const contiguous = positions.every(
      (p, k) => k === 0 || p === positions[k - 1]! + 1,
    );
    if (!contiguous) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entries", first],
        message: `group ${groupId} entries must be contiguous`,
      });
    }
    const types = new Set(positions.map((p) => entries[p]!.groupType));
    if (types.size > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entries", first],
        message: `group ${groupId} has mixed groupType values`,
      });
    }
  }
}
```

- [ ] **Step 3: Attach `superRefine` to the create/update schemas**

Replace the `createWorkoutSchema` and `updateWorkoutSchema` definitions with:

```ts
export const createWorkoutSchema = z
  .object({
    date: isoDate,
    name: z.string().min(1).nullish(),
    notes: z.string().nullish(),
    entries: z.array(entryInputSchema).default([]),
  })
  .superRefine((val, ctx) => refineGroups(val.entries, ctx));
export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;

export const updateWorkoutSchema = z
  .object({
    date: isoDate.optional(),
    name: z.string().min(1).nullish(),
    notes: z.string().nullish(),
    entries: z.array(entryInputSchema).optional(), // when present, replaces all entries
  })
  .superRefine((val, ctx) => refineGroups(val.entries, ctx));
export type UpdateWorkoutInput = z.infer<typeof updateWorkoutSchema>;
```

- [ ] **Step 4: Typecheck**

Run: `make typecheck`
Expected: PASS. (`z.infer` works on the `ZodEffects` produced by `superRefine`, so the inferred types are unchanged.)

- [ ] **Step 5: Checkpoint** — pause for maintainer review/commit.

---

## Task 4: API service — persist & serialize group fields

**Files:**
- Modify: `apps/api/src/services/workouts.ts`
- Test: `apps/api/test/workouts.service.test.ts`

- [ ] **Step 1: Write the failing round-trip test**

Add to `apps/api/test/workouts.service.test.ts` (inside the `describe("workout service", ...)` block):

```ts
it("round-trips grouped entries (groupId + groupType)", async () => {
  const db = getDb(env.DB);
  const { id: userId } = await seedUser();
  const a = await seedExercise({ name: "Press" });
  const b = await seedExercise({ name: "Remo" });

  const workoutId = await createWorkout(db, userId, {
    date: "2026-05-02",
    name: "Superset day",
    notes: null,
    entries: [
      { exerciseId: a, comment: null, durationSeconds: null, distance: null, distanceUnit: null, sets: [], groupId: "g1", groupType: "biserie" },
      { exerciseId: b, comment: null, durationSeconds: null, distance: null, distanceUnit: null, sets: [], groupId: "g1", groupType: "biserie" },
    ],
  });

  const detail = await getWorkout(db, userId, workoutId);
  const e0 = detail?.entries[0];
  const e1 = detail?.entries[1];
  expect(e0?.groupId).toBe("g1");
  expect(e0?.groupType).toBe("biserie");
  expect(e1?.groupId).toBe("g1");
  expect(e1?.groupType).toBe("biserie");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @health-ready/api test -- workouts.service`
Expected: FAIL — `groupId`/`groupType` are `undefined` (not yet on `EntryDetail` / not persisted).

- [ ] **Step 3: Persist the fields in `buildInserts`**

In `apps/api/src/services/workouts.ts`, in `buildInserts`, extend the `entryRows.push({...})` object:

```ts
    entryRows.push({
      id: entryId,
      workoutId,
      exerciseId: entry.exerciseId,
      orderIndex: i,
      comment: entry.comment ?? null,
      durationSeconds: entry.durationSeconds ?? null,
      distance: entry.distance ?? null,
      distanceUnit: entry.distanceUnit ?? null,
      groupId: entry.groupId ?? null,
      groupType: entry.groupType ?? null,
    });
```

- [ ] **Step 4: Serialize the fields in `getWorkout`**

In the same file, extend the `EntryDetail` interface:

```ts
export interface EntryDetail {
  id: string; exerciseId: string; orderIndex: number; comment: string | null;
  durationSeconds: number | null; distance: number | null; distanceUnit: string | null;
  groupId: string | null;
  groupType: "biserie" | "triserie" | "superserie" | "circuito" | null;
  sets: SetDetail[];
}
```

And extend the `entries` mapping in `getWorkout`:

```ts
  const entries: EntryDetail[] = entryRows.map((e) => ({
    id: e.id, exerciseId: e.exerciseId, orderIndex: e.orderIndex, comment: e.comment,
    durationSeconds: e.durationSeconds, distance: e.distance, distanceUnit: e.distanceUnit,
    groupId: e.groupId, groupType: e.groupType,
    sets: setsByEntry.get(e.id) ?? [],
  }));
```

- [ ] **Step 5: Lower the entries INSERT chunk (D1 param limit)**

`workout_entries` now has 10 columns; at 10 rows/insert that is 100 bound params (the D1 ceiling). Add a dedicated chunk size and use it for entries. Update the comment block at the top of the file to mention 10 columns, then:

```ts
const INSERT_CHUNK = 10;
const ENTRY_INSERT_CHUNK = 8; // workout_entries has 10 columns → 8 rows = 80 params
```

In `createWorkout`, change the entries loop:

```ts
  for (const c of chunk(entryRows, ENTRY_INSERT_CHUNK)) stmts.push(db.insert(workoutEntries).values(c));
```

In `replaceWorkout`, change the entries loop the same way:

```ts
    for (const c of chunk(entryRows, ENTRY_INSERT_CHUNK)) stmts.push(db.insert(workoutEntries).values(c));
```

(Leave the `sets` loops using the default `chunk(setRows)`.)

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @health-ready/api test -- workouts.service`
Expected: PASS.

- [ ] **Step 7: Checkpoint** — pause for maintainer review/commit.

---

## Task 5: API service — regenerate group ids on copy

**Files:**
- Modify: `apps/api/src/services/workouts.ts` (`copyWorkout`)
- Test: `apps/api/test/workouts.service.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `apps/api/test/workouts.service.test.ts`:

```ts
it("copyWorkout regenerates groupId but keeps the grouping", async () => {
  const db = getDb(env.DB);
  const { id: userId } = await seedUser();
  const a = await seedExercise({ name: "Press" });
  const b = await seedExercise({ name: "Remo" });

  const srcId = await createWorkout(db, userId, {
    date: "2026-05-02", name: null, notes: null,
    entries: [
      { exerciseId: a, comment: null, durationSeconds: null, distance: null, distanceUnit: null, sets: [], groupId: "g1", groupType: "triserie" },
      { exerciseId: b, comment: null, durationSeconds: null, distance: null, distanceUnit: null, sets: [], groupId: "g1", groupType: "triserie" },
    ],
  });

  const newId = await copyWorkout(db, userId, srcId, "2026-05-09");
  const copy = await getWorkout(db, userId, newId!);
  const c0 = copy?.entries[0];
  const c1 = copy?.entries[1];
  expect(c0?.groupType).toBe("triserie");
  expect(c0?.groupId).not.toBe("g1"); // regenerated
  expect(c0?.groupId).toBe(c1?.groupId); // still grouped together
});
```

Add `copyWorkout` to the imports at the top of the test file:

```ts
import {
  createWorkout,
  getWorkout,
  listWorkouts,
  validateExerciseIds,
  copyWorkout,
} from "../src/services/workouts.js";
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @health-ready/api test -- workouts.service`
Expected: FAIL — copied entries have `groupId: null` / `groupType: null` (copy doesn't pass them yet).

- [ ] **Step 3: Implement the regeneration**

In `apps/api/src/services/workouts.ts`, update `copyWorkout`'s body to build an old→new id map and pass the fields through:

```ts
export async function copyWorkout(
  db: Db,
  userId: string,
  sourceId: string,
  newDate: string,
): Promise<string | null> {
  const source = await getWorkout(db, userId, sourceId);
  if (!source) return null;
  const groupIdMap = new Map<string, string>();
  for (const e of source.entries) {
    if (e.groupId && !groupIdMap.has(e.groupId)) {
      groupIdMap.set(e.groupId, crypto.randomUUID());
    }
  }
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
      groupId: e.groupId ? groupIdMap.get(e.groupId)! : null,
      groupType: e.groupType,
      sets: e.sets.map((s) => ({
        reps: s.reps, weight: s.weight, weightUnit: s.weightUnit,
        loadType: s.loadType, barWeight: s.barWeight,
      })),
    })),
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @health-ready/api test -- workouts.service`
Expected: PASS.

- [ ] **Step 5: Checkpoint** — pause for maintainer review/commit.

---

## Task 6: API routes — validation rejects bad groups

**Files:**
- Test: `apps/api/test/workouts.routes.test.ts`

This task adds no production code — it locks in the `superRefine` from Task 3 at the HTTP layer.

- [ ] **Step 1: Inspect the existing test for the auth/seed pattern**

Open `apps/api/test/workouts.routes.test.ts` and reuse its existing helpers for an authenticated POST to `/workouts` (login/cookie + a seeded exercise). Match the style already present (do not invent a new harness).

- [ ] **Step 2: Write the failing tests**

Add two cases that POST an authenticated workout and expect `400`:

```ts
it("rejects a group with only one entry", async () => {
  // ...arrange auth + one seeded exercise id `exId` per the file's existing pattern...
  const res = await postWorkout({
    date: "2026-05-02", name: null, notes: null,
    entries: [
      { exerciseId: exId, sets: [], groupId: "g1", groupType: "biserie" },
    ],
  });
  expect(res.status).toBe(400);
});

it("rejects mixed groupType within one groupId", async () => {
  // ...arrange auth + two seeded exercise ids `a`, `b`...
  const res = await postWorkout({
    date: "2026-05-02", name: null, notes: null,
    entries: [
      { exerciseId: a, sets: [], groupId: "g1", groupType: "biserie" },
      { exerciseId: b, sets: [], groupId: "g1", groupType: "triserie" },
    ],
  });
  expect(res.status).toBe(400);
});
```

> Adapt `postWorkout(...)` and the auth/seed setup to the helpers already used in this file (the existing tests show the exact `app.request` call, headers, and cookie handling). Keep `sets: []` minimal; the zod `entryInputSchema` defaults the rest.

- [ ] **Step 3: Run the tests**

Run: `pnpm --filter @health-ready/api test -- workouts.routes`
Expected: PASS (the `superRefine` from Task 3 already produces `400` via `zValidator`). If they fail, the validation wiring in Task 3 is wrong — fix there, not here.

- [ ] **Step 4: Checkpoint** — pause for maintainer review/commit.

---

## Task 7: Web — `EntryDetail` type gains group fields

**Files:**
- Modify: `apps/web/src/api/types.ts`

- [ ] **Step 1: Add the fields**

Update the import and `EntryDetail` in `apps/web/src/api/types.ts`:

```ts
import type {
  ExerciseType,
  WeightUnit,
  LoadType,
  Role,
  GroupType,
} from "@health-ready/shared";
```

```ts
export interface EntryDetail {
  id: string;
  exerciseId: string;
  orderIndex: number;
  comment: string | null;
  durationSeconds: number | null;
  distance: number | null;
  distanceUnit: string | null;
  groupId: string | null;
  groupType: GroupType | null;
  sets: SetDetail[];
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck` (or `make typecheck`)
Expected: PASS.

- [ ] **Step 3: Checkpoint** — pause for maintainer review/commit.

---

## Task 8: Web — block model + pure helpers

**Files:**
- Create: `apps/web/src/features/workouts/blocks.ts`
- Test: `apps/web/src/features/workouts/blocks.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/features/workouts/blocks.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { DraftEntry } from "./EntryEditor";
import { blocksToEntries, entriesToBlocks, type Block } from "./blocks";
import type { EntryDetail } from "../../api/types";

function draft(exerciseId: string): DraftEntry {
  return {
    exerciseId,
    exerciseName: exerciseId,
    exerciseType: "strength",
    comment: "",
    lines: [{ count: 1, reps: 5, weight: null, weightUnit: "kg", loadType: "total", barWeight: null }],
    durationMinutes: null,
    distance: null,
    distanceUnit: "km",
  };
}

describe("blocksToEntries", () => {
  it("assigns one shared groupId + groupType to a group's entries", () => {
    const blocks: Block[] = [
      { kind: "group", id: "blk1", groupId: "g-abc", groupType: "biserie", entries: [draft("a"), draft("b")] },
    ];
    const entries = blocksToEntries(blocks);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.groupId).toBe("g-abc");
    expect(entries[1]!.groupId).toBe("g-abc");
    expect(entries[0]!.groupType).toBe("biserie");
    expect(entries[1]!.groupType).toBe("biserie");
  });

  it("leaves singles ungrouped", () => {
    const blocks: Block[] = [{ kind: "single", id: "s1", entry: draft("a") }];
    const entries = blocksToEntries(blocks);
    expect(entries[0]!.groupId).toBeNull();
    expect(entries[0]!.groupType).toBeNull();
  });

  it("degrades a group of <2 entries to singles", () => {
    const blocks: Block[] = [
      { kind: "group", id: "blk1", groupId: "g-abc", groupType: "triserie", entries: [draft("a")] },
    ];
    const entries = blocksToEntries(blocks);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.groupId).toBeNull();
    expect(entries[0]!.groupType).toBeNull();
  });

  it("drops empty groups", () => {
    const blocks: Block[] = [
      { kind: "group", id: "blk1", groupId: "g-abc", groupType: "biserie", entries: [] },
    ];
    expect(blocksToEntries(blocks)).toHaveLength(0);
  });
});

describe("entriesToBlocks", () => {
  const toDraft = (e: EntryDetail): DraftEntry => draft(e.exerciseId);
  const base = {
    id: "x", orderIndex: 0, comment: null, durationSeconds: null,
    distance: null, distanceUnit: null, sets: [],
  };

  it("groups consecutive entries sharing a groupId", () => {
    const entries: EntryDetail[] = [
      { ...base, id: "1", exerciseId: "a", groupId: "g1", groupType: "biserie" },
      { ...base, id: "2", exerciseId: "b", groupId: "g1", groupType: "biserie" },
      { ...base, id: "3", exerciseId: "c", groupId: null, groupType: null },
    ];
    const blocks = entriesToBlocks(entries, toDraft);
    expect(blocks).toHaveLength(2);
    const g = blocks[0]!;
    expect(g.kind).toBe("group");
    if (g.kind === "group") {
      expect(g.groupId).toBe("g1");
      expect(g.groupType).toBe("biserie");
      expect(g.entries).toHaveLength(2);
    }
    expect(blocks[1]!.kind).toBe("single");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter web test -- blocks`
Expected: FAIL — `./blocks` module not found.

- [ ] **Step 3: Implement `blocks.ts`**

Create `apps/web/src/features/workouts/blocks.ts`:

```ts
import type { EntryInput, GroupType } from "@health-ready/shared";
import type { EntryDetail } from "../../api/types";
import type { DraftEntry } from "./EntryEditor";
import { toEntryInput } from "./EntryEditor";

// A workout is edited as an ordered list of blocks: either a standalone exercise
// or a group (bi/tri-series) holding 2+ exercises. `id` is a client-only React key;
// `groupId` is the id persisted on every entry of the group.
export type Block =
  | { kind: "single"; id: string; entry: DraftEntry }
  | { kind: "group"; id: string; groupId: string; groupType: GroupType; entries: DraftEntry[] };

// Flatten blocks to ordered EntryInput[]. Each group's entries share its groupId +
// groupType. Empty groups are dropped; a group that ended up with <2 entries is
// degraded to standalone entries (the API rejects 1-entry groups).
export function blocksToEntries(blocks: Block[]): EntryInput[] {
  const out: EntryInput[] = [];
  for (const b of blocks) {
    if (b.kind === "single") {
      out.push({ ...toEntryInput(b.entry), groupId: null, groupType: null });
      continue;
    }
    if (b.entries.length === 0) continue;
    if (b.entries.length < 2) {
      for (const e of b.entries) {
        out.push({ ...toEntryInput(e), groupId: null, groupType: null });
      }
      continue;
    }
    for (const e of b.entries) {
      out.push({ ...toEntryInput(e), groupId: b.groupId, groupType: b.groupType });
    }
  }
  return out;
}

// Rebuild blocks from saved entries (already ordered). Consecutive entries sharing
// a groupId collapse into one group block; everything else is a single.
export function entriesToBlocks(
  entries: EntryDetail[],
  toDraft: (e: EntryDetail) => DraftEntry,
): Block[] {
  const blocks: Block[] = [];
  for (const e of entries) {
    const entry = toDraft(e);
    if (e.groupId == null) {
      blocks.push({ kind: "single", id: e.id, entry });
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (last && last.kind === "group" && last.groupId === e.groupId) {
      last.entries.push(entry);
    } else {
      blocks.push({
        kind: "group",
        id: e.groupId,
        groupId: e.groupId,
        groupType: e.groupType ?? "biserie",
        entries: [entry],
      });
    }
  }
  return blocks;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter web test -- blocks`
Expected: PASS.

- [ ] **Step 5: Checkpoint** — pause for maintainer review/commit.

---

## Task 9: Web — block-based form + group container UI

**Files:**
- Modify: `apps/web/src/features/workouts/WorkoutForm.tsx`
- Modify: `apps/web/src/features/workouts/NewWorkoutPage.tsx`

The form changes from a flat `DraftEntry[]` to `Block[]`. New exercises from the bottom picker become single blocks; an empty group block is created via a "type" selector, and each group has its own embedded picker for adding exercises into it.

- [ ] **Step 1: Replace `WorkoutForm.tsx`**

Replace the whole file `apps/web/src/features/workouts/WorkoutForm.tsx` with:

```tsx
import { useState } from "react";
import { CalendarDays, Dumbbell, Plus, Save, X } from "lucide-react";
import type { EntryInput, GroupType } from "@health-ready/shared";
import type { Exercise } from "../../api/types";
import { useExercises } from "../exercises/useExercises";
import { useMe } from "../../auth/useAuth";
import { CreateExerciseDialog } from "../exercises/CreateExerciseDialog";
import { ExercisePicker } from "../exercises/ExercisePicker";
import { EntryEditor, type DraftEntry } from "./EntryEditor";
import { blocksToEntries, type Block } from "./blocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const GROUP_TYPE_LABELS: Record<GroupType, string> = {
  biserie: "Bi-serie",
  triserie: "Tri-serie",
  superserie: "Superserie",
  circuito: "Circuito",
};
const GROUP_TYPES: GroupType[] = ["biserie", "triserie", "superserie", "circuito"];

function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function draftFor(ex: Exercise): DraftEntry {
  return {
    exerciseId: ex.id,
    exerciseName: ex.name,
    exerciseType: ex.type,
    comment: "",
    lines: [
      { count: 3, reps: 10, weight: null, weightUnit: "kg", loadType: "total", barWeight: null },
    ],
    durationMinutes: null,
    distance: null,
    distanceUnit: "km",
  };
}

export interface WorkoutFormPayload {
  date: string;
  name: string | null;
  entries: EntryInput[];
}

interface WorkoutFormProps {
  initialDate: string;
  initialName: string;
  initialBlocks: Block[];
  eyebrow: string;
  title: string;
  submitLabel: string;
  pendingLabel: string;
  isPending: boolean;
  onSubmit: (payload: WorkoutFormPayload) => void;
}

export function WorkoutForm({
  initialDate,
  initialName,
  initialBlocks,
  eyebrow,
  title,
  submitLabel,
  pendingLabel,
  isPending,
  onSubmit,
}: WorkoutFormProps) {
  const exercises = useExercises();
  const me = useMe();
  const isAdmin = me.data?.role === "admin";
  const [date, setDate] = useState(initialDate);
  const [name, setName] = useState(initialName);
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [createOpen, setCreateOpen] = useState(false);

  const exerciseCount = blocks.reduce(
    (n, b) => n + (b.kind === "single" ? 1 : b.entries.length),
    0,
  );

  // Append a standalone exercise. Used by the bottom picker and the inline create flow.
  function addExercise(ex: Exercise) {
    setBlocks((prev) => [
      ...prev,
      { kind: "single", id: crypto.randomUUID(), entry: draftFor(ex) },
    ]);
  }

  function addGroup(groupType: GroupType) {
    const groupId = crypto.randomUUID();
    setBlocks((prev) => [
      ...prev,
      { kind: "group", id: groupId, groupId, groupType, entries: [] },
    ]);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  // Update the single-entry draft of a `single` block.
  function updateSingle(id: string, entry: DraftEntry) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id && b.kind === "single" ? { ...b, entry } : b)),
    );
  }

  // Add / update / remove an exercise inside a group block.
  function addToGroup(id: string, ex: Exercise) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id && b.kind === "group"
          ? { ...b, entries: [...b.entries, draftFor(ex)] }
          : b,
      ),
    );
  }
  function updateInGroup(id: string, i: number, entry: DraftEntry) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id && b.kind === "group"
          ? { ...b, entries: b.entries.map((e, j) => (j === i ? entry : e)) }
          : b,
      ),
    );
  }
  function removeFromGroup(id: string, i: number) {
    setBlocks((prev) =>
      prev.map((b) =>
        b.id === id && b.kind === "group"
          ? { ...b, entries: b.entries.filter((_, j) => j !== i) }
          : b,
      ),
    );
  }

  function save() {
    onSubmit({ date, name: name.trim() || null, entries: blocksToEntries(blocks) });
  }

  return (
    <div className="animate-rise space-y-6">
      {/* Hero */}
      <header className="space-y-1.5">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
        <p className="flex items-center gap-1.5 text-sm capitalize text-muted-foreground">
          <CalendarDays className="size-4" />
          {prettyDate(date)}
        </p>
      </header>

      {/* Meta */}
      <Card>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nombre (opcional)</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Rutina 3 / Pull day"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exercises */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Ejercicios
          </h2>
          {exerciseCount > 0 && (
            <span className="font-mono text-xs text-muted-foreground">{exerciseCount}</span>
          )}
        </div>

        {blocks.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/30 px-6 py-12 text-center">
            <span className="grid size-11 place-items-center rounded-full bg-secondary text-muted-foreground">
              <Dumbbell className="size-5" />
            </span>
            <p className="text-sm font-medium text-foreground">Aún no has agregado ejercicios</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Elige uno abajo o crea una serie agrupada.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {blocks.map((b) =>
              b.kind === "single" ? (
                <EntryEditor
                  key={b.id}
                  index={0}
                  entry={b.entry}
                  onChange={(e) => updateSingle(b.id, e)}
                  onRemove={() => removeBlock(b.id)}
                />
              ) : (
                <Card key={b.id} className="gap-0 border-primary/40 py-0">
                  <div className="flex items-center gap-3 border-b border-border bg-primary/10 px-4 py-3">
                    <span className="font-display text-xs font-bold uppercase tracking-wide text-primary">
                      {GROUP_TYPE_LABELS[b.groupType]}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {b.entries.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeBlock(b.id)}
                      aria-label="Quitar serie agrupada"
                      className="ml-auto grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                  <CardContent className="space-y-3 py-4">
                    {b.entries.map((entry, i) => (
                      <EntryEditor
                        key={i}
                        index={i + 1}
                        entry={entry}
                        onChange={(e) => updateInGroup(b.id, i, e)}
                        onRemove={() => removeFromGroup(b.id, i)}
                      />
                    ))}
                    <ExercisePicker
                      exercises={exercises.data ?? []}
                      onSelect={(ex) => addToGroup(b.id, ex)}
                      placeholder="Añadir a la serie…"
                    />
                  </CardContent>
                </Card>
              ),
            )}
          </div>
        )}
      </section>

      {/* Add exercise / group */}
      <Card>
        <CardContent className="space-y-2">
          <ExercisePicker exercises={exercises.data ?? []} onSelect={addExercise} />
          <Select onValueChange={(v) => addGroup(v as GroupType)} value="">
            <SelectTrigger className="w-full text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Plus className="size-3.5" />
                Añadir serie agrupada
              </span>
            </SelectTrigger>
            <SelectContent>
              {GROUP_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {GROUP_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button
              type="button"
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="size-4" />
              Crear ejercicio
            </Button>
          )}
        </CardContent>
      </Card>

      {isAdmin && (
        <CreateExerciseDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={addExercise} />
      )}

      {/* Save */}
      <div className="flex sm:justify-end">
        <Button
          size="lg"
          className="w-full sm:w-auto"
          onClick={save}
          disabled={isPending || exerciseCount === 0}
        >
          <Save className="size-4" />
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </div>
    </div>
  );
}
```

> Note: `EntryEditor`'s `index` prop is display-only (the badge number). Singles pass `0`; grouped entries pass their 1-based position.

- [ ] **Step 2: Update `NewWorkoutPage.tsx`**

In `apps/web/src/features/workouts/NewWorkoutPage.tsx`, change the prop `initialEntries={[]}` to `initialBlocks={[]}`.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: FAIL only in `EditWorkoutPage.tsx` (still passes `initialEntries`) — fixed in Task 10. WorkoutForm + NewWorkoutPage must be clean.

- [ ] **Step 4: Checkpoint** — pause (typecheck completes after Task 10).

---

## Task 10: Web — rebuild blocks when editing

**Files:**
- Modify: `apps/web/src/features/workouts/EditWorkoutPage.tsx`

- [ ] **Step 1: Build `initialBlocks` from saved entries**

Replace the body of `EditWorkoutPage.tsx` that builds `initialEntries` and renders the form:

```tsx
import { useParams, useNavigate } from "react-router-dom";
import { useWorkout } from "../history/useWorkouts";
import { useExercises } from "../exercises/useExercises";
import { useUpdateWorkout } from "./useWorkoutMutations";
import { WorkoutForm } from "./WorkoutForm";
import { fromEntryDetail } from "./EntryEditor";
import { entriesToBlocks } from "./blocks";

export function EditWorkoutPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const workout = useWorkout(id);
  const exercises = useExercises();
  const update = useUpdateWorkout(id);

  if (workout.isLoading || exercises.isLoading)
    return <p className="animate-rise text-muted-foreground">Cargando…</p>;
  if (!workout.data)
    return <p className="animate-rise text-destructive">No encontrado.</p>;

  const w = workout.data;
  const byId = new Map(exercises.data?.map((ex) => [ex.id, ex]) ?? []);

  const initialBlocks = entriesToBlocks(w.entries, (e) => {
    const ex = byId.get(e.exerciseId);
    return fromEntryDetail(e, {
      name: ex?.name ?? "Ejercicio",
      type: ex?.type ?? "strength",
    });
  });

  return (
    <WorkoutForm
      initialDate={w.date}
      initialName={w.name ?? ""}
      initialBlocks={initialBlocks}
      eyebrow="Editar sesión"
      title="Editar entrenamiento"
      submitLabel="Guardar cambios"
      pendingLabel="Guardando…"
      isPending={update.isPending}
      onSubmit={async ({ date, name, entries }) => {
        // Omit `notes` so the workout's existing notes are preserved (the form
        // doesn't edit them); sending notes would overwrite them.
        await update.mutateAsync({ date, name, entries });
        navigate(`/workouts/${id}`);
      }}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS (no remaining `initialEntries` references).

- [ ] **Step 3: Checkpoint** — pause for maintainer review/commit.

---

## Task 11: Web — render groups in the workout detail

**Files:**
- Modify: `apps/web/src/features/history/WorkoutDetailPage.tsx`

- [ ] **Step 1: Add a label map**

Near the top of `WorkoutDetailPage.tsx` (after `LOAD_SUFFIX`), add:

```ts
const GROUP_TYPE_LABELS: Record<string, string> = {
  biserie: "Bi-serie",
  triserie: "Tri-serie",
  superserie: "Superserie",
  circuito: "Circuito",
};
```

- [ ] **Step 2: Group consecutive entries before rendering**

Replace the entries-rendering block (`{w.entries.map((e, i) => ( ... ))}`) with a version that walks entries into render groups first. Insert this just before `return (` in the component:

```tsx
  // Collapse consecutive entries sharing a groupId into render groups.
  type RenderGroup = { groupId: string | null; groupType: string | null; entries: typeof w.entries };
  const renderGroups: RenderGroup[] = [];
  for (const e of w.entries) {
    const last = renderGroups[renderGroups.length - 1];
    if (e.groupId != null && last && last.groupId === e.groupId) {
      last.entries.push(e);
    } else {
      renderGroups.push({ groupId: e.groupId, groupType: e.groupType, entries: [e] });
    }
  }
```

Then replace the `<div className="space-y-3">{w.entries.map(...)}</div>` block with:

```tsx
        {/* Entries */}
        <div className="space-y-3">
          {renderGroups.map((g, gi) => {
            const cards = g.entries.map((e, i) => (
              <Card key={e.id} className="gap-0 py-0">
                <div className="flex items-center gap-3 border-b border-border bg-secondary/40 px-4 py-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/15 font-mono text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <strong className="truncate font-display font-bold">
                    {nameById.get(e.exerciseId) ?? "Ejercicio"}
                  </strong>
                </div>
                <CardContent className="space-y-2 py-4">
                  {e.comment && (
                    <p className="text-sm italic text-muted-foreground">“{e.comment}”</p>
                  )}
                  {e.sets.map((s, si) => (
                    <div key={s.id} className="flex items-center gap-3 text-sm">
                      <span className="font-mono text-xs text-muted-foreground">
                        {String(si + 1).padStart(2, "0")}
                      </span>
                      <span className="h-px flex-1 bg-border" />
                      <span className="font-mono font-medium tabular-nums">{setLabel(s)}</span>
                    </div>
                  ))}
                  {e.durationSeconds != null && (
                    <div className="font-mono text-sm font-medium">
                      {Math.round(e.durationSeconds / 60)} min
                    </div>
                  )}
                  {e.distance != null && (
                    <div className="font-mono text-sm font-medium">
                      {e.distance} {e.distanceUnit}
                    </div>
                  )}
                </CardContent>
              </Card>
            ));

            if (g.groupId == null) return <div key={gi}>{cards}</div>;
            return (
              <div
                key={gi}
                className="space-y-2 rounded-2xl border border-primary/40 bg-primary/5 p-3"
              >
                <span className="font-display text-xs font-bold uppercase tracking-wide text-primary">
                  {GROUP_TYPE_LABELS[g.groupType ?? ""] ?? "Serie"}
                </span>
                {cards}
              </div>
            );
          })}
        </div>
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter web typecheck`
Expected: PASS.

- [ ] **Step 4: Checkpoint** — pause for maintainer review/commit.

---

## Task 12: Web — group container smoke test

**Files:**
- Modify: `apps/web/src/features/workouts/WorkoutForm.test.tsx`

The deep flatten behavior is covered by `blocks.test.ts` (Task 8). Driving the Radix popover / cmdk picker in jsdom is unreliable (the existing test deliberately avoids it), so here we only assert the group container appears.

- [ ] **Step 1: Update `renderForm` and add a test**

In `apps/web/src/features/workouts/WorkoutForm.test.tsx`, change the `renderForm` prop `initialEntries={[]}` to `initialBlocks={[]}`. Then add:

```ts
it("adds a bi/tri-series container when a type is selected", async () => {
  renderForm();
  // The Radix Select trigger for grouped series.
  fireEvent.click(screen.getByText("Añadir serie agrupada"));
  fireEvent.click(await screen.findByRole("option", { name: "Tri-serie" }));
  expect(await screen.findByText("Tri-serie")).toBeInTheDocument();
});
```

> If the vendored Radix `Select` does not expose `role="option"` items in jsdom, fall back to asserting the trigger renders and `addGroup` is wired by querying `screen.getByText("Añadir serie agrupada")` only, and rely on `blocks.test.ts` for behavior. Do not spend more than a few minutes fighting the portal.

- [ ] **Step 2: Run the web tests**

Run: `pnpm --filter web test`
Expected: PASS (existing tests still green with the `initialBlocks` prop rename).

- [ ] **Step 3: Checkpoint** — pause for maintainer review/commit.

---

## Task 13: Full verification

- [ ] **Step 1: Typecheck everything**

Run: `make typecheck`
Expected: PASS.

- [ ] **Step 2: Run the whole suite**

Run: `make test`
Expected: PASS.

- [ ] **Step 3: Manual smoke (optional but recommended)**

Run: `make dev`, create a workout with a tri-series of 3 exercises, save, open the detail (grouped card visible), edit (group reconstructed), and copy to another date (still grouped). 

- [ ] **Step 4: Checkpoint** — pause for maintainer review/commit.

---

## Task 14: Documentation

**Files:**
- Modify: `README.md` and/or files under `docs/`

- [ ] **Step 1: Document the feature**

Update the project docs to describe bi/tri-series: the data model (`group_id` / `group_type` on `workout_entries`), how to create a grouped series in the form, and how grouped entries render in the history. Keep it consistent with the existing docs' tone and structure.

- [ ] **Step 2: Checkpoint** — pause for maintainer review/commit.

---

## Self-review notes

- **Spec coverage:** data model (Task 1), shared types + validation (Tasks 2-3, 6), API persist/serialize/copy + D1 chunk gotcha (Tasks 4-5), web types (Task 7), form "container-first" + explicit type (Tasks 8-9), edit reconstruction (Task 10), display grouping (Task 11), tests (Tasks 4-6, 8, 12), docs (Task 14). All spec sections map to a task.
- **Type consistency:** `GroupType` (`biserie`/`triserie`/`superserie`/`circuito`) is defined once in `common.ts` and reused everywhere; `Block`, `blocksToEntries`, `entriesToBlocks` names are consistent across Tasks 8-11; `initialBlocks` replaces `initialEntries` in all three call sites (WorkoutForm, NewWorkoutPage, EditWorkoutPage).
- **Validation degradation:** the client degrades <2-entry groups to singles (`blocksToEntries`) so the server's `>=2` rule never 400s a normal save.
```
