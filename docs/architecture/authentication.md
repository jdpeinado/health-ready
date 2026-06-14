# Authentication & Authorization

Health Ready uses **roll-your-own**, cookie-based session auth. There is no external
identity provider and no JWT — just hashed passwords, opaque session tokens, and an
`httpOnly` cookie. This page covers the whole system end to end.

Relevant files:

- `apps/api/src/lib/password.ts` — PBKDF2 hashing/verification
- `apps/api/src/lib/encoding.ts` — hex + constant-time compare helpers
- `apps/api/src/lib/session.ts` — token generation, hashing, validation, revocation
- `apps/api/src/middleware/auth.ts` — `requireAuth` / `requireAdmin`
- `apps/api/src/routes/auth.ts` — bootstrap-admin, login, logout, me

## Passwords (`lib/password.ts`)

Passwords are hashed with **PBKDF2-HMAC-SHA-256** via the Web Crypto API
(`crypto.subtle`), which is available in the Workers runtime.

- **Iterations:** 100,000
- **Key length:** 32 bytes (256 bits)
- **Salt:** 16 random bytes per password (`crypto.getRandomValues`)
- **Stored format:** a single self-describing string:

  ```
  pbkdf2$<iterations>$<saltHex>$<hashHex>
  ```

Storing the iteration count and salt inline means verification is self-contained and
the cost parameter can be raised later without breaking old hashes.

**Verification** re-derives the hash from the supplied password + stored salt +
stored iteration count, then compares using a **constant-time** equality check
(`timingSafeEqual` in `encoding.ts`) to avoid leaking match information via timing.

## Sessions (`lib/session.ts`)

Sessions are **opaque bearer tokens** kept in a cookie. The database never stores the
raw token — only its SHA-256 hash.

- **Token:** 32 random bytes, hex-encoded (`generateToken`).
- **Stored:** `token_hash = SHA-256(token)` in the `sessions` table (unique).
- **TTL:** 30 days (`SESSION_TTL_MS`), recorded in `expires_at`.

Functions:

| Function                                | What it does                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `createSession(db, userId, expiresAt?)` | Inserts a session row, returns `{ token, expiresAt }`. The raw token is returned **once** to be set as the cookie. |
| `validateSession(db, token)`            | Hashes the token, joins `sessions`→`users`, requires `expires_at > now`. Returns `{ user }` or `null`.             |
| `revokeSession(db, token)`              | Deletes the session row by token hash (logout).                                                                    |

Because only the hash is stored, a database leak doesn't expose usable session
tokens, and expiry is enforced in the query (`gt(expiresAt, now)`).

## The cookie (`routes/auth.ts`)

Login sets an `httpOnly` cookie named `session` containing the raw token. The cookie
attributes adapt to the environment via `cookieOpts()`:

```ts
const isHttps = new URL(c.req.url).protocol === "https:";
return {
  httpOnly: true,
  secure: isHttps,
  sameSite: isHttps ? "None" : "Lax",
  path: "/",
};
```

| Environment | Protocol | `SameSite` | `Secure` | Why                                                                                                           |
| ----------- | -------- | ---------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| Production  | https    | `None`     | `true`   | The cookie must survive credentialed cross-site requests; browsers only accept `SameSite=None` when `Secure`. |
| Local dev   | http     | `Lax`      | `false`  | Browsers/curl won't return a `Secure` cookie over plain http, so fall back to `Lax`.                          |

> **Critical deployment constraint (from `CLAUDE.md`):** in production the SPA and API
> share one origin, making this a **first-party** cookie. iOS Safari blocks
> third-party cookies, so **do not** split the web app onto a different domain
> without revisiting `SameSite=None` and ideally adding a Bearer-token path.

## Middleware (`middleware/auth.ts`)

Two Hono middlewares guard routes:

### `requireAuth`

1. Read the `session` cookie. No cookie → `401 {"error":"unauthorized"}`.
2. `validateSession`. Invalid/expired → `401`.
3. On success, set `c.set("user", session.user)` so handlers can read
   `c.get("user")`.

The authenticated user shape (`SessionUser`) is:

```ts
{
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "user";
}
```

### `requireAdmin`

Assumes `requireAuth` already ran (so `c.get("user")` exists). If
`user.role !== "admin"` → `403 {"error":"forbidden"}`.

`requireAdmin` is applied either route-group-wide (`/users`) or per-route
(`POST/PATCH/DELETE /exercises`).

### `AppEnv` typing

`AppEnv` ties the Worker `Bindings` (env, including `DB`) and the request
`Variables` (`{ user: SessionUser }`) into Hono's generic, so `c.env.DB` and
`c.get("user")` are fully typed across the app.

## Auth endpoints (`routes/auth.ts`)

| Endpoint                     | Auth               | Purpose                                         |
| ---------------------------- | ------------------ | ----------------------------------------------- |
| `POST /auth/bootstrap-admin` | secret-gated       | Create the **first** admin (once).              |
| `POST /auth/login`           | none               | Verify credentials, create session, set cookie. |
| `POST /auth/logout`          | none (uses cookie) | Revoke session, clear cookie.                   |
| `GET /auth/me`               | `requireAuth`      | Return the current user.                        |

### `bootstrap-admin`

Guarded by the `BOOTSTRAP_SECRET` env secret. Refuses (`403`) if the supplied
secret doesn't match, and refuses (`409`) if an admin already exists. This is the
chicken-and-egg solution for creating the very first account. After that, admins
create users via `POST /users`.

### `login`

Looks up the user by email, verifies the password, creates a session, sets the
cookie, and returns the public user (`id`, `email`, `displayName`, `role`). Invalid
credentials → `401 {"error":"invalid credentials"}`. The same error is returned for
both "no such user" and "wrong password" (no user enumeration).

### `logout`

Revokes the session row (if a cookie is present) and deletes the cookie.

### `me`

Behind `requireAuth`; echoes back the current user. The web app uses this to
determine whether someone is logged in.

## Roles & authorization summary

| Capability                                        | user | admin |
| ------------------------------------------------- | :--: | :---: |
| Log in / out, view `me`                           |  ✅  |  ✅   |
| Manage own workouts (CRUD, copy)                  |  ✅  |  ✅   |
| Read own progress                                 |  ✅  |  ✅   |
| List active exercises                             |  ✅  |  ✅   |
| List inactive exercises (`?includeInactive=true`) |  ❌  |  ✅   |
| Create / edit / deactivate exercises              |  ❌  |  ✅   |
| Create users                                      |  ❌  |  ✅   |

All workout/progress queries are **scoped to `c.get("user").id`** in the service
layer, so users can only ever read or mutate their own data — there is no
cross-user access even by guessing IDs (a mismatched owner yields `404`).

## Frontend side

The web client never sees the token (it's `httpOnly`). It relies on:

- `credentials: "include"` on every `fetch` (see `apps/web/src/api/client.ts`).
- `useMe()` (TanStack Query) calling `GET /auth/me`; a `401` is treated as "logged
  out" (returns `null`) rather than an error.
- The `Protected` route component redirecting to `/login` when `me` is null.

See [Routing & State](../web/routing-and-state.md).
