# Phase 4: Frontend PWA — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Git policy:** The user performs ALL git staging and commits. Never run `git add`/`git commit`/`git push`. Checkpoint notes mark good commit points.

**Goal:** A mobile-first React PWA (`apps/web`, deployed to Cloudflare Pages) that talks to the Phase 1–3 API: login, log/copy/edit workouts with fast hybrid set entry, browse history, view per-exercise progress charts, and (for admins) manage the exercise library.

**Architecture:** Vite + React + TypeScript SPA. React Router for navigation, TanStack Query for server-state/caching, a thin `fetch` API client that sends the session cookie (`credentials: "include"`). Recharts for progress charts. `vite-plugin-pwa` makes it installable. The API gains CORS-with-credentials so the browser may call it cross-origin. Styling is a single hand-written mobile-first stylesheet (no framework).

**Tech Stack:** Vite, React 18, TypeScript, react-router-dom 6, @tanstack/react-query 5, recharts, vite-plugin-pwa; Vitest + @testing-library/react + jsdom for tests.

**Depends on:** Phases 1–3 (the full API).

**Cookies & origins:** In dev, web runs on `http://localhost:5173` and the API on `http://localhost:8787` — same site (both `localhost`), so the `SameSite=Lax` session cookie is sent on credentialed requests; only CORS headers are needed. In prod, deploy web and API under the **same registrable domain** (e.g. `app.health-ready.app` + `api.health-ready.app`) so the cookie stays same-site. (If you ever split across truly different sites, switch the cookie to `SameSite=None; Secure` and set the exact CORS origin.)

---

## Task 1: Add CORS-with-credentials to the API

**Files:**
- Modify: `apps/api/worker-configuration.d.ts`
- Modify: `apps/api/src/index.ts`
- Modify: `apps/api/wrangler.toml`
- Modify: `apps/api/vitest.config.ts`
- Test: `apps/api/test/cors.test.ts`

- [ ] **Step 1: Add `ALLOWED_ORIGIN` to the Env type**

In `apps/api/worker-configuration.d.ts`, extend the `Env` interface:

```ts
export interface Env {
  DB: D1Database;
  BOOTSTRAP_SECRET: string;
  ALLOWED_ORIGIN: string; // e.g. "http://localhost:5173" or "https://app.health-ready.app"
}
```

- [ ] **Step 2: Add the binding for tests in `apps/api/vitest.config.ts`**

In the `miniflare.bindings` object (next to `BOOTSTRAP_SECRET`), add:

```ts
              ALLOWED_ORIGIN: "http://localhost:5173",
```

- [ ] **Step 3: Write the failing test**

`apps/api/test/cors.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import app from "../src/index.js";

describe("CORS", () => {
  it("echoes the allowed origin and allows credentials", async () => {
    const res = await app.request(
      "/health",
      { headers: { origin: "http://localhost:5173" } },
      env,
    );
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("answers preflight requests", async () => {
    const res = await app.request(
      "/workouts",
      {
        method: "OPTIONS",
        headers: {
          origin: "http://localhost:5173",
          "access-control-request-method": "POST",
        },
      },
      env,
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `pnpm --filter @health-ready/api test cors`
Expected: FAIL — no CORS headers present.

- [ ] **Step 5: Add CORS middleware in `apps/api/src/index.ts`**

Insert the import and `app.use` before the routes:

```ts
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
```

- [ ] **Step 6: Add `ALLOWED_ORIGIN` to `apps/api/wrangler.toml`**

Add a `[vars]` block (used in `wrangler dev` and production):

```toml
[vars]
ALLOWED_ORIGIN = "http://localhost:5173"
```

> For production, override this with your deployed web origin (via `wrangler.toml` per-environment vars or the dashboard).

- [ ] **Step 7: Run the test + full suite**

Run: `pnpm --filter @health-ready/api test cors && pnpm --filter @health-ready/api test`
Expected: CORS PASS; all suites still green.

- [ ] **Step 8: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(api): enable CORS with credentials`

---

## Task 2: Scaffold the web app (Vite + React + PWA)

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/.env.development`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/styles.css`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@health-ready/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "deploy": "wrangler pages deploy dist --project-name health-ready-web"
  },
  "dependencies": {
    "@health-ready/shared": "workspace:*",
    "@tanstack/react-query": "^5.62.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0",
    "recharts": "^2.13.3"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.1",
    "vite-plugin-pwa": "^0.21.1",
    "vitest": "2.1.8",
    "wrangler": "^3.91.0"
  }
}
```

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "types": ["vite/client", "vite-plugin-pwa/client", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `apps/web/vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Health Ready",
        short_name: "HealthReady",
        description: "Personal training tracker",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

- [ ] **Step 4: Create `apps/web/index.html`**

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Health Ready</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `apps/web/.env.development`**

```
VITE_API_URL=http://localhost:8787
```

- [ ] **Step 6: Create `apps/web/src/styles.css`**

