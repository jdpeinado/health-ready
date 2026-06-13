import { Hono } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { loginSchema, bootstrapAdminSchema } from "@health-ready/shared";
import { getDb } from "../db/client.js";
import { users } from "../db/schema.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { createSession, revokeSession } from "../lib/session.js";
import {
  requireAuth,
  SESSION_COOKIE,
  type AppEnv,
} from "../middleware/auth.js";

// Secure is required in production (HTTPS) but must be off for local `wrangler dev`
// over http, otherwise clients (curl, browsers) won't return the cookie.
function cookieOpts(c: { req: { url: string } }) {
  return {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
  } as const;
}

export const authRoutes = new Hono<AppEnv>();

authRoutes.post(
  "/bootstrap-admin",
  zValidator("json", bootstrapAdminSchema),
  async (c) => {
    const { secret, email, password, displayName } = c.req.valid("json");
    if (secret !== c.env.BOOTSTRAP_SECRET) {
      return c.json({ error: "forbidden" }, 403);
    }
    const db = getDb(c.env.DB);
    const existingAdmin = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "admin"))
      .get();
    if (existingAdmin) return c.json({ error: "admin already exists" }, 409);

    await db.insert(users).values({
      id: crypto.randomUUID(),
      email,
      passwordHash: await hashPassword(password),
      role: "admin",
      displayName,
      createdAt: new Date(),
    });
    return c.json({ ok: true }, 201);
  },
);

authRoutes.post("/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");
  const db = getDb(c.env.DB);
  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .get();
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return c.json({ error: "invalid credentials" }, 401);
  }
  const { token, expiresAt } = await createSession(db, user.id);
  setCookie(c, SESSION_COOKIE, token, { ...cookieOpts(c), expires: expiresAt });
  return c.json({
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  });
});

authRoutes.post("/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await revokeSession(getDb(c.env.DB), token);
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

authRoutes.get("/me", requireAuth, (c) => {
  const u = c.get("user");
  return c.json({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    role: u.role,
  });
});
