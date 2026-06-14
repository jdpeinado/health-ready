# Design System — "Forge" theme

The visual identity is defined in `apps/web/src/index.css` and realized through
Tailwind CSS v4 + vendored shadcn/ui (Radix) components. The theme is called
**"Forge"**: a warm graphite-iron dark canvas with a molten-amber accent and
bone-white ink. The guiding idea is _"numbers are the hero"_ — it reads like a
strength-training instrument.

## Tailwind v4 setup

- Tailwind is wired via `@tailwindcss/vite` (no `tailwind.config.js`; configuration
  is in CSS). `index.css` starts with `@import "tailwindcss";`.
- A dark variant is declared: `@custom-variant dark (&:is(.dark *))`. The theme
  tokens are defined on both `:root` and `.dark` — the app is **dark by default**.

## Color tokens

Colors are authored in **OKLCH** as CSS custom properties, then exposed to Tailwind
through an `@theme inline` block (so utilities like `bg-card`, `text-primary`,
`border-border` resolve to these variables).

Key roles:

| Token                                                       | Role                                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------------- |
| `--background` / `--foreground`                             | warm near-black canvas / bone-white ink                          |
| `--card`, `--popover`, `--secondary`, `--muted`, `--accent` | layered surfaces, warmer as they rise                            |
| `--primary`                                                 | **molten amber** — the signature accent (`oklch(0.77 0.158 62)`) |
| `--destructive`                                             | crimson (cooler hue than amber, so it reads as different)        |
| `--border` / `--input` / `--ring`                           | subtle white-alpha lines; amber focus ring                       |
| `--chart-1..5`                                              | amber lead + teal/other counterpoints for charts                 |
| `--sidebar*`                                                | the desktop rail's own surface/border/accent set                 |

The progress chart uses the amber `#f0923c` directly (`AMBER` constant in
`ProgressPage.tsx`).

## Typography

Three font families are mapped in `@theme`:

| Token            | Family         | Usage                                   |
| ---------------- | -------------- | --------------------------------------- |
| `--font-sans`    | Hanken Grotesk | body text (default)                     |
| `--font-display` | Archivo        | headings, brand, athletic display       |
| `--font-mono`    | JetBrains Mono | numbers/data, eyebrows, tabular figures |

Numeric data uses `font-mono` with `font-variant-numeric: tabular-nums` so columns of
numbers line up. `body` enables `ss01`/`cv01` font features.

## Component classes

Defined under `@layer components` in `index.css`:

- `.eyebrow` — small uppercase amber label above headings.
- `.page-title` — wide athletic display heading (responsive size).
- `.panel` — frosted elevated surface (`rounded-2xl border bg-card/70 backdrop-blur`).

## Atmosphere & motion

- The `body` has two fixed radial-gradient "glows" (amber + iron) behind content for
  depth (`background-attachment: fixed`).
- `.animate-rise` provides a staggered fade/slide-in entrance for page content, gated
  behind `@media (prefers-reduced-motion: no-preference)`.
- Small UX touches: transparent tap highlight on mobile; a CSS filter recolors the
  native date-picker indicator so it's legible on dark inputs.

## shadcn/ui components (`components/ui/*`)

The primitives (`button`, `input`, `label`, `card`, `select`, `textarea`) are
**vendored Radix-based** shadcn/ui components, copied into the repo and styled with
the theme tokens above.

> **Important (from `CLAUDE.md`):** do **not** regenerate these from the live shadcn
> registry. The current registry serves Base UI ("Nova") components with a different
> API. Edit the local files directly or copy canonical Radix sources. Icons come from
> `lucide-react`.

## Responsive shell

The shell (`Layout.tsx`) adapts:

- **≥ md**: fixed 256px (`w-64`) left sidebar; content offset with `md:pl-64`.
- **< md**: sticky top bar + fixed bottom tab nav; content has bottom padding so the
  tab bar doesn't overlap.
- Safe-area insets (`env(safe-area-inset-*)`) are respected for iOS notches/home
  indicators — fitting for an installed PWA.
