# Shared Package (`@health-ready/shared`)

`packages/shared` is the **contract** between the API and the web app. It exports:

1. **Zod schemas** for request validation (used server-side by `@hono/zod-validator`
   and available to the client).
2. **Inferred TypeScript types** (`z.infer`) for those schemas.
3. The canonical **load calculation** (`computeTotalLoadKg`, `toKg`).

Everything is re-exported from `src/index.ts`:

```ts
export * from "./schemas/common.js";
export * from "./schemas/auth.js";
export * from "./schemas/exercise.js";
export * from "./schemas/workout.js";
export * from "./schemas/user.js";
export * from "./load.js";
```

> **Single source of truth:** validation and shared types live here. Import from this
> package on both ends rather than redefining shapes (per `CLAUDE.md`).

## Common enums (`schemas/common.ts`)

| Schema               | Values                                                                | Inferred type  |
| -------------------- | --------------------------------------------------------------------- | -------------- |
| `roleSchema`         | `admin`, `user`                                                       | `Role`         |
| `exerciseTypeSchema` | `strength`, `cardio`, `mobility`                                      | `ExerciseType` |
| `weightUnitSchema`   | `kg`, `lb`                                                            | `WeightUnit`   |
| `loadTypeSchema`     | `total`, `per_side`, `per_dumbbell`, `bodyweight`, `bodyweight_added` | `LoadType`     |

## Auth schemas (`schemas/auth.ts`)

| Schema                 | Shape                                                    |
| ---------------------- | -------------------------------------------------------- |
| `loginSchema`          | `{ email: email, password: min 8 }`                      |
| `bootstrapAdminSchema` | `{ secret, email, password: min 8, displayName }`        |
| `publicUserSchema`     | `{ id, email, displayName, role }` (the safe user shape) |

## Exercise schemas (`schemas/exercise.ts`)

| Schema                 | Shape                                                      |
| ---------------------- | ---------------------------------------------------------- |
| `createExerciseSchema` | `{ name: min 1, type: ExerciseType, muscleGroup?: min 1 }` |
| `updateExerciseSchema` | all of the above optional, plus `isActive?: boolean`       |

## Workout schemas (`schemas/workout.ts`)

The nested workout shape, built bottom-up:

- **`setInputSchema`** — `{ reps?, weight?, weightUnit?, loadType?, barWeight? }`.
  Numbers are non-negative; `reps` is an integer. All fields are `nullish`
  (optional/nullable).
- **`entryInputSchema`** — `{ exerciseId (min 1), comment?, durationSeconds?,
distance?, distanceUnit?, sets: SetInput[] (default []) }`.
- **`createWorkoutSchema`** — `{ date: "YYYY-MM-DD", name?, notes?, entries:
EntryInput[] (default []) }`. `date` is regex-validated to `^\d{4}-\d{2}-\d{2}$`.
- **`updateWorkoutSchema`** — `date?`, `name?`, `notes?`, `entries?`. **When
  `entries` is present it replaces all entries** (documented inline in the schema and
  enforced in [`replaceWorkout`](../api/services.md#replaceworkout)).
- **`copyWorkoutSchema`** — `{ date: "YYYY-MM-DD" }`.

Inferred types: `SetInput`, `EntryInput`, `CreateWorkoutInput`, `UpdateWorkoutInput`,
`CopyWorkoutInput`.

## User schema (`schemas/user.ts`)

`createUserSchema` — `{ email, password: min 8, displayName: min 1, role: Role
(default "user") }`. Inferred: `CreateUserInput`.

## Load calculation (`load.ts`)

This is the heart of the analytics model: a single function that turns whatever the
user entered into a **canonical total external load in kilograms**.

```ts
const LB_TO_KG = 0.45359237;
export function toKg(weight, unit) {
  return unit === "lb" ? weight * LB_TO_KG : weight;
}

export function computeTotalLoadKg(set: {
  weight;
  weightUnit;
  loadType;
  barWeight;
}): number | null {
  if (set.loadType === "bodyweight") return null; // progression is reps, not load
  if (set.weight == null || set.loadType == null) return null;
  const w = toKg(set.weight, set.weightUnit);
  const bar = set.barWeight != null ? toKg(set.barWeight, set.weightUnit) : 0;
  switch (set.loadType) {
    case "total":
      return w; // the number IS the total
    case "per_side":
      return w * 2 + bar; // plates per side ×2, plus the bar
    case "per_dumbbell":
      return w * 2; // both dumbbells
    case "bodyweight_added":
      return w; // just the added load
    default:
      return null;
  }
}
```

Semantics:

- **`bodyweight`** returns `null` — these sets don't contribute to load/volume; the
  Progress page charts reps instead.
- **`total`** — the entered weight is already the whole load (e.g. a machine, a fixed
  dumbbell logged as total).
- **`per_side`** — the weight is what's on _one_ side of a barbell; doubled, plus the
  bar's own weight.
- **`per_dumbbell`** — the weight of _one_ dumbbell; doubled for the pair.
- **`bodyweight_added`** — only the _added_ external load is counted (the bodyweight
  itself isn't known to the system).

Units are normalized to kg first (`toKg`), so `kg`/`lb` mixes still compare. This
function is used by the [progress service](../api/services.md#progress-aggregation)
to compute `bestTotalLoadKg` and `totalVolumeKg`. See also
[Domain Concepts](../reference/domain-concepts.md).

## Build

The shared package is built independently (`pnpm build:shared` →
`pnpm --filter @health-ready/shared build`). Note imports use `.js` extensions
(NodeNext/ESM style) even though the sources are `.ts`.
