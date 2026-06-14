# Progress Summary — Implementation Plan

> **For agentic workers:** implement task-by-task with TDD. Steps use checkbox
> (`- [ ]`) syntax for tracking.
>
> **Git policy:** The user performs ALL git staging and commits. Never run
> `git add`/`git commit`/`git push`. Checkpoint notes mark good commit points.

**Goal:** a batched `GET /progress/summary` endpoint returning one lightweight
sparkline series per exercise with data, and a preview-card grid on the Progress page
that drives the existing detail chart.

**Depends on:** the lb→kg decimals fix (the `roundKg` helper at
`apps/web/src/features/progress/format.ts`) — already shipped.

See `../README.md` for the full design and the API contract.

---

## Task 1: Extract shared aggregation in the progress service

Refactor only — no behavior change. Pull the per-workout accumulation loop out of
`getExerciseProgress` so `getProgressSummary` can reuse it.

**Files:** `apps/api/src/services/progress.ts`

- [ ] **Step 1:** Confirm the existing suite is green first:
      `pnpm --filter @health-ready/api test progress`
- [ ] **Step 2:** Extract a helper, e.g.
      `aggregateEntries(entryRows, setsByEntry): Accumulator[]` (returns per-workout
      points in ascending date order), and have `getExerciseProgress` call it. Keep
      `ProgressPoint` / `ExerciseProgress` exports unchanged.
- [ ] **Step 3:** Re-run `pnpm --filter @health-ready/api test progress` — still green
      (pure refactor; existing tests are the safety net).
- [ ] **Step 4: Checkpoint.** Suggested message:
      `refactor(api): extract shared progress aggregation`

---

## Task 2: `getProgressSummary` service (TDD)

**Files:**
- Modify: `apps/api/src/services/progress.ts`
- Test: `apps/api/test/progress.summary.test.ts` (new)

- [ ] **Step 1: Write the failing test.** Mirror `progress.service.test.ts`. Cover:
  - excludes exercises with no logged entries, and mobility exercises;
  - loaded strength → `unit: "kg"`, `value` = rounded `bestTotalLoadKg` (assert one
    decimal, e.g. an lb load round-trips to `11.8` not `11.793…`);
  - all-bodyweight strength → `unit: "reps"`, `value` = `topReps`;
  - cardio → `unit: "min"`, `value` = minutes;
  - `latest` = last point, `peak` = max;
  - items scoped to the requesting user (another user's data absent);
  - items sorted most-recently-trained first.
- [ ] **Step 2:** Run it — FAIL (`getProgressSummary` not exported).
- [ ] **Step 3:** Implement `getProgressSummary(db, userId)`:
  - select exercises that have ≥1 entry for this user (join entries→workouts), with
    `id`, `name`, `type`;
  - for each, run `aggregateEntries`, collapse each point to the headline `value` per
    the README rules, `roundKg` the kg series, compute `latest`/`peak`, skip mobility
    and empty series, sort by most recent date.
  - Export `ProgressSummary`, `ProgressSummaryItem`, `SparklinePoint` interfaces.
- [ ] **Step 4:** Run the test — PASS.
- [ ] **Step 5: Checkpoint.** `feat(api): add progress summary aggregation`

---

## Task 3: `GET /progress/summary` route (TDD)

**Files:**
- Modify: `apps/api/src/routes/progress.ts`
- Test: `apps/api/test/progress.routes.test.ts`

- [ ] **Step 1:** Add failing route tests: 401 without auth; 200 returns the user's
      items; a second user's data is not leaked.
- [ ] **Step 2:** Run — FAIL (404).
- [ ] **Step 3:** Add `progressRoutes.get("/summary", …)` calling
      `getProgressSummary(db, c.get("user").id)`. (No `:id` collision — distinct path.)
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5:** Full API suite + typecheck:
      `pnpm --filter @health-ready/api test && pnpm -r typecheck`
- [ ] **Step 6: Checkpoint.** `feat(api): add GET /progress/summary route`

---

## Task 4: Web types + hook

**Files:**
- `apps/web/src/api/types.ts` — add `ProgressSummary`, `ProgressSummaryItem`,
  `SparklinePoint` (match the API contract exactly).
- `apps/web/src/features/progress/useProgress.ts` — add:
  ```ts
  export function useProgressSummary() {
    return useQuery<ProgressSummary>({
      queryKey: ["progress-summary"],
      queryFn: () => api("/progress/summary"),
    });
  }
  ```
- [ ] **Step 1:** Add types + hook. **Step 2:** `pnpm --filter @health-ready/web typecheck`.
- [ ] **Step 3: Checkpoint.** `feat(web): progress summary types + hook`

---

## Task 5: `SparklineCard` + preview grid

**Files:**
- Create: `apps/web/src/features/progress/SparklineCard.tsx`
- Modify: `apps/web/src/features/progress/ProgressPage.tsx`

- [ ] **Step 1:** Build `SparklineCard({ item, selected, onClick })`: a small
      `AreaChart` (no `XAxis`/`YAxis`/`CartesianGrid`/`Tooltip`), reusing `AMBER` and
      the gradient; show `item.name`, `item.latest` + `item.unit`. Selected state via
      a ring/border.
- [ ] **Step 2:** In `ProgressPage`, fetch `useProgressSummary()`, render a responsive
      grid of cards above the detail area; clicking sets `exerciseId`. Keep the
      `<Select>` as an alternate selector and the large chart unchanged below.
- [ ] **Step 3:** Adjust the empty state: show the "Elige un ejercicio" prompt only
      when there are no previews; otherwise the grid is the entry point.
- [ ] **Step 4:** `pnpm --filter @health-ready/web typecheck && pnpm --filter @health-ready/web test`.
- [ ] **Step 5: Checkpoint.** `feat(web): progress preview sparkline grid`

---

## Task 6: Docs + final verification

- [ ] Update `docs/web/features.md` (preview sparklines) and `docs/api/endpoints.md`
      (`GET /progress/summary`).
- [ ] `make test && make typecheck` — full workspace green.
- [ ] Manual smoke (`make dev`): previews render, clicking one opens the detail chart,
      kg headline numbers show one decimal.

## Definition of Done

- `GET /progress/summary` returns one rounded headline series per non-mobility
  exercise with data, scoped to the user; tested (service + route).
- Progress page shows a preview grid; clicking a preview (or the dropdown) opens the
  existing detail chart.
- Full suite + typecheck green; docs updated.
