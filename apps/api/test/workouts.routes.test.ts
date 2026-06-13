import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import app from "../src/index.js";
import { seedUser, seedExercise } from "./helpers.js";

function body(exId: string, date = "2026-05-02") {
  return {
    date, name: "Pull day", notes: null,
    entries: [
      { exerciseId: exId, sets: [{ reps: 6, weight: 0, loadType: "bodyweight" }] },
    ],
  };
}

async function post(cookie: string, b: object) {
  return app.request(
    "/workouts",
    { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(b) },
    env,
  );
}

describe("workouts routes", () => {
  it("requires auth", async () => {
    expect((await app.request("/workouts", {}, env)).status).toBe(401);
  });

  it("creates and fetches a workout", async () => {
    const { cookie } = await seedUser();
    const exId = await seedExercise();
    const created = await post(cookie, body(exId));
    expect(created.status).toBe(201);
    const w = await created.json<{ id: string; entries: unknown[] }>();
    expect(w.entries).toHaveLength(1);

    const got = await app.request(`/workouts/${w.id}`, { headers: { cookie } }, env);
    expect(got.status).toBe(200);
  });

  it("rejects a workout with an unknown exerciseId (400)", async () => {
    const { cookie } = await seedUser();
    const res = await post(cookie, body("does-not-exist"));
    expect(res.status).toBe(400);
  });

  it("does not leak another user's workout (404)", async () => {
    const owner = await seedUser();
    const other = await seedUser();
    const exId = await seedExercise();
    const created = await post(owner.cookie, body(exId));
    const w = await created.json<{ id: string }>();
    const got = await app.request(`/workouts/${w.id}`, { headers: { cookie: other.cookie } }, env);
    expect(got.status).toBe(404);
  });

  it("lists, updates, copies, and deletes", async () => {
    const { cookie } = await seedUser();
    const exId = await seedExercise();
    const created = await post(cookie, body(exId, "2026-05-02"));
    const w = await created.json<{ id: string }>();

    const list = await app.request("/workouts", { headers: { cookie } }, env);
    expect((await list.json<unknown[]>()).length).toBe(1);

    const patched = await app.request(
      `/workouts/${w.id}`,
      { method: "PATCH", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ name: "Pull A" }) },
      env,
    );
    expect(patched.status).toBe(200);
    expect((await patched.json<{ name: string }>()).name).toBe("Pull A");

    const copied = await app.request(
      `/workouts/${w.id}/copy`,
      { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify({ date: "2026-05-09" }) },
      env,
    );
    expect(copied.status).toBe(201);
    const copy = await copied.json<{ id: string; date: string }>();
    expect(copy.date).toBe("2026-05-09");
    expect(copy.id).not.toBe(w.id);

    const del = await app.request(`/workouts/${w.id}`, { method: "DELETE", headers: { cookie } }, env);
    expect(del.status).toBe(200);
    const after = await app.request("/workouts", { headers: { cookie } }, env);
    expect((await after.json<unknown[]>()).length).toBe(1); // only the copy remains
  });
});
