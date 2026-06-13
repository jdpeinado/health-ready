import { Hono } from "hono";
import { authRoutes } from "./routes/auth.js";
import type { AppEnv } from "./middleware/auth.js";

const app = new Hono<AppEnv>();

app.get("/health", (c) => c.json({ ok: true }));
app.route("/auth", authRoutes);

export default app;
