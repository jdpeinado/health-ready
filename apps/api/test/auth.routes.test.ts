import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import app from "../src/index.js";

const SECRET = "test-secret"; // matches vitest.config BOOTSTRAP_SECRET

async function bootstrap() {
  return app.request(
    "/auth/bootstrap-admin",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        secret: SECRET,
        email: "admin@e.com",
        password: "supersecret",
        displayName: "Admin",
      }),
    },
    env,
  );
}

describe("auth routes", () => {
  it("rejects bootstrap with a bad secret", async () => {
    const res = await app.request(
      "/auth/bootstrap-admin",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          secret: "wrong",
          email: "a@e.com",
          password: "supersecret",
          displayName: "A",
        }),
      },
      env,
    );
    expect(res.status).toBe(403);
  });

  it("bootstraps the first admin, then refuses a second", async () => {
    expect((await bootstrap()).status).toBe(201);
    expect((await bootstrap()).status).toBe(409);
  });

  it("logs in with correct credentials and rejects wrong ones", async () => {
    await bootstrap();
    const ok = await app.request(
      "/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "admin@e.com", password: "supersecret" }),
      },
      env,
    );
    expect(ok.status).toBe(200);
    expect(ok.headers.get("set-cookie")).toContain("session=");
    const body = await ok.json<{ role: string }>();
    expect(body.role).toBe("admin");

    const bad = await app.request(
      "/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "admin@e.com", password: "nope-nope" }),
      },
      env,
    );
    expect(bad.status).toBe(401);
  });

  it("returns the current user from /auth/me and 401 without a cookie", async () => {
    await bootstrap();
    const login = await app.request(
      "/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "admin@e.com", password: "supersecret" }),
      },
      env,
    );
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;

    const me = await app.request("/auth/me", { headers: { cookie } }, env);
    expect(me.status).toBe(200);
    expect((await me.json<{ email: string }>()).email).toBe("admin@e.com");

    const anon = await app.request("/auth/me", {}, env);
    expect(anon.status).toBe(401);
  });
});
