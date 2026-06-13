# Training Tracker — Initial Version Spec

**Date:** 2026-06-13
**Status:** Approved design, pending implementation plan

## Purpose

A personal training-tracking app to replace logging workouts in the iPhone Notes
app. Used by the owner and a small group of friends. Records strength, cardio, and
mobility work per dated session, with a shared exercise library and per-exercise
progress charts over time.

Free to run: Cloudflare's free tiers comfortably cover a handful of users.

## Users & access

- **Roles:** `admin` and `user`.
- **Admin** manages the shared exercise library (create/edit/deactivate) and, in v1,
  creates user accounts.
- **No open registration in v1** — the admin provisions accounts.
- **Logs are fully private** — each user only ever sees their own workouts. The
  exercise library is shared/read-only for regular users.

## Stack

Monorepo (pnpm workspaces):

```
health-ready/
  apps/
    api/      → Hono on Cloudflare Workers (REST API + D1)
    web/      → React + Vite, deployed to Cloudflare Pages (PWA, mobile-first)
  packages/
    shared/   → TypeScript types + Zod schemas shared by both apps
```

- **Backend:** Hono on Cloudflare Workers.
- **Database:** Cloudflare D1 (SQLite) with **Drizzle ORM** for type-safe queries and
  clean migrations (addresses D1's rough migration tooling).
- **Frontend:** React + Vite, mobile-first PWA (installable, usable at the gym).
  Charts via a lightweight lib (Recharts or Chart.js — decide at implementation).
- **Shared validation:** Zod schemas in `packages/shared`, used on both client and
  server.
- **Auth:** Roll-your-own (chosen for future scalability):
  - Passwords hashed with PBKDF2/scrypt via Web Crypto (no native deps on Workers;
    bcrypt is not suitable).
  - Opaque session tokens stored **hashed** in D1, delivered as an httpOnly, secure
    cookie.
  - Hono middleware validates the session on each request and attaches the user/role.

### Alternatives considered

- **Single full-stack app** (SvelteKit / TanStack Start): less plumbing, but couples
  frontend and backend. Rejected — a clean REST API keeps the door open for a native
  mobile app later.
- **Supabase** (Postgres + auth + RLS): less to wire, but leaves the Cloudflare
  ecosystem. Rejected — goal is to stay on Cloudflare.
- **Cloudflare Access / third-party auth (Clerk/Auth0):** less code, but owner chose
  roll-your-own for long-term control and scalability.

## Data model

Naming note: a _training session_ is called a **workout**, to avoid colliding with
auth **sessions**.

```
users
  id, email, password_hash, role (admin | user),
  display_name, created_at

sessions                ← auth sessions
  id, user_id, token_hash, expires_at, created_at

exercises               ← shared library, admin-managed
  id, name, type (strength | cardio | mobility),
  muscle_group (nullable), is_active, created_at

workouts                ← one dated training day, belongs to a user
  id, user_id, date, name (nullable, e.g. "Rutina 3"),
  notes, created_at

workout_entries         ← one exercise performed in a workout, ordered
  id, workout_id, exercise_id, order_index, comment,
  -- cardio fields:
  duration_seconds (nullable), distance (nullable), distance_unit (nullable)
  -- mobility uses just the comment; strength uses the sets table

sets                    ← only for strength entries
  id, entry_id, set_index, reps,
  weight, weight_unit (kg | lb),
  load_type (total | per_side | per_dumbbell | bodyweight | bodyweight_added),
  bar_weight (nullable)   -- for "25kg each + 20kg barra"
```

### Exercise types

The library exercise's `type` determines what gets logged:

- **strength** → sets × reps × load (via the `sets` table)
- **cardio** → `duration_seconds` + optional `distance` / `distance_unit`
- **mobility / warmup** → just done + optional `comment` (no numbers)

### Load model

Structured load capture handles all observed real-world cases:

| Real note                      | load_type        | weight | unit | extra         |
| ------------------------------ | ---------------- | ------ | ---- | ------------- |
| `57kg`                         | total            | 57     | kg   | —             |
| `50lb each` / `cada mancuerna` | per_dumbbell     | 50     | lb   | —             |
| `90lb por lado / 180 total`    | per_side         | 90     | lb   | —             |
| `25kg each + 20kg barra`       | per_side         | 25     | kg   | bar_weight 20 |
| `sin lastre`                   | bodyweight       | —      | —    | —             |
| pull-up `+5kg`                 | bodyweight_added | 5      | kg   | —             |

- **Canonical total load** (computed by the API for charts):
  - `total` → weight
  - `per_side` → weight × 2 (+ bar_weight)
  - `per_dumbbell` → weight × 2
  - `bodyweight_added` → added weight
- **Bodyweight exercises** track progression by **reps**, not weight.
- **Unit (kg/lb) is per-set** — real notes legitimately mix units.

### Hybrid set entry

Fast path: enter one uniform template line (e.g. 3 × 10 × 57kg), which expands into
3 identical `sets` rows. Individual rows are only edited when a session wasn't
uniform (drop sets, varied reps, etc.).

### Soft delete

Exercises are deactivated via `is_active = false` (not hard-deleted) so historical
workouts keep their exercise reference intact.

## Features

- **Auth:** login, logout. (Account creation is admin-only in v1.)
- **Log a workout:** create a dated workout, add entries from the exercise library,
  fast uniform set entry with expand-to-edit.
- **Copy a workout:** duplicate any past workout to a new date (all entries + sets
  cloned), then edit. Primary time-saver given repeating routines.
- **History:** browse/search past workouts by date.
- **Progress:** per-exercise charts (total load and/or reps over time).
- **Exercise library:** everyone reads; admin creates/edits/deactivates.

### Explicitly out of scope for v1 (YAGNI)

- Named routine templates (copy-from-history covers the need).
- Open self-registration.
- Social features / seeing friends' logs.
- Pace / heart-rate for cardio (duration + distance only).

## API surface (Hono, REST)

```
POST   /auth/login
POST   /auth/logout

GET    /exercises                    (all readable)
POST   /exercises                    (admin only)
PATCH  /exercises/:id                (admin only)
DELETE /exercises/:id                (admin only — soft delete)

GET    /workouts                     (current user's, with date filter/search)
GET    /workouts/:id
POST   /workouts                     (create)
POST   /workouts/:id/copy            (duplicate to a new date)
PATCH  /workouts/:id
DELETE /workouts/:id

GET    /progress/exercises/:id       (time series for charts)

# Admin user management (v1: admin creates accounts)
POST   /users                        (admin only)
```

## Frontend

- React + Vite PWA, mobile-first.
- Charts via Recharts or Chart.js.
- Zod schemas from `packages/shared` validate forms client-side and payloads
  server-side.

## Open implementation-time decisions

- Chart library: Recharts vs Chart.js.
- Exact PBKDF2/scrypt parameters and session lifetime.
- Search/filter UX for history.