```css
:root { --bg:#0f172a; --panel:#1e293b; --fg:#e2e8f0; --muted:#94a3b8; --accent:#38bdf8; --danger:#f87171; }
* { box-sizing: border-box; }
body { margin:0; font-family: system-ui, sans-serif; background:var(--bg); color:var(--fg); }
.app { max-width: 640px; margin: 0 auto; padding: 1rem 1rem 5rem; }
h1,h2,h3 { line-height: 1.2; }
a { color: var(--accent); }
button { font: inherit; padding:.6rem 1rem; border-radius:.5rem; border:0; background:var(--accent); color:#04293a; font-weight:600; }
button.secondary { background:var(--panel); color:var(--fg); }
button.danger { background:var(--danger); color:#3a0404; }
button:disabled { opacity:.5; }
input, select, textarea { font: inherit; width:100%; padding:.55rem; border-radius:.5rem; border:1px solid #334155; background:#0b1220; color:var(--fg); }
label { display:block; margin:.5rem 0 .2rem; color:var(--muted); font-size:.85rem; }
.card { background:var(--panel); border-radius:.75rem; padding:1rem; margin:.75rem 0; }
.row { display:flex; gap:.5rem; align-items:center; }
.row > * { flex:1; }
.nav { position:fixed; bottom:0; left:0; right:0; display:flex; background:var(--panel); border-top:1px solid #334155; }
.nav a { flex:1; text-align:center; padding:.8rem; text-decoration:none; color:var(--muted); }
.nav a.active { color:var(--accent); }
.error { color:var(--danger); }
.muted { color:var(--muted); }
```

- [ ] **Step 7: Create `apps/web/src/main.tsx`** (placeholder app; replaced in Task 4)

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <div className="app">
      <h1>Health Ready</h1>
    </div>
  </React.StrictMode>,
);
```

- [ ] **Step 8: Add PWA icon placeholders**

Create `apps/web/public/icon-192.png` and `apps/web/public/icon-512.png`. Any square PNGs of those sizes work for now (replace with real artwork later).

Run: `pnpm install`
Expected: installs web deps.

- [ ] **Step 9: Verify dev server boots**

Run: `pnpm --filter @health-ready/web dev`
Expected: Vite serves on `http://localhost:5173` showing the "Health Ready" heading. Stop the server.

- [ ] **Step 10: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(web): scaffold vite react PWA shell`

---

## Task 3: API client + response types + test setup

**Files:**
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/src/api/types.ts`
- Create: `apps/web/src/api/client.ts`
- Test: `apps/web/src/api/client.test.ts`

- [ ] **Step 1: Create `apps/web/src/test/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 2: Create `apps/web/src/api/types.ts`** (response DTOs returned by the API)

```ts
import type { ExerciseType, WeightUnit, LoadType, Role } from "@health-ready/shared";

export interface Exercise {
  id: string;
  name: string;
  type: ExerciseType;
  muscleGroup: string | null;
  isActive: boolean;
  createdAt: number;
}

export interface SetDetail {
  id: string;
  setIndex: number;
  reps: number | null;
  weight: number | null;
  weightUnit: WeightUnit | null;
  loadType: LoadType | null;
  barWeight: number | null;
}

export interface EntryDetail {
  id: string;
  exerciseId: string;
  orderIndex: number;
  comment: string | null;
  durationSeconds: number | null;
  distance: number | null;
  distanceUnit: string | null;
  sets: SetDetail[];
}

export interface WorkoutSummary {
  id: string;
  date: string;
  name: string | null;
  notes: string | null;
  createdAt: number;
  entryCount: number;
}

export type WorkoutDetail = WorkoutSummary & { entries: EntryDetail[] };

export interface ProgressPoint {
  date: string;
  workoutId: string;
  bestTotalLoadKg: number | null;
  totalVolumeKg: number | null;
  topReps: number | null;
  maxDurationSeconds: number | null;
  totalDistance: number | null;
}

export interface ExerciseProgress {
  exerciseId: string;
  type: ExerciseType;
  points: ProgressPoint[];
}

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  role: Role;
}
```

- [ ] **Step 3: Write the failing test**

`apps/web/src/api/client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { api, ApiError } from "./client";

const BASE = "http://localhost:8787";

describe("api client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("VITE_API_URL", BASE);
  });

  it("sends credentials and parses JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "1" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await api<{ id: string }>("/auth/me");
    expect(result).toEqual({ id: "1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/auth/me`);
    expect(init.credentials).toBe("include");
  });

  it("throws ApiError with status on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }),
      ),
    );
    await expect(api("/auth/me")).rejects.toMatchObject({ status: 401 });
    await expect(api("/auth/me")).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `pnpm --filter @health-ready/web test client`
Expected: FAIL — module not found.

- [ ] **Step 5: Create `apps/web/src/api/client.ts`**

