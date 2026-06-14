import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { getDb } from "../src/db/client.js";
import { createWorkout } from "../src/services/workouts.js";
import { getProgressSummary } from "../src/services/progress.js";
import { seedUser, seedExercise } from "./helpers.js";

describe("getProgressSummary", () => {
  it("returns no items for a user with no workouts", async () => {
    const db = getDb(env.DB);
    const { id: userId } = await seedUser();
    expect(await getProgressSummary(db, userId)).toEqual({ items: [] });
  });

  it("excludes mobility exercises and exercises with no data", async () => {
    const db = getDb(env.DB);
    const { id: userId } = await seedUser();
    const mobilityId = await seedExercise({ name: "Movilidad cadera", type: "mobility" });
    await seedExercise({ name: "Sin registrar", type: "strength" }); // never logged

    await createWorkout(db, userId, {
      date: "2026-05-05", name: null, notes: null,
      entries: [{ exerciseId: mobilityId, comment: null, durationSeconds: null, distance: null, distanceUnit: null, sets: [] }],
    });

    const summary = await getProgressSummary(db, userId);
    expect(summary.items).toEqual([]);
  });

  it("summarizes a loaded strength exercise in kg, rounded to one decimal", async () => {
    const db = getDb(env.DB);
    const { id: userId } = await seedUser();
    const exId = await seedExercise({ name: "Press banca", type: "strength" });

    await createWorkout(db, userId, {
      date: "2026-05-02", name: null, notes: null,
      entries: [{ exerciseId: exId, comment: null, durationSeconds: null, distance: null, distanceUnit: null,
        sets: [{ reps: 10, weight: 40, weightUnit: "kg", loadType: "total", barWeight: null }] }],
    });
    // 26 lb total → 11.79340162 kg, must round to 11.8
    await createWorkout(db, userId, {
      date: "2026-05-09", name: null, notes: null,
      entries: [{ exerciseId: exId, comment: null, durationSeconds: null, distance: null, distanceUnit: null,
        sets: [{ reps: 8, weight: 26, weightUnit: "lb", loadType: "total", barWeight: null }] }],
    });

    const summary = await getProgressSummary(db, userId);
    expect(summary.items).toHaveLength(1);
    const item = summary.items[0]!;
    expect(item.exerciseId).toBe(exId);
    expect(item.name).toBe("Press banca");
    expect(item.unit).toBe("kg");
    expect(item.points.map((p) => p.date)).toEqual(["2026-05-02", "2026-05-09"]); // ascending
    expect(item.points.map((p) => p.value)).toEqual([40, 11.8]);
    expect(item.latest).toBe(11.8);
    expect(item.peak).toBe(40);
  });

  it("summarizes a bodyweight strength exercise in reps", async () => {
    const db = getDb(env.DB);
    const { id: userId } = await seedUser();
    const exId = await seedExercise({ name: "Dominada", type: "strength" });
    await createWorkout(db, userId, {
      date: "2026-05-05", name: null, notes: null,
      entries: [{ exerciseId: exId, comment: null, durationSeconds: null, distance: null, distanceUnit: null,
        sets: [
          { reps: 6, weight: null, weightUnit: null, loadType: "bodyweight", barWeight: null },
          { reps: 8, weight: null, weightUnit: null, loadType: "bodyweight", barWeight: null },
        ] }],
    });
    const item = (await getProgressSummary(db, userId)).items[0]!;
    expect(item.unit).toBe("reps");
    expect(item.latest).toBe(8);
    expect(item.peak).toBe(8);
  });

  it("summarizes a cardio exercise in minutes", async () => {
    const db = getDb(env.DB);
    const { id: userId } = await seedUser();
    const exId = await seedExercise({ name: "Caminar", type: "cardio" });
    await createWorkout(db, userId, {
      date: "2026-05-05", name: null, notes: null,
      entries: [{ exerciseId: exId, comment: null, durationSeconds: 1800, distance: 3, distanceUnit: "km", sets: [] }],
    });
    const item = (await getProgressSummary(db, userId)).items[0]!;
    expect(item.unit).toBe("min");
    expect(item.latest).toBe(30); // 1800s / 60
  });

  it("sorts items most-recently-trained first", async () => {
    const db = getDb(env.DB);
    const { id: userId } = await seedUser();
    const older = await seedExercise({ name: "Viejo", type: "strength" });
    const newer = await seedExercise({ name: "Nuevo", type: "strength" });
    await createWorkout(db, userId, {
      date: "2026-04-01", name: null, notes: null,
      entries: [{ exerciseId: older, comment: null, durationSeconds: null, distance: null, distanceUnit: null,
        sets: [{ reps: 5, weight: 50, weightUnit: "kg", loadType: "total", barWeight: null }] }],
    });
    await createWorkout(db, userId, {
      date: "2026-06-01", name: null, notes: null,
      entries: [{ exerciseId: newer, comment: null, durationSeconds: null, distance: null, distanceUnit: null,
        sets: [{ reps: 5, weight: 50, weightUnit: "kg", loadType: "total", barWeight: null }] }],
    });
    const summary = await getProgressSummary(db, userId);
    expect(summary.items.map((i) => i.name)).toEqual(["Nuevo", "Viejo"]);
  });

  it("scopes to the requesting user", async () => {
    const db = getDb(env.DB);
    const owner = await seedUser();
    const other = await seedUser();
    const exId = await seedExercise({ type: "strength" });
    await createWorkout(db, owner.id, {
      date: "2026-05-05", name: null, notes: null,
      entries: [{ exerciseId: exId, comment: null, durationSeconds: null, distance: null, distanceUnit: null,
        sets: [{ reps: 5, weight: 100, weightUnit: "kg", loadType: "total", barWeight: null }] }],
    });
    expect(await getProgressSummary(db, other.id)).toEqual({ items: [] });
  });
});
