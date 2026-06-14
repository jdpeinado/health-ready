# Create Exercise Modal — Implementation Plan

> **For agentic workers:** implement task-by-task with TDD where practical. Steps use
> checkbox (`- [ ]`) syntax.
>
> **Git policy:** The user performs ALL git staging and commits. Never run
> `git add`/`git commit`/`git push`. Checkpoint notes mark good commit points.

**Goal:** an admin-only "Crear ejercicio" button in the workout form that opens a
modal, creates a base exercise via the existing `requireAdmin` endpoint, and auto-adds
it to the current draft.

**Frontend-only** — `POST /exercises` is already `requireAdmin`-gated; no backend
change. See `../README.md` for the full design.

---

## Task 1: Vendor a Radix `Dialog` component

**Files:**
- Modify: `apps/web/package.json` (add `@radix-ui/react-dialog`)
- Create: `apps/web/src/components/ui/dialog.tsx`

- [ ] **Step 1:** Add `@radix-ui/react-dialog` to `apps/web/package.json` deps and
      `pnpm install`. Match the version style of the other `@radix-ui/*` deps already
      present (the vendored `select.tsx` etc. imply they exist).
- [ ] **Step 2:** Create `dialog.tsx` from the **canonical shadcn/Radix source**
      (NOT the live registry). Export `Dialog`, `DialogTrigger`, `DialogContent`,
      `DialogHeader`, `DialogTitle`, `DialogFooter`, `DialogClose`. Style overlay +
      content to match `select.tsx` (dark-slate tokens, rounded corners, the same
      open/close animations). Use the `@/*` import alias.
- [ ] **Step 3:** `pnpm --filter @health-ready/web typecheck` — clean.
- [ ] **Step 4: Checkpoint.** `feat(web): vendor Radix dialog component`

---

## Task 2: `CreateExerciseDialog` (TDD)

**Files:**
- Create: `apps/web/src/features/exercises/CreateExerciseDialog.tsx`
- Test: `apps/web/src/features/exercises/CreateExerciseDialog.test.tsx` (new)

- [ ] **Step 1: Write failing tests** (Testing Library + jsdom, network-free —
      stub the create mutation / `fetch`):
  - submitting with a name + type calls create with `{ name, type }` and fires
    `onCreated` with the returned exercise;
  - submit is disabled when the name is blank and while pending.
- [ ] **Step 2:** Run — FAIL (component doesn't exist).
- [ ] **Step 3:** Implement `CreateExerciseDialog({ open, onOpenChange, onCreated })`:
      name `<Input>` + type `<Select>` (strength/cardio/mobility), submit calls
      `useCreateExercise().mutateAsync(...)`, then `onCreated(created)` + close. Show a
      generic error on failure.
- [ ] **Step 4:** Run — PASS.
- [ ] **Step 5: Checkpoint.** `feat(web): create-exercise dialog`

---

## Task 3: Wire into `WorkoutForm` (admin-gated, TDD)

**Files:**
- Modify: `apps/web/src/features/workouts/WorkoutForm.tsx`
- Test: a `WorkoutForm` test (new or existing) — mirror `Protected.test.tsx` for
  stubbing `useMe` with a role.

- [ ] **Step 1: Write failing tests:**
  - the "Crear ejercicio" button renders when `useMe` returns `role: "admin"`;
  - it is **absent** when `role: "user"`;
  - invoking the dialog's `onCreated` appends the new exercise to the form entries
    (assert an `EntryEditor` for it appears, or that `onSubmit` would include it).
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Add `dialogOpen` state + `<CreateExerciseDialog>` to `WorkoutForm`;
      render the button only when `useMe().data?.role === "admin"`; wire
      `onCreated={(ex) => addExercise(ex.id)}`.
- [ ] **Step 4:** Run — PASS. Both New and Edit pages inherit the feature (shared form).
- [ ] **Step 5:** `pnpm --filter @health-ready/web typecheck && pnpm --filter @health-ready/web test`.
- [ ] **Step 6: Checkpoint.** `feat(web): inline create-exercise from workout form (admin)`

---

## Task 4: Docs + final verification

- [ ] Update `docs/web/features.md` (admin-only inline exercise creation).
- [ ] `make test && make typecheck` — full workspace green.
- [ ] Manual smoke (`make dev`): as admin, button appears, modal creates + auto-adds;
      log in as a normal user → button absent.

## Definition of Done

- Admins can create an exercise from the workout form via a Radix modal; it is
  auto-added to the draft. Non-admins never see the button. Server-side `requireAdmin`
  remains the source of truth.
- Dialog component vendored from canonical Radix (not the registry), styled to match.
- Full suite + typecheck green; docs updated.