```ts
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

function baseUrl(): string {
  return import.meta.env.VITE_API_URL ?? "";
}

export async function api<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    credentials: "include",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...init.headers,
    },
    ...init,
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export function apiJson<T = unknown>(
  path: string,
  method: string,
  data: unknown,
): Promise<T> {
  return api<T>(path, { method, body: JSON.stringify(data) });
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @health-ready/web test client`
Expected: PASS (both cases).

- [ ] **Step 7: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(web): add api client and response types`

---

## Task 4: Auth (query/mutations, context, router, protected layout)

**Files:**
- Create: `apps/web/src/auth/useAuth.ts`
- Create: `apps/web/src/auth/LoginPage.tsx`
- Create: `apps/web/src/app/Layout.tsx`
- Create: `apps/web/src/app/Protected.tsx`
- Create: `apps/web/src/app/router.tsx`
- Modify: `apps/web/src/main.tsx`
- Test: `apps/web/src/app/Protected.test.tsx`

- [ ] **Step 1: Create `apps/web/src/auth/useAuth.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiJson, ApiError } from "../api/client";
import type { PublicUser } from "../api/types";
import type { LoginInput } from "@health-ready/shared";

export function useMe() {
  return useQuery<PublicUser | null>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api<PublicUser>("/auth/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => apiJson<PublicUser>("/auth/login", "POST", input),
    onSuccess: (user) => qc.setQueryData(["me"], user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiJson("/auth/logout", "POST", {}),
    onSuccess: () => qc.setQueryData(["me"], null),
  });
}
```

- [ ] **Step 2: Create `apps/web/src/auth/LoginPage.tsx`**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLogin } from "./useAuth";
import { ApiError } from "../api/client";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();
  const navigate = useNavigate();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
      navigate("/");
    } catch {
      /* error shown below */
    }
  }

  const message =
    login.error instanceof ApiError && login.error.status === 401
      ? "Email o contraseña incorrectos"
      : login.error
        ? "No se pudo iniciar sesión"
        : null;

  return (
    <div className="app">
      <h1>Health Ready</h1>
      <form onSubmit={onSubmit} className="card">
        <label htmlFor="email">Email</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="password">Contraseña</label>
        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {message && <p className="error">{message}</p>}
        <button type="submit" disabled={login.isPending} style={{ marginTop: "1rem" }}>
          {login.isPending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/web/src/app/Protected.tsx`**

```tsx
import { Navigate, Outlet } from "react-router-dom";
import { useMe } from "../auth/useAuth";

export function Protected() {
  const me = useMe();
  if (me.isLoading) return <div className="app">Cargando…</div>;
  if (!me.data) return <Navigate to="/login" replace />;
  return <Outlet />;
}
```

- [ ] **Step 4: Create `apps/web/src/app/Layout.tsx`**

```tsx
import { NavLink, Outlet } from "react-router-dom";
import { useMe, useLogout } from "../auth/useAuth";

export function Layout() {
  const me = useMe();
  const logout = useLogout();
  return (
    <>
      <div className="app">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ flex: "unset" }}>Health Ready</h2>
          <button className="secondary" style={{ flex: "unset" }} onClick={() => logout.mutate()}>
            Salir
          </button>
        </div>
        <Outlet />
      </div>
      <nav className="nav">
        <NavLink to="/" end>Hoy</NavLink>
        <NavLink to="/history">Historial</NavLink>
        <NavLink to="/progress">Progreso</NavLink>
        {me.data?.role === "admin" && <NavLink to="/exercises">Ejercicios</NavLink>}
      </nav>
    </>
  );
}
```

- [ ] **Step 5: Create `apps/web/src/app/router.tsx`**

```tsx
import { createBrowserRouter } from "react-router-dom";
import { Protected } from "./Protected";
import { Layout } from "./Layout";
import { LoginPage } from "../auth/LoginPage";
import { NewWorkoutPage } from "../features/workouts/NewWorkoutPage";
import { HistoryPage } from "../features/history/HistoryPage";
import { WorkoutDetailPage } from "../features/history/WorkoutDetailPage";
import { ProgressPage } from "../features/progress/ProgressPage";
import { ExercisesAdminPage } from "../features/exercises/ExercisesAdminPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <Protected />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: "/", element: <NewWorkoutPage /> },
          { path: "/history", element: <HistoryPage /> },
          { path: "/workouts/:id", element: <WorkoutDetailPage /> },
          { path: "/progress", element: <ProgressPage /> },
          { path: "/exercises", element: <ExercisesAdminPage /> },
        ],
      },
    ],
  },
]);
```

> The feature pages are created in Tasks 6–9. Until then this import list won't resolve — implement Task 4's test against `Protected` in isolation (below), and run the app only after Task 9. Build/typecheck of the whole web app happens in Task 10.

- [ ] **Step 6: Replace `apps/web/src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "./app/router";
import "./styles.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 7: Write the test for `Protected`**

`apps/web/src/app/Protected.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Protected } from "./Protected";

