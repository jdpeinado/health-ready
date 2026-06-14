# Per-Set Varying Weights — Implementation Plan

> **For agentic workers:** implement task-by-task with TDD. The conversion helpers are
> pure — write their tests first. Steps use checkbox (`- [ ]`) syntax.
>
> **Git policy:** The user performs ALL git staging and commits. Never run
> `git add`/`git commit`/`git push`. Checkpoint notes mark good commit points.

**Goal:** a single strength entry can hold sets with different weights/reps via an
ordered list of "set groups" (`lines: SetGroup[]`), while the common "N identical sets"
case stays as simple as today. **Frontend-only** — the backend already stores
individual sets. See `../README.md`.

**Order matters:** land the pure conversion layer first (fully tested), then the
editor UI, then the round-trip wiring, then docs.

---

## Task 1: Conversion helpers in `sets.ts` (TDD)

**Files:**
- Modify: `apps/web/src/features/workouts/sets.ts`
- Test: `apps/web/src/features/workouts/sets.test.ts`

- [ ] **Step 1: Write failing tests:**
  - `uniformLinesToSets(lines)` flattens groups in order, correct total count.
  - `setsToUniformLines(sets)`: equal consecutive sets → one group; distinct weights →
    separate groups; uniform list → one group; empty → one default group.
  - Round-trip `uniformLinesToSets(setsToUniformLines(sets))` deep-equals original for
    uniform, first-set-different, and fully-ramped inputs.
- [ ] **Step 2:** Run `pnpm --filter @health-ready/web test sets` — FAIL.
- [ ] **Step 3:** Implement:
  - `export type SetGroup = UniformLine;`
  - `uniformLinesToSets(lines: SetGroup[]): SetInput[]` = `lines.flatMap(uniformToSets)`.
  - `setsToUniformLines(sets): SetGroup[]` = run-length group on
    `(reps, weight, weightUnit, loadType, barWeight)`; empty → `[defaultGroup]`.
  - Keep `uniformToSets`; add a `MAX_TOTAL_SETS` cap applied in `uniformLinesToSets`.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5: Checkpoint.** `feat(web): set-group conversion helpers`

---

## Task 2: Update the draft model + `fromEntryDetail`/`toEntryInput` (TDD)

**Files:**
- Modify: `apps/web/src/features/workouts/EntryEditor.tsx` (the `DraftEntry` type and
  the two converters — NOT the JSX yet)
- Modify: `apps/web/src/features/workouts/WorkoutForm.tsx` (`draftFor`)
- Test: `apps/web/src/features/workouts/draft.test.ts`

- [ ] **Step 1: Update failing tests** in `draft.test.ts` to the `lines` shape, and add
      a **varied-weights** case: `fromEntryDetail` of a first-set-different entry yields
      ≥2 groups, and `toEntryInput` of that draft preserves every set's weight (the old
      code collapsed to set[0] — this is the regression guard).
- [ ] **Step 2:** Run `pnpm --filter @health-ready/web test draft` — FAIL.
- [ ] **Step 3:** Change `DraftEntry`: replace `line: UniformLine` with
      `lines: SetGroup[]`. Update `toEntryInput` (strength) →
      `sets: uniformLinesToSets(d.lines)`; `fromEntryDetail` (strength) →
      `lines: setsToUniformLines(entry.sets)`. Update `draftFor` to seed
      `lines: [<default group>]`.
- [ ] **Step 4:** Run `draft` + `sets` tests — PASS. (Editor JSX still references
      `entry.line` → typecheck will fail; that's Task 3.)
- [ ] **Step 5: Checkpoint** (may be combined with Task 3 since typecheck is red until
      the JSX is updated). `feat(web): set-groups draft model + lossless round-trip`

---

## Task 3: `EntryEditor` group UI

**Files:** `apps/web/src/features/workouts/EntryEditor.tsx`
**Test:** `apps/web/src/features/workouts/EntryEditor.test.tsx` (new, Testing Library)

- [ ] **Step 1: Write failing UI tests:** rendering an entry with two groups shows two
      sets of inputs; "Añadir grupo de series" appends a group (cloned from last);
      removing a group works (disabled at one group); "editar series individuales"
      splits into `count: 1` groups; total-sets cap respected.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Rewrite the strength branch to map over `entry.lines`, each group a
      block with the existing count/reps/weight/unit/loadType/(bar per_side) inputs and
      a per-group `setLine(i, patch)`. Add the add/remove/“editar series individuales”
      controls. Keep the single-group case visually clean (no heavy group chrome until
      a 2nd group exists). Cardio/mobility branches unchanged.
- [ ] **Step 4:** Run — PASS. Then `pnpm --filter @health-ready/web typecheck` — clean
      (resolves the Task 2 red typecheck).
- [ ] **Step 5:** `pnpm --filter @health-ready/web test` — full web suite green.
- [ ] **Step 6: Checkpoint.** `feat(web): per-set weights via set-group editor`

---

## Task 4: Retire the edit-workout limitation + docs

**Files:**
- `specs/edit-workout/README.md` — remove the "Known limitation (accepted)" note about
  re-uniforming non-uniform sets (now handled by run-length grouping).
- `docs/web/features.md` — set-groups / varying weights.
- `docs/reference/domain-concepts.md` — update the uniform-sets model to set-groups.

- [ ] Update the three files.
- [ ] `make test && make typecheck` — full workspace green.
- [ ] Manual smoke (`make dev`): create a workout with a heavier first set; save; reopen
      in edit → groups preserved (not collapsed); progress chart for that exercise still
      sane.

## Definition of Done

- A strength entry can hold multiple set groups (and fully individual sets); the
  common N-identical case is no harder than before.
- Saving and reopening round-trips uniform AND varied sets losslessly
  (`uniformLinesToSets ∘ setsToUniformLines` is identity on real data).
- No backend/schema changes. Full suite + typecheck green; the edit-workout limitation
  note is removed; docs updated.
