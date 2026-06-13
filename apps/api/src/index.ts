import { Hono } from "hono";
import { authRoutes } from "./routes/auth.js";
import { exerciseRoutes } from "./routes/exercises.js";
import { workoutRoutes } from "./routes/workouts.js";
import { userRoutes } from "./routes/users.js";
import type { AppEnv } from "./middleware/auth.js";

const app = new Hono<AppEnv>();

app.get("/health", (c) => c.json({ ok: true }));
app.route("/auth", authRoutes);
app.route("/exercises", exerciseRoutes);
app.route("/workouts", workoutRoutes);
app.route("/users", userRoutes);

export default app;
