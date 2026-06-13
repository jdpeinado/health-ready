import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createWorkoutSchema,
  updateWorkoutSchema,
  copyWorkoutSchema,
} from "@health-ready/shared";
import { getDb } from "../db/client.js";
import { requireAuth, type AppEnv } from "../middleware/auth.js";
import {
  createWorkout,
  getWorkout,
  listWorkouts,
  replaceWorkout,
  deleteWorkout,
  copyWorkout,
  validateExerciseIds,
} from "../services/workouts.js";

export const workoutRoutes = new Hono<AppEnv>();

workoutRoutes.use("*", requireAuth);

workoutRoutes.get("/", async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get("user").id;
  const rows = await listWorkouts(db, userId, {
    from: c.req.query("from"),
    to: c.req.query("to"),
    q: c.req.query("q"),
  });
  return c.json(rows);
});

workoutRoutes.get("/:id", async (c) => {
  const db = getDb(c.env.DB);
  const detail = await getWorkout(db, c.get("user").id, c.req.param("id"));
  if (!detail) return c.json({ error: "not found" }, 404);
  return c.json(detail);
});

workoutRoutes.post("/", zValidator("json", createWorkoutSchema), async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get("user").id;
  const input = c.req.valid("json");
  const missing = await validateExerciseIds(db, (input.entries ?? []).map((e) => e.exerciseId));
  if (missing.length) return c.json({ error: "unknown exerciseId", missing }, 400);
  const id = await createWorkout(db, userId, input);
  const detail = await getWorkout(db, userId, id);
  return c.json(detail, 201);
});

workoutRoutes.patch("/:id", zValidator("json", updateWorkoutSchema), async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get("user").id;
  const id = c.req.param("id");
  const input = c.req.valid("json");
  if (input.entries) {
    const missing = await validateExerciseIds(db, (input.entries ?? []).map((e) => e.exerciseId));
    if (missing.length) return c.json({ error: "unknown exerciseId", missing }, 400);
  }
  const ok = await replaceWorkout(db, userId, id, input);
  if (!ok) return c.json({ error: "not found" }, 404);
  return c.json(await getWorkout(db, userId, id));
});

workoutRoutes.delete("/:id", async (c) => {
  const db = getDb(c.env.DB);
  const ok = await deleteWorkout(db, c.get("user").id, c.req.param("id"));
  if (!ok) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});

workoutRoutes.post("/:id/copy", zValidator("json", copyWorkoutSchema), async (c) => {
  const db = getDb(c.env.DB);
  const userId = c.get("user").id;
  const newId = await copyWorkout(db, userId, c.req.param("id"), c.req.valid("json").date);
  if (!newId) return c.json({ error: "not found" }, 404);
  return c.json(await getWorkout(db, userId, newId), 201);
});
