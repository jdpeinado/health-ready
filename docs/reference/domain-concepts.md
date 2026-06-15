# Domain Concepts & Glossary

This page explains the training-domain model the app encodes — load conventions,
units, and how progress metrics are computed — plus a glossary.

## The workout hierarchy

```
Workout (a dated session)
└── Entry (one exercise performed; has order)
    ├── Sets (strength: reps + weight + load convention)   ← only for strength
    └── duration / distance (cardio)                       ← only for cardio
```

- A **workout** is one training session on a calendar **date** (`YYYY-MM-DD`).
- An **entry** is one exercise within that session. The same exercise can appear
  more than once in a workout.
- **Sets** belong to strength entries. **Cardio** entries instead carry
  `durationSeconds` + `distance`. **Mobility** entries carry neither (just a comment).

## Exercise types

| Type       | What's logged                       | Progress metric                              |
| ---------- | ----------------------------------- | -------------------------------------------- |
| `strength` | sets (reps, weight, load type, bar) | best total load (kg), or reps for bodyweight |
| `cardio`   | duration (and/or distance)          | minutes                                      |
| `mobility` | a comment only                      | — (not charted meaningfully)                 |

## Load types

A single weight number is ambiguous without knowing _how_ it was loaded. The
`loadType` on each set disambiguates, and
[`computeTotalLoadKg`](../shared/README.md#load-calculation) converts it to a single
canonical **total load in kg**.

| `loadType`         | Meaning                              | Total load formula            |
| ------------------ | ------------------------------------ | ----------------------------- |
| `total`            | the entered weight is the whole load | `weight`                      |
| `per_side`         | weight on **one** side of a barbell  | `weight × 2 + barWeight`      |
| `per_dumbbell`     | weight of **one** dumbbell           | `weight × 2`                  |
| `bodyweight`       | bodyweight-only movement             | `null` (track reps, not load) |
| `bodyweight_added` | bodyweight + added external load     | `weight` (the added load)     |

Notes:

- `barWeight` only matters for `per_side` (the empty barbell's weight).
- All weights are converted to kg first via `toKg` (`lb × 0.45359237`), so mixed
  units still compare.
- `bodyweight` returns `null` so it contributes nothing to load/volume; the UI charts
  **reps** for such exercises instead.

### Worked examples

| Entry                                 | `weight` | `loadType`         | `barWeight` | unit |      Total kg |
| ------------------------------------- | -------: | ------------------ | ----------: | ---- | ------------: |
| Bench, 20kg plates per side, 20kg bar |       20 | `per_side`         |          20 | kg   |            60 |
| Dumbbell press, 30kg each             |       30 | `per_dumbbell`     |           — | kg   |            60 |
| Leg press machine, 100kg              |      100 | `total`            |           — | kg   |           100 |
| Pull-up + 10kg belt                   |       10 | `bodyweight_added` |           — | kg   |            10 |
| Pull-up, bodyweight                   |        — | `bodyweight`       |           — | —    | null (→ reps) |
| Bench in lb, 45lb per side, 45lb bar  |       45 | `per_side`         |          45 | lb   |         ≈61.2 |

## Units

| Unit field     | Values                          | Notes                                              |
| -------------- | ------------------------------- | -------------------------------------------------- |
| `weightUnit`   | `kg`, `lb`                      | per set; normalized to kg for analytics            |
| `distanceUnit` | free text (UI defaults to `km`) | cardio distance unit (stored as-is, not converted) |

## Progress metrics

`GET /progress/exercises/:id` returns one `ProgressPoint` **per workout** containing
the exercise (oldest → newest). Each point carries every metric; the client picks one
to chart based on the exercise type.

| Metric               | How it's computed (per workout)                            |
| -------------------- | ---------------------------------------------------------- |
| `bestTotalLoadKg`    | max canonical load across the exercise's sets that workout |
| `totalVolumeKg`      | Σ `(canonicalLoadKg × reps)` across those sets             |
| `topReps`            | max `reps` across those sets                               |
| `maxDurationSeconds` | max entry duration (cardio)                                |
| `totalDistance`      | sum of entry distances (cardio)                            |

Bodyweight sets contribute `null` load → they don't affect `bestTotalLoadKg` /
`totalVolumeKg`, which is why the UI falls back to reps for bodyweight strength work.

### Which metric the chart shows

(From `ProgressPage.tsx`:)

1. **cardio** → minutes (`maxDurationSeconds / 60`).
2. **strength where every point's `bestTotalLoadKg` is `null`** (i.e. bodyweight) →
   `topReps`.
3. **otherwise** → `bestTotalLoadKg` (kg).

## Glossary

| Term                        | Definition                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Workout / Entrenamiento** | A dated training session (UI: "Hoy" for today's new one).                                                                                        |
| **Entry**                   | One exercise performed inside a workout.                                                                                                         |
| **Set / Serie**             | One bout of reps for a strength exercise.                                                                                                        |
| **Set group / Uniform line** | The web app's hybrid input: describe N identical sets once (e.g. 3×10 @ 60kg) instead of row-by-row (≤20/group). An entry holds one or more groups, so varying weights (heavier first set, ramps) are supported; flattened to individual sets on save (≤50/entry) and run-length grouped back when editing. |
| **Load type**               | How a set's weight is loaded (total / per-side / per-dumbbell / bodyweight / +added).                                                            |
| **Canonical load**          | A set's load normalized to total kilograms by `computeTotalLoadKg`.                                                                              |
| **Volume**                  | `load × reps`, summed — total work for an exercise in a workout.                                                                                 |
| **Soft delete**             | Exercises are deactivated (`isActive=false`), never removed, to keep history intact.                                                             |
| **Bootstrap admin**         | The one-time creation of the first admin via `BOOTSTRAP_SECRET`.                                                                                 |
| **Session**                 | Server-side auth record; the client holds only an opaque token in an `httpOnly` cookie.                                                          |
| **PWA**                     | Progressive Web App — installable to a phone home screen, standalone display.                                                                    |

## Related pages

- [Shared / Load calculation](../shared/README.md#load-calculation)
- [API / Services — progress aggregation](../api/services.md#progress-aggregation)
- [Web / Features — Progress](../web/features.md#progress-progress)
- [Data Model](../architecture/data-model.md)
