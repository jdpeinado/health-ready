# Project Overview

## What it is

**Health Ready** is a personal **training tracker** — a private web app for logging
workouts (strength and cardio), reviewing past sessions, copying a previous session
to a new date, and watching per-exercise progress over time on charts.

It is built as an installable **Progressive Web App (PWA)**, so on a phone it can be
added to the home screen and behaves like a native app (standalone display, app
icon, offline-capable shell).

The entire product runs on **Cloudflare's free tier**: a _single_ Cloudflare Worker
serves both the JSON API (`/api/*`) and the compiled React app (everything else)
from **one origin**. There is no separate frontend host.

## Who it's for

It's a small, multi-user, invite-only app:

- **Admins** can manage the shared exercise catalog and create user accounts.
- **Users** log their own workouts and see their own history and progress.

There is no public sign-up. The first admin is created once via a bootstrap secret;
after that, admins create everyone else (see
[Authentication](./architecture/authentication.md) and
[Deployment](./development/deployment.md)).

## Core features

| Feature                   | Where           | Notes                                                 |
| ------------------------- | --------------- | ----------------------------------------------------- |
| Email/password login      | `/login`        | Cookie session, 30-day TTL                            |
| Log a workout             | `/` ("Hoy")     | Strength sets, cardio time/distance, mobility         |
| Hybrid set entry          | New Workout     | Enter "3×10 @ 60kg" once; expands to 3 set rows       |
| Workout history           | `/history`      | Cards, newest first, with exercise counts             |
| Workout detail            | `/workouts/:id` | Full set breakdown, copy, delete                      |
| Copy a workout            | Workout detail  | Duplicate a whole session to another date             |
| Progress charts           | `/progress`     | Per-exercise time series (load / reps / minutes)      |
| Exercise catalog admin    | `/exercises`    | Admin-only CRUD; soft-delete (deactivate)             |
| Multiple load conventions | Set entry       | total, per-side+bar, per-dumbbell, bodyweight(+added) |
| kg/lb units               | Set entry       | All loads normalized to kg internally for charts      |

> The UI is in **Spanish** (e.g. "Hoy", "Historial", "Progreso", "Ejercicios").
> The code, API, and data are in English.

## Technology at a glance

| Layer         | Technology                                                                    |
| ------------- | ----------------------------------------------------------------------------- |
| Runtime       | Cloudflare Workers (`nodejs_compat`)                                          |
| API framework | [Hono](https://hono.dev)                                                      |
| Database      | Cloudflare **D1** (SQLite) via [Drizzle ORM](https://orm.drizzle.team)        |
| Auth          | Roll-your-own: PBKDF2 hashing + opaque session tokens in an `httpOnly` cookie |
| Validation    | [Zod](https://zod.dev) schemas in a shared package                            |
| Web build     | [Vite](https://vite.dev) + React 18 + TypeScript                              |
| Routing       | React Router                                                                  |
| Data fetching | TanStack Query                                                                |
| UI kit        | [shadcn/ui](https://ui.shadcn.com) (Radix primitives) + Tailwind CSS v4       |
| Charts        | [Recharts](https://recharts.org)                                              |
| PWA           | `vite-plugin-pwa`                                                             |
| Monorepo      | pnpm workspaces                                                               |
| Tests         | Vitest (`@cloudflare/vitest-pool-workers` for API; jsdom for web)             |
| Tooling/CLI   | Wrangler, a `Makefile` front-end                                              |

## Repository layout

```
health-ready/
├── apps/
│   ├── api/        Cloudflare Worker — JSON API + serves the built web app
│   └── web/        Vite + React + TS PWA (built to apps/web/dist)
├── packages/
│   └── shared/     Zod schemas + inferred types + load math (@health-ready/shared)
├── specs/          Original spec + phased implementation roadmap
├── docs/           ← you are here
├── Makefile        Common tasks (make help)
├── CLAUDE.md       Agent/maintainer guidance
└── README.md       Project blurb + quickstart
```

See [Architecture Overview](./architecture/README.md) for how these pieces connect.

## Design philosophy (observed from the code)

- **One origin, one cookie.** Co-hosting the SPA and API keeps the session cookie
  first-party — required so iOS Safari (which blocks third-party cookies) works.
- **Shared types, single source of validation.** Request shapes are defined once in
  `packages/shared` with Zod and consumed by both the Worker and the React app.
- **Normalize at the edges.** Sets are stored exactly as entered (per-side, lb, etc.)
  but a single function converts everything to a canonical total load in kg for
  progress analytics. See [Domain Concepts](./reference/domain-concepts.md).
- **Numbers are the hero.** The "Forge" dark theme uses tabular/monospace figures so
  data columns line up; the visual language is a strength-training instrument.
