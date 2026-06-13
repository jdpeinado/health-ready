import { Hono } from "hono";
import { cors } from "hono/cors";
import { authRoutes } from "./routes/auth.js";
import { exerciseRoutes } from "./routes/exercises.js";
import { workoutRoutes } from "./routes/workouts.js";
import { userRoutes } from "./routes/users.js";
import { progressRoutes } from "./routes/progress.js";
import type { AppEnv } from "./middleware/auth.js";

const app = new Hono<AppEnv>();

app.use("*", (c, next) =>
  cors({
    origin: c.env.ALLOWED_ORIGIN,
    credentials: true,
  })(c, next),
);

app.get("/health", (c) => c.json({ ok: true }));
app.route("/auth", authRoutes);
app.route("/exercises", exerciseRoutes);
app.route("/workouts", workoutRoutes);
app.route("/users", userRoutes);
app.route("/progress", progressRoutes);

export default app;