function renderAt(initial: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route element={<Protected />}>
            <Route path="/" element={<div>secret</div>} />
          </Route>
          <Route path="/login" element={<div>login screen</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Protected", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("redirects to /login when unauthenticated", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    renderAt("/");
    expect(await screen.findByText("login screen")).toBeInTheDocument();
  });

  it("renders children when authenticated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ id: "1", email: "a@e.com", displayName: "A", role: "user" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    renderAt("/");
    expect(await screen.findByText("secret")).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `pnpm --filter @health-ready/web test Protected`
Expected: PASS (both cases).

- [ ] **Step 9: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(web): add auth, router, protected layout`

---

## Task 5: Exercise library hooks + admin UI

**Files:**
- Create: `apps/web/src/features/exercises/useExercises.ts`
- Create: `apps/web/src/features/exercises/ExercisesAdminPage.tsx`

- [ ] **Step 1: Create `apps/web/src/features/exercises/useExercises.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiJson } from "../../api/client";
import type { Exercise } from "../../api/types";
import type { CreateExerciseInput, UpdateExerciseInput } from "@health-ready/shared";

export function useExercises(includeInactive = false) {
  return useQuery<Exercise[]>({
    queryKey: ["exercises", includeInactive],
    queryFn: () => api(`/exercises${includeInactive ? "?includeInactive=true" : ""}`),
  });
}

export function useCreateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateExerciseInput) => apiJson<Exercise>("/exercises", "POST", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exercises"] }),
  });
}

export function useUpdateExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: UpdateExerciseInput }) =>
      apiJson<Exercise>(`/exercises/${id}`, "PATCH", patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exercises"] }),
  });
}

export function useDeleteExercise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/exercises/${id}`, "DELETE", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exercises"] }),
  });
}
```

- [ ] **Step 2: Create `apps/web/src/features/exercises/ExercisesAdminPage.tsx`**

```tsx
import { useState } from "react";
import type { ExerciseType } from "@health-ready/shared";
import { useExercises, useCreateExercise, useDeleteExercise } from "./useExercises";

const TYPES: ExerciseType[] = ["strength", "cardio", "mobility"];

export function ExercisesAdminPage() {
  const list = useExercises(true);
  const create = useCreateExercise();
  const del = useDeleteExercise();
  const [name, setName] = useState("");
  const [type, setType] = useState<ExerciseType>("strength");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await create.mutateAsync({ name: name.trim(), type });
    setName("");
  }

  return (
    <div>
      <h3>Ejercicios</h3>
      <form onSubmit={add} className="card">
        <label>Nombre</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Press de banca" />
        <label>Tipo</label>
        <select value={type} onChange={(e) => setType(e.target.value as ExerciseType)}>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <button type="submit" disabled={create.isPending} style={{ marginTop: ".75rem" }}>Agregar</button>
      </form>

      {list.isLoading && <p className="muted">Cargando…</p>}
      {list.data?.map((ex) => (
        <div key={ex.id} className="card row" style={{ justifyContent: "space-between" }}>
          <div style={{ flex: 1 }}>
            <strong style={{ opacity: ex.isActive ? 1 : 0.5 }}>{ex.name}</strong>
            <div className="muted">{ex.type}{ex.isActive ? "" : " · inactivo"}</div>
          </div>
          {ex.isActive && (
            <button className="danger" style={{ flex: "unset" }} onClick={() => del.mutate(ex.id)}>
              Desactivar
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(web): add exercise library admin page`

---

## Task 6: Hybrid set logic + New Workout page

**Files:**
- Create: `apps/web/src/features/workouts/sets.ts`
- Create: `apps/web/src/features/workouts/useWorkoutMutations.ts`
- Create: `apps/web/src/features/workouts/EntryEditor.tsx`
- Create: `apps/web/src/features/workouts/NewWorkoutPage.tsx`
- Test: `apps/web/src/features/workouts/sets.test.ts`

The hybrid-set rule (from the spec): the user enters one uniform line (sets × reps ×
weight), which expands into N identical set rows; an "advanced" toggle later lets them
edit rows individually. `uniformToSets` is the pure function that does the expansion.

- [ ] **Step 1: Write the failing test**

`apps/web/src/features/workouts/sets.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { uniformToSets } from "./sets";

describe("uniformToSets", () => {
  it("expands a uniform line into N identical sets", () => {
    const out = uniformToSets({ count: 3, reps: 10, weight: 57, weightUnit: "kg", loadType: "total", barWeight: null });
    expect(out).toHaveLength(3);
    expect(out.every((s) => s.reps === 10 && s.weight === 57 && s.loadType === "total")).toBe(true);
  });

  it("clamps the count to at least 1", () => {
    expect(uniformToSets({ count: 0, reps: 5, weight: null, weightUnit: null, loadType: "bodyweight", barWeight: null })).toHaveLength(1);
  });

  it("caps the count to a sane maximum (20)", () => {
    expect(uniformToSets({ count: 999, reps: 5, weight: 10, weightUnit: "kg", loadType: "total", barWeight: null })).toHaveLength(20);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @health-ready/web test sets`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `apps/web/src/features/workouts/sets.ts`**

