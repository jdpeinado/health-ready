# Initial Version — Implementation Roadmap

The initial version is delivered in four phases. Each phase produces working,
independently testable software and is captured in its own plan file.

| Phase | Plan file | Delivers |
|-------|-----------|----------|
| 1 | `phase-1-foundation-auth.md` | pnpm monorepo, shared Zod package, D1 + Drizzle schema (all tables), password hashing, sessions, bootstrap-admin, login/logout/me, auth + admin middleware |
| 2 | `phase-2-core-api.md` | Exercise library + admin CRUD, workouts CRUD (nested entries/sets), copy-workout, admin user creation |
| 3 | `phase-3-progress.md` | Canonical load computation (kg-normalized), per-exercise progress time-series endpoint |
| 4 | `phase-4-frontend.md` | API CORS, React + Vite PWA: login, workout logging (hybrid sets), history, copy, progress charts, exercise admin |

Source spec: `specs/initial-version/README.md`

Each phase plan is meant to be executed top-to-bottom via
`superpowers:subagent-driven-development` or `superpowers:executing-plans`.
