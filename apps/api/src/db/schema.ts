import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "user"] })
    .notNull()
    .default("user"),
  displayName: text("display_name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const exercises = sqliteTable("exercises", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type", { enum: ["strength", "cardio", "mobility"] }).notNull(),
  muscleGroup: text("muscle_group"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const workouts = sqliteTable("workouts", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  date: text("date").notNull(), // ISO date "YYYY-MM-DD"
  name: text("name"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const workoutEntries = sqliteTable("workout_entries", {
  id: text("id").primaryKey(),
  workoutId: text("workout_id")
    .notNull()
    .references(() => workouts.id, { onDelete: "cascade" }),
  exerciseId: text("exercise_id")
    .notNull()
    .references(() => exercises.id),
  orderIndex: integer("order_index").notNull(),
  comment: text("comment"),
  durationSeconds: integer("duration_seconds"),
  distance: real("distance"),
  distanceUnit: text("distance_unit"),
  groupId: text("group_id"),
  groupType: text("group_type", {
    enum: ["biserie", "triserie", "superserie", "circuito"],
  }),
});

export const sets = sqliteTable("sets", {
  id: text("id").primaryKey(),
  entryId: text("entry_id")
    .notNull()
    .references(() => workoutEntries.id, { onDelete: "cascade" }),
  setIndex: integer("set_index").notNull(),
  reps: integer("reps"),
  weight: real("weight"),
  weightUnit: text("weight_unit", { enum: ["kg", "lb"] }),
  loadType: text("load_type", {
    enum: [
      "total",
      "per_side",
      "per_dumbbell",
      "bodyweight",
      "bodyweight_added",
    ],
  }),
  barWeight: real("bar_weight"),
});
