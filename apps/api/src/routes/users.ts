import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { createUserSchema } from "@health-ready/shared";
import { getDb } from "../db/client.js";
import { users } from "../db/schema.js";
import { hashPassword } from "../lib/password.js";
import { requireAuth, requireAdmin, type AppEnv } from "../middleware/auth.js";

export const userRoutes = new Hono<AppEnv>();

userRoutes.use("*", requireAuth, requireAdmin);

userRoutes.post("/", zValidator("json", createUserSchema), async (c) => {
  const { email, password, displayName, role } = c.req.valid("json");
  const db = getDb(c.env.DB);
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
  if (existing) return c.json({ error: "email already exists" }, 409);

  const id = crypto.randomUUID();
  await db.insert(users).values({
    id,
    email,
    passwordHash: await hashPassword(password),
    role,
    displayName,
    createdAt: new Date(),
  });
  return c.json({ id, email, displayName, role }, 201);
});
