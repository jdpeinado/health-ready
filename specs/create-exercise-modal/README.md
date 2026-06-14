# Create Exercise from the Workout Form (Modal) — Spec

**Date:** 2026-06-14
**Status:** Planned

## Purpose

When building a workout (`WorkoutForm.tsx`), the "Agregar ejercicio" picker only lists
exercises that already exist in the catalog. If the exercise you want isn't there, you
have to leave the form, go to **Ejercicios** (`ExercisesAdminPage`), create it, then
come back and re-build your workout — losing your in-progress draft.

This feature adds a **"Crear ejercicio"** button next to the picker that opens a
**modal** to create the exercise inline. On success the new exercise is created,
the catalog refreshes, and it is **auto-added to the current workout**.

## Access control (important)

Only **admin** users may create base exercises; a normal user picks from the existing
catalog.

- **Server-side (already enforced):** `POST /exercises` is gated by `requireAdmin`
  (`apps/api/src/routes/exercises.ts`). **No backend change is needed** — this feature
  is frontend-only.
- **Client-side (this feature):** show the "Crear ejercicio" button **only when**
  `useMe().data?.role === "admin"` — the same pattern already used for the
  admin-only nav item in `Layout.tsx` (`me.data?.role === "admin"`). Non-admins simply
  don't see the button.

The button is a convenience/UX gate; the real authority is the server's `requireAdmin`.

## What already exists (no backend work)

- **Mutation:** `useCreateExercise()` in
  `apps/web/src/features/exercises/useExercises.ts` — POSTs `/exercises`, invalidates
  `["exercises"]`, and **returns the created `Exercise`** (so we can auto-add it).
- **The same form fields** already exist in `ExercisesAdminPage.tsx` (name input +
  type `<Select>` over `ExerciseType`). We replicate that minimal form inside a modal.
- **Role check:** `useMe()` exposes `role`.

## The modal component (match the app, don't regenerate)

The app has **no Dialog component vendored** — `components/ui/` only has button, card,
input, label, select, textarea. Per `CLAUDE.md`, we **must not** regenerate shadcn
components from the live registry (it now serves a different Base UI API).

**Chosen approach:** hand-vendor a Radix-based dialog at
`apps/web/src/components/ui/dialog.tsx`, copied from the **canonical shadcn/Radix
source** (`@radix-ui/react-dialog`), styled with the existing Tailwind v4 dark-slate
tokens to match the vendored Radix components (`select.tsx` is the reference for
overlay/animation/》token usage). Add the dependency `@radix-ui/react-dialog` to
`apps/web/package.json`.

This keeps the modal consistent with the rest of the UI and reusable for future
dialogs (the create-exercise modal is the first consumer).

## Frontend design

### 1. Vendor `Dialog`

`apps/web/src/components/ui/dialog.tsx` — standard Radix dialog primitives
(`Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`,
`DialogFooter`, `DialogClose`) with the project's styling. Overlay + content
animations consistent with `select.tsx`.

### 2. `CreateExerciseDialog` component

**New file:** `apps/web/src/features/exercises/CreateExerciseDialog.tsx`

- Props: `{ open, onOpenChange, onCreated(exercise: Exercise) }`.
- Body: `name` input + `type` `<Select>` (strength / cardio / mobility), reusing the
  labels already in `ExercisesAdminPage` (`TYPE_META`/`TYPE_LABELS` — extract/share if
  convenient, otherwise duplicate the tiny map).
- Submit: `useCreateExercise().mutateAsync({ name, type })`; on success call
  `onCreated(created)` and close. Disable submit while pending or when name is blank.
- Surface a generic error if the mutation fails (e.g. duplicate name / 403 for a
  non-admin who somehow reaches it).

### 3. Wire into `WorkoutForm`

- `WorkoutForm` already has `addExercise(id)`. Add local `dialogOpen` state and render
  `<CreateExerciseDialog>`; its `onCreated` calls `addExercise(created.id)` (the
  catalog query is invalidated by the mutation, so the new exercise resolves).
- Show the **"Crear ejercicio"** button next to/under the "Agregar ejercicio" picker
  **only if** `useMe().data?.role === "admin"`.
- `WorkoutForm` is shared by New and Edit pages, so both get the feature for free.

## Data flow

```
WorkoutForm (admin only)
  "Crear ejercicio" ──▶ CreateExerciseDialog (open)
                              │  useCreateExercise().mutateAsync({name,type})
                              ▼  POST /exercises  (requireAdmin)
                        created: Exercise
                              │  invalidate ["exercises"]; onCreated(created)
                              ▼
                  WorkoutForm.addExercise(created.id)  ──▶ appended to draft entries
```

## Testing

- **Web (network-free, stub `fetch`/mutation):**
  - `CreateExerciseDialog` calls the create mutation with the entered name/type and
    fires `onCreated` with the result; submit disabled when name blank / pending.
  - The "Crear ejercicio" button renders for `role: "admin"` and is **absent** for
    `role: "user"` (mirror `Protected.test.tsx`, which already stubs `me` with a
    role).
  - On `onCreated`, the exercise is appended to the form's entries.
- **No backend tests** — `POST /exercises` + `requireAdmin` are already covered by the
  existing exercises route tests.
- Guard indexed access (`noUncheckedIndexedAccess`).

## Out of scope (YAGNI)

- Editing/deactivating exercises from the modal (that stays on `ExercisesAdminPage`).
- Letting non-admins propose/create exercises.
- Inline category/muscle metadata beyond the existing name + type.

## Files touched

| File                                                          | Change                                |
| ------------------------------------------------------------- | ------------------------------------- |
| `apps/web/package.json`                                       | add `@radix-ui/react-dialog`          |
| `apps/web/src/components/ui/dialog.tsx`                        | **new** — vendored Radix dialog       |
| `apps/web/src/features/exercises/CreateExerciseDialog.tsx`    | **new** — the modal                   |
| `apps/web/src/features/workouts/WorkoutForm.tsx`              | admin-only button + dialog + auto-add |
| `apps/web/src/features/exercises/*.test.tsx`                  | dialog + role-gating tests            |

## Docs to update after implementation

- `docs/web/features.md` — note inline exercise creation from the workout form
  (admin only).
