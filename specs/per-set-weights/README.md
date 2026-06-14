# Per-Set Varying Weights — Spec

**Date:** 2026-06-14
**Status:** Planned

## Purpose

Two common training patterns can't currently be logged as a single exercise:

1. **First set different** — e.g. one warm-up/top set at one weight, the rest at
   another.
2. **Ramping / pyramid** — each set a different weight, climbing or dropping.

Today the workout editor forces **uniform** sets: an exercise is described by one
`UniformLine` (`count`, `reps`, `weight`, …) that expands to N identical sets
(`uniformToSets` in `apps/web/src/features/workouts/sets.ts`). The only workaround is
adding the same exercise multiple times — once per weight — which clutters the workout
and breaks progress aggregation per exercise.

This feature lets a single exercise hold **sets with different weights/reps**, while
keeping the fast "N identical sets" path for the common case.

## Key finding: the backend already supports this

The DB and API store **individual sets** — each `sets` row has its own `reps`,
`weight`, `weightUnit`, `loadType`, `barWeight` (`apps/api/src/db/schema.ts`), and the
shared `SetInput` schema permits arbitrary per-set values. The progress aggregator
(`computeTotalLoadKg` per set) already handles heterogeneous sets correctly.

**The constraint is purely the editor.** This is therefore a **frontend-only** change
to the draft model and the entry editor. No schema, migration, API, or validation
changes.

## Chosen approach: set "groups" (b blended with c)

Replace the single `DraftEntry.line: UniformLine` with an **ordered list of groups**:

```ts
// sets.ts
interface SetGroup extends UniformLine {} // count + reps/weight/weightUnit/loadType/barWeight
// DraftEntry (strength):
lines: SetGroup[]; // was: line: UniformLine
```

- **Common case (unchanged UX):** one group — "3 × 10 @ 60 kg".
- **First set different (c):** two groups — "1 × 1 @ 60" then "3 × 10 @ 80".
- **Ramping (b):** the editor offers **"editar series individuales"**, which splits a
  group of N into N groups of `count: 1`, each independently editable. A fully-custom
  ramp is just a list of `count: 1` groups.

This single model serves both: a group **is** a uniform run of sets, and an individual
set **is** a group with `count: 1`. No second concept needed.

### Conversions

- **`uniformLinesToSets(lines): SetInput[]`** — `lines.flatMap(uniformToSets)`,
  preserving order; `setIndex` is assigned by final position. Replaces the current
  single-line `uniformToSets` call in `toEntryInput`.
- **`setsToUniformLines(sets): SetGroup[]`** — the inverse: **run-length group**
  consecutive sets that are equal on `(reps, weight, weightUnit, loadType, barWeight)`
  into one `SetGroup` with `count = run length`. A uniform workout collapses to one
  group; a varied one yields several. This **replaces** the lossy
  `fromEntryDetail` logic that currently reads only `entry.sets[0]`.

### This retires an "accepted limitation"

The edit-workout spec (`specs/edit-workout/README.md`) documents that opening a
non-uniform workout in the editor would re-uniform all sets to the first one. With
`setsToUniformLines`, editing now **preserves** per-set values via run-length grouping.
Update that note when this ships.

## Frontend design

### `sets.ts`

- Add `SetGroup` (alias of `UniformLine`).
- Add `uniformLinesToSets(lines)` and `setsToUniformLines(sets)`.
- Keep `uniformToSets(line)` (still used per-group). Keep the per-group `MAX_SETS`
  cap, and add a **total-sets cap per entry** (e.g. 50) so a workout can't balloon.

### `EntryEditor.tsx` (strength branch)

- Render `entry.lines` as an ordered list of group blocks. Each block has the existing
  count/reps/weight/unit/loadType/(bar) inputs.
- Controls:
  - **"Añadir grupo de series"** — appends a new group (defaults cloned from the last
    group, a sensible "add another set at a new weight" gesture).
  - **Remove group** (per block; disabled when only one group remains).
  - **"Editar series individuales"** — splits the entry's groups into `count: 1`
    groups for fully independent per-set editing. (One-way convenience; re-collapsing
    happens automatically on save→reload via run-length grouping.)
- **Single-group entries look the same as today** — don't show group chrome (headers,
  remove button, "añadir grupo") until there's a reason to, or keep it minimal so the
  common case stays clean. Decide exact affordance during implementation; the bar is
  "the 3×10 case is no harder than now."
- Cardio / mobility branches are unchanged (they have no sets).

### `EntryEditor` helpers

- `toEntryInput` (strength) → `sets: uniformLinesToSets(d.lines)`.
- `fromEntryDetail` (strength) → `lines: setsToUniformLines(entry.sets)` (with the
  empty-sets fallback to a single default group).
- `draftFor(ex)` in `WorkoutForm.tsx` → seed `lines: [<default group>]`.

## Data flow (unchanged endpoints)

```
EntryEditor (lines: SetGroup[])
   │ toEntryInput → uniformLinesToSets → ordered SetInput[]
   ▼
POST/PATCH /workouts  → stores individual sets (already chunked for D1 var limit)
   ▼  (on edit)
GET /workouts/:id → expanded sets
   │ fromEntryDetail → setsToUniformLines (run-length) → SetGroup[]
   ▼
EntryEditor  ← round-trips uniform AND varied sets losslessly
```

## Testing

- **`sets.test.ts`:**
  - `uniformLinesToSets` flattens groups in order with correct count.
  - `setsToUniformLines` run-length groups equal consecutive sets; keeps distinct
    weights as separate groups; a uniform list → one group; empty → one default group.
  - **Round-trip:** `uniformLinesToSets(setsToUniformLines(sets))` deep-equals the
    original `sets` for (a) uniform, (b) first-set-different, (c) fully-ramped inputs.
- **`draft.test.ts`:** update existing `fromEntryDetail` tests to the `lines` shape;
  add a varied-weights case proving per-set values survive (the old behavior collapsed
  them — this is the regression guard for the retired limitation).
- **EntryEditor (Testing Library):** add a group, remove a group, "editar series
  individuales" splits into `count: 1` groups; total-sets cap enforced.
- Network-free; guard indexed access (`noUncheckedIndexedAccess`).

## Out of scope (YAGNI)

- Per-set RPE / tempo / rest timers (only weight/reps/load vary).
- Reordering groups by drag (add/remove + order-of-creation is enough initially).
- Backend/schema changes (none needed).
- A separate "ramp generator" (e.g. auto +5 kg) — manual groups first.

## Files touched

| File                                                  | Change                                        |
| ----------------------------------------------------- | --------------------------------------------- |
| `apps/web/src/features/workouts/sets.ts`              | `SetGroup`, `uniformLinesToSets`, `setsToUniformLines`, total cap |
| `apps/web/src/features/workouts/EntryEditor.tsx`      | `lines[]` UI; `toEntryInput`/`fromEntryDetail` updated |
| `apps/web/src/features/workouts/WorkoutForm.tsx`      | `draftFor` seeds `lines: [default]`           |
| `apps/web/src/features/workouts/sets.test.ts`         | conversion + round-trip tests                 |
| `apps/web/src/features/workouts/draft.test.ts`        | `lines`-shape + varied-weights tests          |
| `specs/edit-workout/README.md`                        | remove the "re-uniform" accepted-limitation note |

## Docs to update after implementation

- `docs/web/features.md` — workout entry now supports varying weights via set groups.
- `docs/reference/domain-concepts.md` — update the uniform-sets model description to
  the set-groups model.
