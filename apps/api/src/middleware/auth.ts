import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { Env } from "../../worker-configuration.js";
import { getDb } from "../db/client.js";
import { validateSession, type SessionUser } from "../lib/session.js";

export const SESSION_COOKIE = "session";

export interface AppEnv {
  Bindings: Env;
  Variables: { user: SessionUser };
}

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) return c.json({ error: "unauthorized" }, 401);
  const session = await validateSession(getDb(c.env.DB), token);
  if (!session) return c.json({ error: "unauthorized" }, 401);
  c.set("user", session.user);
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get("user").role !== "admin") {
    return c.json({ error: "forbidden" }, 403);
  }
  await next();
});
