# Web App Overview

The web app (`apps/web`) is a **Vite + React 18 + TypeScript** PWA. It talks to the
API over `fetch` (with cookies), manages server state with TanStack Query, routes
with React Router, and is styled with Tailwind CSS v4 + vendored shadcn/ui (Radix)
components.

## Structure

```
apps/web/src/
├── main.tsx                  app bootstrap (providers + router)
├── index.css                 Tailwind import + the "Forge" theme tokens
├── app/
│   ├── router.tsx            route table
│   ├── Protected.tsx         auth gate (redirects to /login)
│   └── Layout.tsx            app shell (sidebar / mobile nav)
├── auth/
│   ├── useAuth.ts            useMe / useLogin / useLogout
│   └── LoginPage.tsx         /login
├── api/
│   ├── client.ts             fetch wrapper + ApiError
│   └── types.ts              client-side response types
├── features/
│   ├── workouts/             new workout, entry editor, set helpers, mutations
│   ├── history/              history list + workout detail + queries
│   ├── progress/             progress chart page + query
│   └── exercises/            exercise admin + queries
├── components/ui/            vendored shadcn/ui primitives (Radix-based)
└── lib/utils.ts              cn() class-name helper
```

The codebase is organized **by feature**: each feature folder owns its page
component(s) and its TanStack Query hooks.

## Bootstrap (`main.tsx`)

```tsx
const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
```

Two providers wrap the app: TanStack Query's `QueryClientProvider` and React
Router's `RouterProvider`. There is no global state library — server state lives in
Query, and local UI state lives in component `useState`.

## API base URL

The fetch wrapper reads `import.meta.env.VITE_API_URL`:

- **dev:** `http://localhost:8787/api` (`.env.development`)
- **prod:** `/api` (`.env.production`, same origin)

So all client calls use root-relative API paths like `/auth/me`, `/workouts`, which
become `…/api/auth/me` etc. See [API client](./routing-and-state.md#the-api-client).

## PWA

Configured by `vite-plugin-pwa` in `vite.config.ts`:

- `registerType: "autoUpdate"` — the service worker updates in the background.
- Manifest: name "Health Ready", `short_name` "HealthReady", `display: standalone`,
  `start_url: /`, theme/background `#0f172a`, and 192/512 icons from `public/`.

This is what makes the app installable to a phone home screen.

## Aliases & TypeScript

- `@/*` → `apps/web/src/*` (Vite alias + tsconfig path). UI imports use
  `@/components/ui/...`, `@/lib/utils`.
- `noUncheckedIndexedAccess` is on (inherited from `tsconfig.base.json`), so indexed
  access is `T | undefined` and must be guarded.

## Where to go next

- [Routing & State](./routing-and-state.md) — router, the `Protected` gate, Query
  patterns, the fetch client.
- [Features / Pages](./features.md) — a tour of each screen.
- [Design System](./design-system.md) — theme, tokens, components.
