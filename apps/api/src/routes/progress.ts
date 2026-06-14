import { Hono } from "hono";
import { getDb } from "../db/client.js";
import { requireAuth, type AppEnv } from "../middleware/auth.js";
import { getExerciseProgress, getProgressSummary } from "../services/progress.js";

export const progressRoutes = new Hono<AppEnv>();

progressRoutes.use("*", requireAuth);

progressRoutes.get("/summary", async (c) => {
  const db = getDb(c.env.DB);
  return c.json(await getProgressSummary(db, c.get("user").id));
});

progressRoutes.get("/exercises/:id", async (c) => {
  const db = getDb(c.env.DB);
  const result = await getExerciseProgress(db, c.get("user").id, c.req.param("id"));
  if (!result) return c.json({ error: "not found" }, 404);
  return c.json(result);
});
