import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { getDb } from "../src/db/client.js";
import {
  createWorkout,
  getWorkout,
  listWorkouts,
  validateExerciseIds,
  copyWorkout,
} from "../src/services/workouts.js";
import { seedUser, seedExercise } from "./helpers.js";

describe("workout service", () => {
  it("creates a workout with entries and sets, then reads it back nested", async () => {
    const db = getDb(env.DB);
    const { id: userId } = await seedUser();
    const exId = await seedExercise({ name: "Press banca" });

    const workoutId = await createWorkout(db, userId, {
      date: "2026-05-02",
      name: "Rutina 3",
      notes: null,
      entries: [
        {
          exerciseId: exId,
          comment: "felt good",
          durationSeconds: null,
          distance: null,
          distanceUnit: null,
          sets: [
            { reps: 10, weight: 57, weightUnit: "kg", loadType: "total", barWeight: null },
            { reps: 10, weight: 57, weightUnit: "kg", loadType: "total", barWeight: null },
          ],
        },
      ],
    });

    const detail = await getWorkout(db, userId, workoutId);
    expect(detail?.name).toBe("Rutina 3");
    expect(detail?.entries).toHaveLength(1);

    // Existence-checked style for noUncheckedIndexedAccess
    const firstEntry = detail?.entries[0];
    expect(firstEntry?.sets).toHaveLength(2);
    expect(firstEntry?.sets[0]?.setIndex).toBe(0);
    expect(detail?.entryCount).toBe(1);
  });

  it("scopes getWorkout to the owner", async () => {
    const db = getDb(env.DB);
    const owner = await seedUser();
    const other = await seedUser();
    const exId = await seedExercise();
    const id = await createWorkout(db, owner.id, {
      date: "2026-05-02", name: null, notes: null,
      entries: [{ exerciseId: exId, comment: null, durationSeconds: null, distance: null, distanceUnit: null, sets: [] }],
    });
    expect(await getWorkout(db, other.id, id)).toBeNull();
  });

  it("lists a user's workouts newest first and filters by date range", async () => {
    const db = getDb(env.DB);
    const { id: userId } = await seedUser();
    const exId = await seedExercise();
    const mk = (date: string) =>
      createWorkout(db, userId, { date, name: null, notes: null, entries: [{ exerciseId: exId, comment: null, durationSeconds: null, distance: null, distanceUnit: null, sets: [] }] });
    await mk("2026-05-01");
    await mk("2026-05-10");
    await mk("2026-05-20");

    const all = await listWorkouts(db, userId, {});
    expect(all.map((w) => w.date)).toEqual(["2026-05-20", "2026-05-10", "2026-05-01"]);

    const ranged = await listWorkouts(db, userId, { from: "2026-05-05", to: "2026-05-15" });
    expect(ranged.map((w) => w.date)).toEqual(["2026-05-10"]);
  });

  it("validateExerciseIds returns missing ids", async () => {
    const db = getDb(env.DB);
    const exId = await seedExercise();
    expect(await validateExerciseIds(db, [exId])).toEqual([]);
    expect(await validateExerciseIds(db, [exId, "nope"])).toEqual(["nope"]);
  });

  it("round-trips grouped entries (groupId + groupType)", async () => {
    const db = getDb(env.DB);
    const { id: userId } = await seedUser();
    const a = await seedExercise({ name: "Press" });
    const b = await seedExercise({ name: "Remo" });

    const workoutId = await createWorkout(db, userId, {
      date: "2026-05-02",
      name: "Superset day",
      notes: null,
      entries: [
        { exerciseId: a, comment: null, durationSeconds: null, distance: null, distanceUnit: null, sets: [], groupId: "g1", groupType: "biserie" },
        { exerciseId: b, comment: null, durationSeconds: null, distance: null, distanceUnit: null, sets: [], groupId: "g1", groupType: "biserie" },
      ],
    });

    const detail = await getWorkout(db, userId, workoutId);
    const e0 = detail?.entries[0];
    const e1 = detail?.entries[1];
    expect(e0?.groupId).toBe("g1");
    expect(e0?.groupType).toBe("biserie");
    expect(e1?.groupId).toBe("g1");
    expect(e1?.groupType).toBe("biserie");
  });

  it("copyWorkout regenerates groupId but keeps the grouping", async () => {
    const db = getDb(env.DB);
    const { id: userId } = await seedUser();
    const a = await seedExercise({ name: "Press" });
    const b = await seedExercise({ name: "Remo" });

    const srcId = await createWorkout(db, userId, {
      date: "2026-05-02", name: null, notes: null,
      entries: [
        { exerciseId: a, comment: null, durationSeconds: null, distance: null, distanceUnit: null, sets: [], groupId: "g1", groupType: "triserie" },
        { exerciseId: b, comment: null, durationSeconds: null, distance: null, distanceUnit: null, sets: [], groupId: "g1", groupType: "triserie" },
      ],
    });

    const newId = await copyWorkout(db, userId, srcId, "2026-05-09");
    const copy = await getWorkout(db, userId, newId!);
    const c0 = copy?.entries[0];
    const c1 = copy?.entries[1];
    expect(c0?.groupType).toBe("triserie");
    expect(c0?.groupId).not.toBe("g1"); // regenerated
    expect(c0?.groupId).toBe(c1?.groupId); // still grouped together
  });
});
