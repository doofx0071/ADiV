<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

# AdiV — ADV160 Motorcycle Maintenance Tracker

Personal, single-bike (Honda ADV160 RoadSync) maintenance tracker: no auth, mobile-responsive web app. Next.js App Router frontend, Convex backend. Currency PHP, units km/liters. Full product spec: `.sisyphus/plans/adiv-maintenance-tracker.md`.

## Commands

Package manager is **bun** (bun.lock). Run via `bun run <script>`:

- `dev` — Next dev server (localhost:3000)
- `build` / `start` / `lint` (eslint)
- `test` — Vitest run; `test:watch` for watch mode
- `test:e2e` — Playwright (config exists, but the `e2e/` test dir does not yet)
- Typecheck: no script — use `bunx tsc --noEmit`
- Convex backend sync: `npx convex dev`

## Layout

- `app/` — App Router pages: dashboard, analytics, history, achievements, gallery, export, setup, `maintenance/[id]`. `ClientProviders` wraps the app (Convex + theme).
- `convex/` — `schema.ts` plus one module per domain (bike, rides, fuel, expenses, maintenance, achievements, files, seed). `convex/_generated/` is auto-generated — never edit.
- `components/` — `ui/` (shadcn), `layout/`, `dashboard/`, `charts/` (Tremor), `setup/`.
- `lib/` — theme system, reminders engine, achievements logic, utils.
- `__tests__/` — Vitest unit tests (jsdom); only `__tests__/**` is matched by the config.

## Rules & conventions

- Single-bike schema: no per-bike foreign keys. All timestamps are ms since epoch (`Date.now()`).
- Path alias `@/*` maps to the project root.
- Tailwind CSS v4 with CSS-first config: theme tokens live as CSS variables in `app/globals.css` (mapped via `@theme inline`); there is no `tailwind.config` file. Dark mode is the `.dark` class custom variant. `lib/theme.ts` mirrors the tokens.
- shadcn/ui style `radix-lyra`. Icon usage is mixed: `components.json` declares remixicon, but app code predominantly uses `lucide-react` — prefer lucide for new UI.
- Forms: react-hook-form + zod. Toasts: sonner. Charts: `@tremor/react`. Client state: zustand. Dates: date-fns.

## UI gotchas (enforced by recent commits)

- Logging is done through modal forms (`components/dashboard/log-modals.tsx`) — standalone log pages were removed; don't recreate them.
- Never add `min-h-screen` to pages — it forces a scrollbar; the root layout already handles height (`min-h-full flex flex-col`).
- Navigation: top header with centered links on desktop (`md:`), fixed bottom tab bar on mobile with safe-area padding; page content must keep its bottom offset (`#main-content` in `ClientProviders`). Tab radius must match the theme (`--radius` tokens).
- Overlays animate via tw-animate-css data-state classes; dialog/select durations are tuned to the 150–250ms budget. A global `prefers-reduced-motion` guard lives at the end of `globals.css` — keep it intact.

## Environment gotchas

- Workspace path contains spaces (`code ni cris`) — always quote paths in shell commands.
- Windows + Git Bash environment; `next.config.ts` pins `turbopack.root` to the project directory.
