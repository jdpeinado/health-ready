import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import app from "../src/index.js";
import { getDb } from "../src/db/client.js";
import { createWorkout } from "../src/services/workouts.js";
import { seedUser, seedExercise } from "./helpers.js";

describe("progress routes", () => {
  it("requires auth", async () => {
    expect((await app.request("/progress/exercises/x", {}, env)).status).toBe(401);
  });

  it("404s for an unknown exercise", async () => {
    const { cookie } = await seedUser();
    const res = await app.request("/progress/exercises/nope", { headers: { cookie } }, env);
    expect(res.status).toBe(404);
  });

  it("returns the time series for the current user", async () => {
    const { id: userId, cookie } = await seedUser();
    const db = getDb(env.DB);
    const exId = await seedExercise({ type: "strength" });
    await createWorkout(db, userId, {
      date: "2026-05-05", name: null, notes: null,
      entries: [{ exerciseId: exId, comment: null, durationSeconds: null, distance: null, distanceUnit: null, sets: [{ reps: 5, weight: 100, weightUnit: "kg", loadType: "total", barWeight: null }] }],
    });
    const res = await app.request(`/progress/exercises/${exId}`, { headers: { cookie } }, env);
    expect(res.status).toBe(200);
    const body = await res.json<{ points: Array<{ bestTotalLoadKg: number }> }>();
    const p0 = body.points[0];
    expect(p0?.bestTotalLoadKg).toBe(100);
  });
});
