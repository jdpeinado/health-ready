# Health Ready — Documentation

Welcome to the full documentation for **Health Ready**, a personal training tracker
built as an installable PWA on top of a single Cloudflare Worker.

This is the developer/maintainer reference. For a quick project blurb and the
day-to-day command list, see the repo-root `[README.md](../README.md)` and
`[CLAUDE.md](../CLAUDE.md)`.

## Start here

- **[Project Overview](./01-overview.md)** — what the app is, who it's for, the feature set, and the technology choices at a glance.

## Architecture

- **[Architecture Overview](./architecture/README.md)** — the one-Worker design,
the request lifecycle (API vs. SPA), and how the three packages fit together.
- **[Data Model](./architecture/data-model.md)** — every table, every column, the
relationships, cascade behavior, and an entity diagram.
- **[Authentication](./architecture/authentication.md)** — the roll-your-own auth
system end to end: password hashing, sessions, cookies, middleware, roles.

## Backend (API)

- **[API Overview & Conventions](./api/README.md)** — Hono app structure, error
shapes, validation, serialization rules.
- **[Endpoint Reference](./api/endpoints.md)** — every route, with methods, auth
requirements, request bodies, and responses.
- **[Services / Business Logic](./api/services.md)** — workouts service (create,
replace, copy, list) and the progress aggregation service.
- **[Database & Migrations](./api/database.md)** — D1, Drizzle ORM, the migration
workflow, and local vs. remote databases.

## Frontend (Web)

- **[Web App Overview](./web/README.md)** — Vite + React PWA structure, the
bootstrap, the PWA manifest.
- **[Routing & State](./web/routing-and-state.md)** — React Router layout, the
`Protected` gate, TanStack Query patterns and cache keys.
- **[Features / Pages](./web/features.md)** — a walk through each screen: login,
new workout, history, workout detail, progress, exercise admin.
- **[Design System](./web/design-system.md)** — the "Forge" theme, tokens,
typography, shadcn/ui usage, responsive shell.

## Shared package

- **[Shared Schemas & Load Calculation](./shared/README.md)** — the Zod schemas
used on both ends and the canonical kg-load computation.

## Development & operations

- **[Getting Started](./development/getting-started.md)** — prerequisites, install,
run locally.
- **[Commands](./development/commands.md)** — the full `Makefile` reference.
- **[Testing](./development/testing.md)** — API (workers pool) and web (jsdom) test
setups and conventions.
- **[Deployment](./development/deployment.md)** — first-time Cloudflare setup,
everyday deploys, user management.

## Reference

- **[Domain Concepts & Glossary](./reference/domain-concepts.md)** — load types,
units, progress metrics, and a glossary of terms.

---

> **Doc maintenance note:** these documents describe the code as of the time of
> writing. When you change schemas, routes, or the deploy flow, update the matching
> page. Source of truth is always the code; docs explain intent and wiring.

