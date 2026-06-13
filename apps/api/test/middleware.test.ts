import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { Hono } from "hono";
import { setCookie } from "hono/cookie";
import { getDb } from "../src/db/client.js";
import { users } from "../src/db/schema.js";
import { createSession } from "../src/lib/session.js";
import { requireAuth, requireAdmin } from "../src/middleware/auth.js";
import type { AppEnv } from "../src/middleware/auth.js";

function buildApp() {
  const app = new Hono<AppEnv>();
  app.use("/protected", requireAuth);
  app.get("/protected", (c) => c.json({ id: c.get("user").id }));
  app.use("/admin", requireAuth, requireAdmin);
  app.get("/admin", (c) => c.json({ ok: true }));
  // helper route to mint a cookie for a freshly created user
  app.post("/login-as/:role", async (c) => {
    const role = c.req.param("role") as "admin" | "user";
    const db = getDb(c.env.DB);
    const id = crypto.randomUUID();
    await db.insert(users).values({
      id,
      email: `${id}@e.com`,
      passwordHash: "x",
      role,
      displayName: "T",
      createdAt: new Date(),
    });
    const { token } = await createSession(db, id);
    setCookie(c, "session", token, { httpOnly: true, path: "/" });
    return c.json({ ok: true });
  });
  return app;
}

async function cookieFor(app: ReturnType<typeof buildApp>, role: string) {
  const res = await app.request(`/login-as/${role}`, { method: "POST" }, env);
  return res.headers.get("set-cookie")!.split(";")[0]!;
}

describe("auth middleware", () => {
  it("rejects requests without a session", async () => {
    const app = buildApp();
    const res = await app.request("/protected", {}, env);
    expect(res.status).toBe(401);
  });

  it("allows an authenticated user", async () => {
    const app = buildApp();
    const cookie = await cookieFor(app, "user");
    const res = await app.request("/protected", { headers: { cookie } }, env);
    expect(res.status).toBe(200);
  });

  it("forbids a non-admin on admin routes", async () => {
    const app = buildApp();
    const cookie = await cookieFor(app, "user");
    const res = await app.request("/admin", { headers: { cookie } }, env);
    expect(res.status).toBe(403);
  });

  it("allows an admin on admin routes", async () => {
    const app = buildApp();
    const cookie = await cookieFor(app, "admin");
    const res = await app.request("/admin", { headers: { cookie } }, env);
    expect(res.status).toBe(200);
  });
});
