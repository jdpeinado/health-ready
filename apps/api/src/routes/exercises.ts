import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { createExerciseSchema, updateExerciseSchema } from "@health-ready/shared";
import { getDb } from "../db/client.js";
import { exercises } from "../db/schema.js";
import { requireAuth, requireAdmin, type AppEnv } from "../middleware/auth.js";

function serialize(row: typeof exercises.$inferSelect) {
  return { ...row, createdAt: row.createdAt.getTime() };
}

export const exerciseRoutes = new Hono<AppEnv>();

exerciseRoutes.use("*", requireAuth);

exerciseRoutes.get("/", async (c) => {
  const db = getDb(c.env.DB);
  const isAdmin = c.get("user").role === "admin";
  const includeInactive = isAdmin && c.req.query("includeInactive") === "true";
  const rows = includeInactive
    ? await db.select().from(exercises)
    : await db.select().from(exercises).where(eq(exercises.isActive, true));
  return c.json(rows.map(serialize));
});

exerciseRoutes.post(
  "/",
  requireAdmin,
  zValidator("json", createExerciseSchema),
  async (c) => {
    const input = c.req.valid("json");
    const db = getDb(c.env.DB);
    const row = {
      id: crypto.randomUUID(),
      name: input.name,
      type: input.type,
      muscleGroup: input.muscleGroup ?? null,
      isActive: true,
      createdAt: new Date(),
    };
    await db.insert(exercises).values(row);
    return c.json(serialize(row), 201);
  },
);

exerciseRoutes.patch(
  "/:id",
  requireAdmin,
  zValidator("json", updateExerciseSchema),
  async (c) => {
    const id = c.req.param("id");
    const input = c.req.valid("json");
    const db = getDb(c.env.DB);
    const patch: Partial<typeof exercises.$inferInsert> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.type !== undefined) patch.type = input.type;
    if (input.muscleGroup !== undefined) patch.muscleGroup = input.muscleGroup ?? null;
    if (input.isActive !== undefined) patch.isActive = input.isActive;
    if (Object.keys(patch).length > 0) {
      await db.update(exercises).set(patch).where(eq(exercises.id, id));
    }
    const row = await db.select().from(exercises).where(eq(exercises.id, id)).get();
    if (!row) return c.json({ error: "not found" }, 404);
    return c.json(serialize(row));
  },
);

exerciseRoutes.delete("/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const db = getDb(c.env.DB);
  const row = await db.select().from(exercises).where(eq(exercises.id, id)).get();
  if (!row) return c.json({ error: "not found" }, 404);
  await db.update(exercises).set({ isActive: false }).where(eq(exercises.id, id));
  return c.json({ ok: true });
});