```ts
import type { SetInput } from "@health-ready/shared";

export interface UniformLine {
  count: number;
  reps: number | null;
  weight: number | null;
  weightUnit: SetInput["weightUnit"];
  loadType: SetInput["loadType"];
  barWeight: number | null;
}

const MAX_SETS = 20;

export function uniformToSets(line: UniformLine): SetInput[] {
  const count = Math.min(MAX_SETS, Math.max(1, Math.floor(line.count || 1)));
  return Array.from({ length: count }, () => ({
    reps: line.reps,
    weight: line.weight,
    weightUnit: line.weightUnit,
    loadType: line.loadType,
    barWeight: line.barWeight,
  }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @health-ready/web test sets`
Expected: PASS (all 3 cases).

- [ ] **Step 5: Create `apps/web/src/features/workouts/useWorkoutMutations.ts`**

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiJson } from "../../api/client";
import type { WorkoutDetail } from "../../api/types";
import type {
  CreateWorkoutInput,
  UpdateWorkoutInput,
  CopyWorkoutInput,
} from "@health-ready/shared";

export function useCreateWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkoutInput) => apiJson<WorkoutDetail>("/workouts", "POST", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workouts"] }),
  });
}

export function useUpdateWorkout(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateWorkoutInput) => apiJson<WorkoutDetail>(`/workouts/${id}`, "PATCH", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workouts"] });
      qc.invalidateQueries({ queryKey: ["workout", id] });
    },
  });
}

export function useCopyWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: CopyWorkoutInput }) =>
      apiJson<WorkoutDetail>(`/workouts/${id}/copy`, "POST", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workouts"] }),
  });
}

export function useDeleteWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiJson(`/workouts/${id}`, "DELETE", {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workouts"] }),
  });
}
```

- [ ] **Step 6: Create `apps/web/src/features/workouts/EntryEditor.tsx`**

```tsx
import { useState } from "react";
import type { ExerciseType, WeightUnit, LoadType, EntryInput } from "@health-ready/shared";
import { uniformToSets, type UniformLine } from "./sets";

const LOAD_TYPES: LoadType[] = ["total", "per_side", "per_dumbbell", "bodyweight", "bodyweight_added"];

export interface DraftEntry {
  exerciseId: string;
  exerciseName: string;
  exerciseType: ExerciseType;
  comment: string;
  // strength
  line: UniformLine;
  // cardio
  durationMinutes: number | null;
  distance: number | null;
  distanceUnit: string;
}

export function toEntryInput(d: DraftEntry): EntryInput {
  if (d.exerciseType === "strength") {
    return {
      exerciseId: d.exerciseId,
      comment: d.comment || null,
      durationSeconds: null, distance: null, distanceUnit: null,
      sets: uniformToSets(d.line),
    };
  }
  if (d.exerciseType === "cardio") {
    return {
      exerciseId: d.exerciseId,
      comment: d.comment || null,
      durationSeconds: d.durationMinutes != null ? d.durationMinutes * 60 : null,
      distance: d.distance,
      distanceUnit: d.distance != null ? d.distanceUnit : null,
      sets: [],
    };
  }
  // mobility
  return {
    exerciseId: d.exerciseId,
    comment: d.comment || null,
    durationSeconds: null, distance: null, distanceUnit: null,
    sets: [],
  };
}

