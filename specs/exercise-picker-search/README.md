# Exercise Picker — Searchable Combobox — Spec

**Date:** 2026-06-15
**Status:** Implemented (2026-06-15)

## Purpose

When adding an exercise to a workout, the user picks from a `<Select>` listing the
**entire** catalog (`WorkoutForm.tsx`). With many exercises the dropdown gets long and
impractical to scan. Replace it with a **searchable combobox**: type to filter, then
pick.

## Key finding: no endpoint needed

`useExercises()` already loads the **full** catalog client-side (`GET /exercises`). A
personal exercise catalog is dozens of items — not enough to justify server-side
search or pagination. So this is a **frontend-only** change: filter the already-loaded
list in the browser. No API, schema, or query-param work.

## Chosen approach: vendored shadcn Combobox (cmdk + Radix Popover)

The canonical shadcn combobox = [`cmdk`](https://cmdk.paco.me/) `Command` inside a
Radix `Popover`. It gives typeahead filtering, keyboard navigation, and accessible
listbox semantics for free, and matches how the rest of the app's primitives are
vendored (we already hand-vendor `select.tsx` and `dialog.tsx`).

Per `CLAUDE.md`, **do not** regenerate from the shadcn registry (it now serves Base
UI). Hand-vendor canonical Radix/cmdk sources styled to match the existing dark-slate
components.

### New dependencies

- `cmdk` (the command/menu primitive)
- `@radix-ui/react-popover` (the floating panel)

Add to `apps/web/package.json` and `pnpm install` (same as the dialog work for #3).

### New vendored components

- `apps/web/src/components/ui/popover.tsx` — Radix Popover (`Popover`,
  `PopoverTrigger`, `PopoverContent`), styled like `SelectContent`
  (`bg-popover`, rounded, bordered, shadow).
- `apps/web/src/components/ui/command.tsx` — cmdk wrappers (`Command`,
  `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`),
  styled to match `SelectItem` (focus/active states, sizing).

### New feature component

`apps/web/src/features/exercises/ExercisePicker.tsx`:

```ts
interface ExercisePickerProps {
  exercises: Exercise[];
  onSelect: (exercise: Exercise) => void;
  placeholder?: string; // default "Buscar ejercicio…"
}
```

- A trigger `Button` ("Agregar ejercicio" with a chevron) opening a `Popover`.
- Inside: a `Command` with a `CommandInput` (search) and a `CommandList` of
  `CommandItem`s, one per exercise. cmdk filters as the user types.
- On pick: call `onSelect(exercise)`, close the popover, reset the query. The picker is
  a **pure selector** — it does not own draft state; the parent appends the entry
  (mirrors today's `addExercise`).
- `CommandEmpty` → "Sin resultados".

### Wiring into `WorkoutForm`

Replace the "Agregar ejercicio" `<Select>` block with `<ExercisePicker
exercises={exercises.data ?? []} onSelect={(ex) => addExercise(ex.id)} />` (or call a
new `addCreatedExercise`-style appender taking the object directly). The **admin-only
"Crear ejercicio"** button and `CreateExerciseDialog` (from #3) stay exactly as they
are, below the picker.

## Testing

cmdk and Radix Popover need a few DOM APIs jsdom lacks. Add to
`apps/web/src/test/setup.ts` (guarded, idempotent):

- `Element.prototype.scrollIntoView`
- `Element.prototype.hasPointerCapture` / `setPointerCapture` / `releasePointerCapture`
- `ResizeObserver`

Then `ExercisePicker.test.tsx` (Testing Library, network-free — pass exercises as a
prop, no hooks to mock):

- renders the trigger; opening shows all exercises.
- typing in the search filters the list (e.g. "ben" → "Bench Press", hides others).
- a non-matching query shows the "Sin resultados" empty state.
- selecting an item calls `onSelect` with that exercise and closes the popover.

A pure `filterExercises(list, query)` helper is **not** required — cmdk owns filtering
— but if the component test proves flaky in jsdom, extract one and unit-test it
directly (decide during implementation).

## Gotcha: don't anchor the popover via `<PopoverTrigger asChild><Button>`

The vendored `Button` is authored React-19-style (**no `forwardRef`**) while the app
runs **React 18**, where `ref` is a special prop that is *not* passed to a plain
function component. Wrapping `Button` in `PopoverTrigger asChild` therefore swallows
the anchor ref: the popover still **opens** (`onClick` is a normal prop and is spread
through) but Radix/floating-ui can't measure the trigger, so the content renders
**off-screen** (observed at `y=-484`). Radix `Select` is unaffected because its wrapper
renders the Radix primitive directly. **Fix:** render `PopoverTrigger` directly as a
styled button (`className={cn(buttonVariants(...), …)}`), like `SelectTrigger` does.
Verified in a real headless-Chromium run (jsdom can't catch positioning bugs).

## Out of scope (YAGNI)

- Server-side exercise search / pagination (catalog is small).
- Grouping the list by type/muscle group, recently-used ordering, or fuzzy ranking
  beyond cmdk's default.
- Reusing the combobox on the Progress page picker (could follow later; not part of
  this change).
- Touching `CreateExerciseDialog` or the admin gating (unchanged).

## Files touched

| File                                                       | Change                                  |
| ---------------------------------------------------------- | --------------------------------------- |
| `apps/web/package.json`                                    | add `cmdk`, `@radix-ui/react-popover`   |
| `apps/web/src/components/ui/popover.tsx`                   | **new** — vendored Radix Popover        |
| `apps/web/src/components/ui/command.tsx`                   | **new** — vendored cmdk wrappers        |
| `apps/web/src/features/exercises/ExercisePicker.tsx`       | **new** — searchable combobox           |
| `apps/web/src/features/exercises/ExercisePicker.test.tsx`  | **new** — open / filter / empty / select |
| `apps/web/src/features/workouts/WorkoutForm.tsx`           | swap `Select` → `ExercisePicker`        |
| `apps/web/src/test/setup.ts`                               | jsdom polyfills for cmdk/popover        |

## Docs to update after implementation

- `docs/web/features.md` — New/Edit Workout: the "Agregar ejercicio" picker is now a
  searchable combobox.
