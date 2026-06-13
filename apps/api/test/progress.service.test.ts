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

    // noUncheckedIndexedAccess: use existence-checked variable instead of inline index
    const last = progress?.points[1];
    expect(last?.bestTotalLoadKg).toBe(60);
    expect(last?.totalVolumeKg).toBe(50 * 10 + 60 * 8); // 980
    expect(last?.topReps).toBe(10);
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
    const p0 = progress?.points[0];
    expect(p0?.bestTotalLoadKg).toBeNull();
    expect(p0?.topReps).toBe(7);
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
    const p0 = progress?.points[0];
    expect(p0?.maxDurationSeconds).toBe(1800);
    expect(p0?.totalDistance).toBe(3);
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
