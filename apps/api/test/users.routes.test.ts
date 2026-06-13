import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import app from "../src/index.js";
import { seedUser } from "./helpers.js";

async function createUser(cookie: string, body: object) {
  return app.request(
    "/users",
    { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) },
    env,
  );
}

describe("users routes", () => {
  it("forbids non-admins", async () => {
    const { cookie } = await seedUser("user");
    const res = await createUser(cookie, { email: "f@e.com", password: "supersecret", displayName: "F" });
    expect(res.status).toBe(403);
  });

  it("admin creates a user (201) and rejects duplicate email (409)", async () => {
    const admin = await seedUser("admin");
    const first = await createUser(admin.cookie, { email: "friend@e.com", password: "supersecret", displayName: "Friend" });
    expect(first.status).toBe(201);
    const pub = await first.json<{ role: string; email: string }>();
    expect(pub.role).toBe("user");
    expect(pub.email).toBe("friend@e.com");

    const dup = await createUser(admin.cookie, { email: "friend@e.com", password: "supersecret", displayName: "Friend2" });
    expect(dup.status).toBe(409);
  });

  it("created user can log in", async () => {
    const admin = await seedUser("admin");
    await createUser(admin.cookie, { email: "login@e.com", password: "supersecret", displayName: "L" });
    const login = await app.request(
      "/auth/login",
      { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "login@e.com", password: "supersecret" }) },
      env,
    );
    expect(login.status).toBe(200);
  });
});
