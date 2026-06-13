import { env } from "cloudflare:test";
import { getDb } from "../src/db/client.js";
import { users, exercises } from "../src/db/schema.js";
import { createSession } from "../src/lib/session.js";

export async function seedUser(role: "admin" | "user" = "user") {
  const db = getDb(env.DB);
  const id = crypto.randomUUID();
  await db.insert(users).values({
    id,
    email: `${id}@example.com`,
    passwordHash: "x",
    role,
    displayName: role === "admin" ? "Admin" : "User",
    createdAt: new Date(),
  });
  const { token } = await createSession(db, id);
  return { id, cookie: `session=${token}` };
}

export async function seedExercise(
  overrides: Partial<{ name: string; type: "strength" | "cardio" | "mobility"; isActive: boolean }> = {},
) {
  const db = getDb(env.DB);
  const id = crypto.randomUUID();
  await db.insert(exercises).values({
    id,
    name: overrides.name ?? "Dominada",
    type: overrides.type ?? "strength",
    muscleGroup: null,
    isActive: overrides.isActive ?? true,
    createdAt: new Date(),
  });
  return id;
}
