import { Hono } from "hono";
import app from "./index.js";
import type { AppEnv } from "./middleware/auth.js";

// Production entrypoint: one origin serves both the API and the SPA.
// Keeping them same-origin makes the session cookie first-party, which is
// required for iOS Safari (it blocks the cross-site cookie used when the web
// app and API are on different domains).
//
// `run_worker_first = true` (wrangler.toml) means this Worker runs for every
// request: `/api/*` is handled by the API app (`src/index.ts`), and everything
// else is delegated to the static-asset binding, which serves the built files
// or falls back to `index.html` for client-side routes (not_found_handling =
// "single-page-application").
const worker = new Hono<AppEnv>();

worker.route("/api", app);
worker.all("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default worker;
