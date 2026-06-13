import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import app from "../src/index.js";
import { seedUser } from "./helpers.js";

async function create(cookie: string, body: object) {
  return app.request(
    "/exercises",
    {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    },
    env,
  );
}

describe("exercises routes", () => {
  it("requires auth to list", async () => {
    const res = await app.request("/exercises", {}, env);
    expect(res.status).toBe(401);
  });

  it("forbids non-admin from creating", async () => {
    const { cookie } = await seedUser("user");
    const res = await create(cookie, { name: "Press", type: "strength" });
    expect(res.status).toBe(403);
  });

  it("admin creates, everyone lists active only", async () => {
    const admin = await seedUser("admin");
    const created = await create(admin.cookie, { name: "Press banca", type: "strength" });
    expect(created.status).toBe(201);
    const ex = await created.json<{ id: string; isActive: boolean }>();
    expect(ex.isActive).toBe(true);

    const user = await seedUser("user");
    const list = await app.request("/exercises", { headers: { cookie: user.cookie } }, env);
    expect(list.status).toBe(200);
    const items = await list.json<Array<{ id: string }>>();
    expect(items.some((i) => i.id === ex.id)).toBe(true);
  });

  it("admin updates and soft-deletes; soft-deleted hidden from users", async () => {
    const admin = await seedUser("admin");
    const created = await create(admin.cookie, { name: "Temp", type: "cardio" });
    const ex = await created.json<{ id: string }>();

    const patched = await app.request(
      `/exercises/${ex.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json", cookie: admin.cookie },
        body: JSON.stringify({ name: "Caminar" }),
      },
      env,
    );
    expect(patched.status).toBe(200);
    expect((await patched.json<{ name: string }>()).name).toBe("Caminar");

    const del = await app.request(
      `/exercises/${ex.id}`,
      { method: "DELETE", headers: { cookie: admin.cookie } },
      env,
    );
    expect(del.status).toBe(200);

    const user = await seedUser("user");
    const list = await app.request("/exercises", { headers: { cookie: user.cookie } }, env);
    const items = await list.json<Array<{ id: string }>>();
    expect(items.some((i) => i.id === ex.id)).toBe(false);
  });
});
