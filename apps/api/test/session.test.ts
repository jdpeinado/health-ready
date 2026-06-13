import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "../src/db/client.js";
import { users } from "../src/db/schema.js";
import {
  createSession,
  validateSession,
  revokeSession,
} from "../src/lib/session.js";

async function makeUser() {
  const db = getDb(env.DB);
  const id = crypto.randomUUID();
  await db.insert(users).values({
    id,
    email: `${id}@example.com`,
    passwordHash: "x",
    role: "user",
    displayName: "Test",
    createdAt: new Date(),
  });
  return id;
}

describe("session", () => {
  let userId: string;
  beforeEach(async () => {
    userId = await makeUser();
  });

  it("creates a session and validates its token", async () => {
    const db = getDb(env.DB);
    const { token } = await createSession(db, userId);
    const result = await validateSession(db, token);
    expect(result?.user.id).toBe(userId);
  });

  it("returns null for an unknown token", async () => {
    const db = getDb(env.DB);
    expect(await validateSession(db, "deadbeef")).toBeNull();
  });

  it("returns null after the session is revoked", async () => {
    const db = getDb(env.DB);
    const { token } = await createSession(db, userId);
    await revokeSession(db, token);
    expect(await validateSession(db, token)).toBeNull();
  });

  it("returns null for an expired session", async () => {
    const db = getDb(env.DB);
    const past = new Date(Date.now() - 1000);
    const { token } = await createSession(db, userId, past);
    expect(await validateSession(db, token)).toBeNull();
  });
});