export function EntryEditor({
  entry,
  onChange,
  onRemove,
}: {
  entry: DraftEntry;
  onChange: (e: DraftEntry) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<DraftEntry>) => onChange({ ...entry, ...patch });
  const setLine = (patch: Partial<UniformLine>) => set({ line: { ...entry.line, ...patch } });

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <strong style={{ flex: 1 }}>{entry.exerciseName}</strong>
        <button className="danger" style={{ flex: "unset" }} onClick={onRemove}>Quitar</button>
      </div>

      {entry.exerciseType === "strength" && (
        <>
          <div className="row">
            <div>
              <label>Series</label>
              <input type="number" min={1} value={entry.line.count}
                onChange={(e) => setLine({ count: Number(e.target.value) })} />
            </div>
            <div>
              <label>Reps</label>
              <input type="number" min={0} value={entry.line.reps ?? ""}
                onChange={(e) => setLine({ reps: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
          </div>
          <div className="row">
            <div>
              <label>Peso</label>
              <input type="number" step="0.5" value={entry.line.weight ?? ""}
                disabled={entry.line.loadType === "bodyweight"}
                onChange={(e) => setLine({ weight: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
            <div>
              <label>Unidad</label>
              <select value={entry.line.weightUnit ?? "kg"}
                onChange={(e) => setLine({ weightUnit: e.target.value as WeightUnit })}>
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </select>
            </div>
          </div>
          <label>Tipo de carga</label>
          <select value={entry.line.loadType ?? "total"}
            onChange={(e) => setLine({ loadType: e.target.value as LoadType })}>
            {LOAD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          {entry.line.loadType === "per_side" && (
            <>
              <label>Peso de la barra</label>
              <input type="number" step="0.5" value={entry.line.barWeight ?? ""}
                onChange={(e) => setLine({ barWeight: e.target.value === "" ? null : Number(e.target.value) })} />
            </>
          )}
        </>
      )}

      {entry.exerciseType === "cardio" && (
        <div className="row">
          <div>
            <label>Minutos</label>
            <input type="number" min={0} value={entry.durationMinutes ?? ""}
              onChange={(e) => set({ durationMinutes: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
          <div>
            <label>Distancia</label>
            <input type="number" step="0.1" value={entry.distance ?? ""}
              onChange={(e) => set({ distance: e.target.value === "" ? null : Number(e.target.value) })} />
          </div>
        </div>
      )}

      <label>Comentario</label>
      <input value={entry.comment} onChange={(e) => set({ comment: e.target.value })}
        placeholder="sin lastre, volviendo de molestia…" />
    </div>
  );
}
```

- [ ] **Step 7: Create `apps/web/src/features/workouts/NewWorkoutPage.tsx`**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Exercise } from "../../api/types";
import { useExercises } from "../exercises/useExercises";
import { useCreateWorkout } from "./useWorkoutMutations";
import { EntryEditor, toEntryInput, type DraftEntry } from "./EntryEditor";

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function draftFor(ex: Exercise): DraftEntry {
  return {
    exerciseId: ex.id,
    exerciseName: ex.name,
    exerciseType: ex.type,
    comment: "",
    line: { count: 3, reps: 10, weight: null, weightUnit: "kg", loadType: "total", barWeight: null },
    durationMinutes: null,
    distance: null,
    distanceUnit: "km",
  };
}

export function NewWorkoutPage() {
  const exercises = useExercises();
  const create = useCreateWorkout();
  const navigate = useNavigate();
  const [date, setDate] = useState(todayIso());
  const [name, setName] = useState("");
  const [entries, setEntries] = useState<DraftEntry[]>([]);
  const [pick, setPick] = useState("");

  function addExercise(id: string) {
    const ex = exercises.data?.find((e) => e.id === id);
    if (ex) setEntries((prev) => [...prev, draftFor(ex)]);
    setPick("");
  }

  async function save() {
    const workout = await create.mutateAsync({
      date,
      name: name.trim() || null,
      notes: null,
      entries: entries.map(toEntryInput),
    });
    navigate(`/workouts/${workout.id}`);
  }

  return (
    <div>
      <h3>Nuevo entrenamiento</h3>
      <div className="card">
        <label>Fecha</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <label>Nombre (opcional)</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Rutina 3 / Pull day" />
      </div>

      {entries.map((entry, i) => (
        <EntryEditor
          key={i}
          entry={entry}
          onChange={(e) => setEntries((prev) => prev.map((x, j) => (j === i ? e : x)))}
          onRemove={() => setEntries((prev) => prev.filter((_, j) => j !== i))}
        />
      ))}

      <div className="card">
        <label>Agregar ejercicio</label>
        <select value={pick} onChange={(e) => addExercise(e.target.value)}>
          <option value="">— elegir —</option>
          {exercises.data?.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
        </select>
      </div>

      <button onClick={save} disabled={create.isPending || entries.length === 0} style={{ width: "100%" }}>
        {create.isPending ? "Guardando…" : "Guardar entrenamiento"}
      </button>
    </div>
  );
}
```

- [ ] **Step 8: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(web): add new workout logging with hybrid sets`

---

## Task 7: History list, workout detail, copy & delete

**Files:**
- Create: `apps/web/src/features/history/useWorkouts.ts`
- Create: `apps/web/src/features/history/HistoryPage.tsx`
- Create: `apps/web/src/features/history/WorkoutDetailPage.tsx`

- [ ] **Step 1: Create `apps/web/src/features/history/useWorkouts.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { WorkoutSummary, WorkoutDetail } from "../../api/types";

export function useWorkouts() {
  return useQuery<WorkoutSummary[]>({
    queryKey: ["workouts"],
    queryFn: () => api("/workouts"),
  });
}

export function useWorkout(id: string) {
  return useQuery<WorkoutDetail>({
    queryKey: ["workout", id],
    queryFn: () => api(`/workouts/${id}`),
  });
}
```

- [ ] **Step 2: Create `apps/web/src/features/history/HistoryPage.tsx`**

```tsx
import { Link } from "react-router-dom";
import { useWorkouts } from "./useWorkouts";

export function HistoryPage() {
  const workouts = useWorkouts();
  if (workouts.isLoading) return <p className="muted">Cargando…</p>;
  if (!workouts.data?.length) return <p className="muted">Aún no hay entrenamientos.</p>;
  return (
    <div>
      <h3>Historial</h3>
      {workouts.data.map((w) => (
        <Link key={w.id} to={`/workouts/${w.id}`} style={{ textDecoration: "none" }}>
          <div className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong style={{ flex: 1 }}>{w.name ?? "Entrenamiento"}</strong>
              <span className="muted" style={{ flex: "unset" }}>{w.date}</span>
            </div>
            <div className="muted">{w.entryCount} ejercicios</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `apps/web/src/features/history/WorkoutDetailPage.tsx`**

```tsx
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useWorkout } from "./useWorkouts";
import { useCopyWorkout, useDeleteWorkout } from "../workouts/useWorkoutMutations";

function setLabel(s: { reps: number | null; weight: number | null; weightUnit: string | null; loadType: string | null; barWeight: number | null }): string {
  const reps = s.reps != null ? `${s.reps} reps` : "";
  if (s.loadType === "bodyweight") return `${reps} (peso corporal)`.trim();
  if (s.weight == null) return reps;
  const bar = s.barWeight != null ? ` + barra ${s.barWeight}` : "";
  const suffix = s.loadType && s.loadType !== "total" ? ` (${s.loadType})` : "";
  return `${reps} · ${s.weight}${s.weightUnit ?? ""}${bar}${suffix}`.trim();
}

export function WorkoutDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const workout = useWorkout(id);
  const copy = useCopyWorkout();
  const del = useDeleteWorkout();
  const [copyDate, setCopyDate] = useState("");

  if (workout.isLoading) return <p className="muted">Cargando…</p>;
  if (!workout.data) return <p className="error">No encontrado.</p>;
  const w = workout.data;

  async function doCopy() {
    if (!copyDate) return;
    const created = await copy.mutateAsync({ id, input: { date: copyDate } });
    navigate(`/workouts/${created.id}`);
  }

  async function doDelete() {
    await del.mutateAsync(id);
    navigate("/history");
  }

  return (
    <div>
      <h3>{w.name ?? "Entrenamiento"} <span className="muted">· {w.date}</span></h3>

      {w.entries.map((e) => (
        <div key={e.id} className="card">
          <strong>{/* exercise name resolved client-side via library if desired */}{e.exerciseId.slice(0, 0)}Ejercicio</strong>
          {e.comment && <div className="muted">{e.comment}</div>}
          {e.sets.map((s) => <div key={s.id}>{setLabel(s)}</div>)}
          {e.durationSeconds != null && <div>{Math.round(e.durationSeconds / 60)} min</div>}
          {e.distance != null && <div>{e.distance} {e.distanceUnit}</div>}
        </div>
      ))}

      <div className="card">
        <label>Copiar a la fecha</label>
        <div className="row">
          <input type="date" value={copyDate} onChange={(e) => setCopyDate(e.target.value)} />
          <button style={{ flex: "unset" }} disabled={!copyDate || copy.isPending} onClick={doCopy}>Copiar</button>
        </div>
      </div>

      <button className="danger" style={{ width: "100%" }} onClick={doDelete} disabled={del.isPending}>
        Eliminar entrenamiento
      </button>
    </div>
  );
}
```

> Note: the detail view shows exercise comments/sets. Resolving each `exerciseId` to its
> display name uses the exercises query — wire it by reading `useExercises()` and looking
> up `e.exerciseId` if you want names here; left minimal to keep the task focused.

- [ ] **Step 4: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(web): add history list and workout detail with copy/delete`

---

## Task 8: Resolve exercise names in the detail view

**Files:**
- Modify: `apps/web/src/features/history/WorkoutDetailPage.tsx`

Replace the placeholder exercise label with a real name lookup from the library.

- [ ] **Step 1: Import the exercises hook**

At the top of `WorkoutDetailPage.tsx`, add:

```tsx
import { useExercises } from "../exercises/useExercises";
```

- [ ] **Step 2: Build a name map and use it**

Inside the component, after `const w = workout.data;`, add:

```tsx
  const exercises = useExercises();
  const nameById = new Map(exercises.data?.map((ex) => [ex.id, ex.name]) ?? []);
```

Then replace the placeholder `<strong>…Ejercicio</strong>` line with:

```tsx
          <strong>{nameById.get(e.exerciseId) ?? "Ejercicio"}</strong>
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @health-ready/web typecheck`
Expected: PASS.

- [ ] **Step 4: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(web): resolve exercise names in workout detail`

---

## Task 9: Progress charts

**Files:**
- Create: `apps/web/src/features/progress/useProgress.ts`
- Create: `apps/web/src/features/progress/ProgressPage.tsx`

- [ ] **Step 1: Create `apps/web/src/features/progress/useProgress.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import type { ExerciseProgress } from "../../api/types";

export function useProgress(exerciseId: string | null) {
  return useQuery<ExerciseProgress>({
    queryKey: ["progress", exerciseId],
    queryFn: () => api(`/progress/exercises/${exerciseId}`),
    enabled: !!exerciseId,
  });
}
```

- [ ] **Step 2: Create `apps/web/src/features/progress/ProgressPage.tsx`**

```tsx
import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { useExercises } from "../exercises/useExercises";
import { useProgress } from "./useProgress";

export function ProgressPage() {
  const exercises = useExercises();
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const progress = useProgress(exerciseId);

  const points = progress.data?.points ?? [];
  const type = progress.data?.type;
  // Bodyweight strength has null load → chart reps; otherwise chart best load (kg).
  const usesReps =
    type !== "cardio" &&
    points.length > 0 &&
    points.every((p) => p.bestTotalLoadKg == null);

  const data = points.map((p) => ({
    date: p.date,
    value: type === "cardio"
      ? (p.maxDurationSeconds != null ? Math.round(p.maxDurationSeconds / 60) : 0)
      : usesReps
        ? (p.topReps ?? 0)
        : (p.bestTotalLoadKg ?? 0),
  }));

  const yLabel = type === "cardio" ? "min" : usesReps ? "reps" : "kg";

  return (
    <div>
      <h3>Progreso</h3>
      <div className="card">
        <label>Ejercicio</label>
        <select value={exerciseId ?? ""} onChange={(e) => setExerciseId(e.target.value || null)}>
          <option value="">— elegir —</option>
          {exercises.data?.map((ex) => <option key={ex.id} value={ex.id}>{ex.name}</option>)}
        </select>
      </div>

      {progress.isLoading && exerciseId && <p className="muted">Cargando…</p>}
      {exerciseId && data.length === 0 && !progress.isLoading && (
        <p className="muted">Sin datos todavía.</p>
      )}
      {data.length > 0 && (
        <div className="card" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
              <YAxis stroke="#94a3b8" fontSize={11} />
              <Tooltip
                contentStyle={{ background: "#1e293b", border: "none" }}
                formatter={(v: number) => [`${v} ${yLabel}`, ""]}
              />
              <Line type="monotone" dataKey="value" stroke="#38bdf8" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `feat(web): add per-exercise progress charts`

---

## Task 10: Full build, typecheck, and end-to-end smoke

**Files:** none (verification)

- [ ] **Step 1: Typecheck and unit tests across the workspace**

Run: `pnpm -r typecheck && pnpm -r test`
Expected: all packages typecheck; api + web test suites green.

- [ ] **Step 2: Production build of the web app**

Run: `pnpm --filter @health-ready/web build`
Expected: `tsc -b` clean and Vite emits `apps/web/dist` (with a generated service worker + manifest).

- [ ] **Step 3: End-to-end smoke (two terminals)**

Terminal A: `pnpm --filter @health-ready/api dev` (serves `:8787`)
Terminal B: `pnpm --filter @health-ready/web dev` (serves `:5173`)

If you haven't bootstrapped an admin yet, run the curl from Phase 1, Task 12, Step 2 against `:8787`.

In the browser at `http://localhost:5173`:
1. Log in with your admin credentials → lands on "Nuevo entrenamiento".
2. Go to **Ejercicios**, add a few (e.g. "Dominada"/strength, "Caminar"/cardio).
3. Back on **Hoy**, pick a date, add exercises, fill sets, **Guardar** → redirected to the detail view.
4. **Historial** shows the workout; open it; **Copiar** to another date works.
5. **Progreso** → pick the exercise → a line chart renders.

Expected: each step works against the live API with the session cookie.

- [ ] **Step 4: Checkpoint**

✋ Good point to commit — **the user handles all git staging/commits**. Suggested message: `chore(web): verify full build and e2e smoke`

---

## Deployment notes (when ready to publish)

- **API:** `pnpm --filter @health-ready/api db:migrate:remote` then `pnpm --filter @health-ready/api deploy`. Set `BOOTSTRAP_SECRET` via `wrangler secret put BOOTSTRAP_SECRET`, and set `ALLOWED_ORIGIN` (in `wrangler.toml` prod vars or the dashboard) to your deployed web origin.
- **Web:** set `VITE_API_URL` to the deployed API origin (e.g. `apps/web/.env.production`), then `pnpm --filter @health-ready/web build && pnpm --filter @health-ready/web deploy`.
- Keep web and API under the **same registrable domain** so the `SameSite=Lax` cookie is sent. Bootstrap the first admin against the deployed API once, then create friends' accounts from the **Ejercicios**-adjacent admin flow / `POST /users`.

---

## Phase 4 Done — Definition of Done

- `pnpm -r typecheck` clean; api + web unit tests green; `apps/web` builds to a PWA bundle.
- Login → log a workout (hybrid sets) → view in history → copy → see progress chart all work end-to-end against the local API.
- Admins can manage the exercise library; regular users cannot.

This completes the initial version across all four phases.
