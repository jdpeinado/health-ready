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

  it("rejects a group with only one entry (400)", async () => {
    const { cookie } = await seedUser();
    const exId = await seedExercise();
    const res = await post(cookie, {
      date: "2026-05-02", name: null, notes: null,
      entries: [
        { exerciseId: exId, sets: [], groupId: "g1", groupType: "biserie" },
      ],
    });
    expect(res.status).toBe(400);
  });

  it("rejects mixed groupType within one groupId (400)", async () => {
    const { cookie } = await seedUser();
    const a = await seedExercise({ name: "Press" });
    const b = await seedExercise({ name: "Remo" });
    const res = await post(cookie, {
      date: "2026-05-02", name: null, notes: null,
      entries: [
        { exerciseId: a, sets: [], groupId: "g1", groupType: "biserie" },
        { exerciseId: b, sets: [], groupId: "g1", groupType: "triserie" },
      ],
    });
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

  it("replaces all entries when PATCH includes an entries array", async () => {
    const { cookie } = await seedUser();
    const exId = await seedExercise();
    const created = await post(cookie, body(exId, "2026-06-13"));
    const w = await created.json<{ id: string }>();

    const patched = await app.request(
      `/workouts/${w.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({
          date: "2026-06-13",
          name: "Edited",
          entries: [
            {
              exerciseId: exId,
              comment: "de pie",
              sets: [
                { reps: 10, weight: 25, weightUnit: "lb", loadType: "total", barWeight: null },
                { reps: 10, weight: 25, weightUnit: "lb", loadType: "total", barWeight: null },
                { reps: 10, weight: 25, weightUnit: "lb", loadType: "total", barWeight: null },
              ],
            },
          ],
        }),
      },
      env,
    );
    expect(patched.status).toBe(200);
    const detail = await patched.json<{ entries: { sets: unknown[] }[] }>();
    expect(detail.entries).toHaveLength(1);
    expect(detail.entries[0]?.sets).toHaveLength(3);
  });

  // Regression: D1 allows at most ~100 bound parameters per statement. A single
  // multi-row INSERT of many entries/sets (8 columns each) exceeds that and used
  // to 500 with "too many SQL variables". Inserts must be chunked.
  it("creates a workout with more sets than D1's per-query variable limit", async () => {
    const { cookie } = await seedUser();
    const exId = await seedExercise();
    const sets = Array.from({ length: 30 }, () => ({
      reps: 10, weight: 25, weightUnit: "lb", loadType: "total", barWeight: null,
    }));
    const res = await post(cookie, {
      date: "2026-06-13", name: "Big", notes: null,
      entries: [{ exerciseId: exId, sets }],
    });
    expect(res.status).toBe(201);
    const w = await res.json<{ entries: { sets: unknown[] }[] }>();
    expect(w.entries[0]?.sets).toHaveLength(30);
  });

  it("replaces with more entries than D1's per-query variable limit", async () => {
    const { cookie } = await seedUser();
    const exId = await seedExercise();
    const created = await post(cookie, body(exId, "2026-06-13"));
    const w = await created.json<{ id: string }>();

    const entries = Array.from({ length: 20 }, () => ({
      exerciseId: exId,
      sets: [{ reps: 10, weight: 25, weightUnit: "lb", loadType: "total", barWeight: null }],
    }));
    const patched = await app.request(
      `/workouts/${w.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie },
        body: JSON.stringify({ date: "2026-06-13", name: "Edited", entries }),
      },
      env,
    );
    expect(patched.status).toBe(200);
    const detail = await patched.json<{ entries: unknown[] }>();
    expect(detail.entries).toHaveLength(20);
  });

  describe("GET /workouts filters", () => {
    async function seedThree(cookie: string, exId: string) {
      await post(cookie, { date: "2026-01-10", name: "Push day", notes: null, entries: [{ exerciseId: exId, sets: [] }] });
      await post(cookie, { date: "2026-03-15", name: "Pull day", notes: null, entries: [{ exerciseId: exId, sets: [] }] });
      await post(cookie, { date: "2026-06-01", name: "Leg day", notes: null, entries: [{ exerciseId: exId, sets: [] }] });
    }
    async function names(cookie: string, qs: string): Promise<string[]> {
      const res = await app.request(`/workouts${qs}`, { headers: { cookie } }, env);
      expect(res.status).toBe(200);
      const rows = await res.json<{ name: string }[]>();
      return rows.map((r) => r.name);
    }

    it("filters by name substring (q), case-insensitive", async () => {
      const { cookie } = await seedUser();
      const exId = await seedExercise();
      await seedThree(cookie, exId);
      expect(await names(cookie, "?q=day")).toHaveLength(3);
      expect(await names(cookie, "?q=pull")).toEqual(["Pull day"]);
    });

    it("filters by inclusive date range (from / to)", async () => {
      const { cookie } = await seedUser();
      const exId = await seedExercise();
      await seedThree(cookie, exId);
      expect(await names(cookie, "?from=2026-03-01")).toEqual(["Leg day", "Pull day"]);
      expect(await names(cookie, "?to=2026-03-15")).toEqual(["Pull day", "Push day"]);
      expect(await names(cookie, "?from=2026-03-01&to=2026-03-31")).toEqual(["Pull day"]);
    });

    it("combines q and date range (AND)", async () => {
      const { cookie } = await seedUser();
      const exId = await seedExercise();
      await seedThree(cookie, exId);
      expect(await names(cookie, "?q=day&from=2026-06-01")).toEqual(["Leg day"]);
    });

    it("returns all of the user's workouts when no filters are given", async () => {
      const { cookie } = await seedUser();
      const exId = await seedExercise();
      await seedThree(cookie, exId);
      expect(await names(cookie, "")).toHaveLength(3);
    });

    it("never leaks another user's workouts through filters", async () => {
      const a = await seedUser();
      const b = await seedUser();
      const exId = await seedExercise();
      await seedThree(a.cookie, exId);
      expect(await names(b.cookie, "?q=day")).toHaveLength(0);
    });

    it("rejects a malformed date (400)", async () => {
      const { cookie } = await seedUser();
      const res = await app.request("/workouts?from=06-2026", { headers: { cookie } }, env);
      expect(res.status).toBe(400);
    });
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
