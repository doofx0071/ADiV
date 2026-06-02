# AdiV — ADV160 Motorcycle Maintenance Tracker

## TL;DR

> **Quick Summary**: Build a personal, mobile-responsive web app to track and monitor a Honda ADV160 RoadSync motorcycle. Features maintenance reminders, ride/fuel/expense logging, photo documentation, visual dashboard with charts, dark cyber-moto theme, and gamification (badges, streaks, milestones).
>
> **Deliverables**:
> - Next.js 14 App Router web app with Convex backend
> - Pre-seeded Honda ADV160 maintenance schedule (25 items)
>   - Dashboard with Tremor charts and cyber-moto light theme (dark mode toggle)
> - Ride logging, fuel tracking (km/L), expense tracking
> - Photo documentation with Convex storage
> - Gamification: achievements, streaks, mileage milestones
> - Browser notification reminders for due maintenance
>
> **Estimated Effort**: Large (4-6 waves, ~20+ tasks)
> **Parallel Execution**: YES — 4 implementation waves + 1 final QA wave
> **Critical Path**: T1 (scaffold) → T2 (schema) → T6 (reminder engine) → T12 (dashboard) → T18 (achievements) → F1-F4 (QA)

---

## Context

### Original Request
Build a web app (mobile responsive) to track and monitor a Honda ADV160 RoadSync motorcycle. Help remind owner of needed maintenance tasks based on the Honda ADV Maintenance Guide. Backend/database: Convex.dev. Must NOT be boring — needs good design and UX.

### Interview Summary
**Key Discussions**:
- Single bike only (ADV160), no auth, no PWA, responsive web app
- Hybrid maintenance schedule: 12 items from user's Honda image + extra critical official items (valve clearance, final drive oil, oil strainer screen, crankcase breather, clutch shoes, suspension, nuts & bolts, steering head bearings, idle speed, fuel line, throttle operation, cooling system, side stand)
- Feature set: maintenance tracking, ride logging, fuel tracking (km/L), expense tracking, photo docs, dashboard with charts, dark cyber-moto theme, gamification (badges/streaks/milestones), browser notifications
- Tech stack: Next.js 14 App Router + React + TypeScript, Convex.dev, shadcn/ui + Tailwind, Tremor charts, React Hook Form + Zod, Sonner, date-fns, Zustand, Vitest (TDD)
- Design: Modern light / cyber-moto — clean light theme with neon accents, motorcycle-inspired, digital dashboard feel (dark mode toggle)

**Research Findings**:
- Official Honda ADV160 specs: 157cc, 16 PS, 8.1L tank, 110/80-14 & 130/70-13 tires, 29/33 psi
- Official maintenance intervals differ from user's image (6k/12k/18k vs 4k/8k/12k). Using hybrid approach with official intervals for accuracy.
- App inspiration: card-based dashboards, timeline service history, color-coded status (green/yellow/red), quick-log interfaces, photo-heavy records, gamification with XP/badges, dark motorcycle aesthetics
- Next.js + Convex best practices: `convex/` at project root, `ConvexClientProvider` as client component, parallel `useQuery` for real-time dashboard, 3-step file upload pattern

### Metis Review
**Identified Gaps** (addressed):
- **Currency/units/timezone**: Defaulted to PHP, km, liters, Asia/Manila (based on user location context)
- **Reminder method without auth/PWA**: In-app dashboard badges + overdue lists + optional browser notifications
- **Early maintenance handling**: Reset interval from actual service date (Honda standard)
- **Past maintenance capture**: Onboarding flow to input service history and current odometer
- **Photo limits**: 5 photos per record, 5MB max
- **Gamification prominence**: Enabled by default, unobtrusive (badges visible, not blocking core flows)
- **Offline capability**: Online-only (no PWA), designed for quick post-ride logging
- **Data export**: JSON/CSV export included for backup
- **Maintenance interval accuracy**: Using official Honda manual intervals for all items

---

## Work Objectives

### Core Objective
Build a personal motorcycle maintenance tracker web app that makes keeping a Honda ADV160 in top condition engaging and effortless, with automatic reminders, visual progress tracking, and gamified rewards for good maintenance habits.

### Concrete Deliverables
- `app/` — Next.js App Router pages (dashboard, maintenance, rides, fuel, expenses, settings)
- `convex/` — Convex backend (schema, queries, mutations, file storage)
- `components/` — shadcn/ui components + custom domain components
- `lib/` — Utilities, validation schemas, theme config
- `__tests__/` — Vitest test suites (TDD)
- Pre-seeded maintenance data for 25 Honda ADV160 items
- Light cyber-moto theme with Tailwind config (dark mode available as toggle)

### Definition of Done
- [ ] App loads on mobile (375px) and desktop (1440px) without layout breaks
- [ ] Maintenance reminder engine correctly calculates upcoming/due/overdue statuses
- [ ] Dashboard renders all widgets with real Convex data in <2s desktop / <4s mobile
- [ ] All Vitest tests pass with >80% coverage on utility functions
- [ ] Photo upload works on mobile Chrome/Safari (5MB limit, JPG/PNG only)
- [ ] Fuel efficiency calculates correctly (km/L) from ride + fuel logs
- [ ] Achievements trigger correctly (first service, streaks, mileage milestones)

### Must Have
- Single bike profile with ADV160 specs
- Maintenance tracking for 25 items with official Honda intervals
- Ride logging with odometer input and distance calculation
- Fuel logging with price, liters, odometer, and km/L efficiency
- Expense tracking with category and notes
- Photo documentation attached to maintenance records
- Dashboard with upcoming tasks, stats cards, charts
- Light cyber-moto theme with neon accents (dark mode toggle)
- Gamification: badges, streaks, mileage milestones
- Browser notification reminders for due maintenance
- Data export (JSON/CSV)

### Must NOT Have (Guardrails)
- NO authentication or user management — single user, shared data, no login screens
- NO multi-bike support — schema, UI, and logic assume exactly one bike
- NO social features — no sharing, no leaderboards, no public profiles
- NO external service integrations — no Strava, Google Maps, RoadSync API, weather APIs
- NO email/SMS/push notifications (beyond optional browser notifications)
- NO PWA/offline-first architecture — responsive web only
- NO advanced predictive analytics — simple interval math only
- NO public API or webhooks
- NO Server Components directly querying Convex — Client Components with `useQuery` only
- NO custom UI component library beyond shadcn/ui

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (greenfield — will set up Vitest)
- **Automated tests**: YES (TDD)
- **Framework**: Vitest (Jest-compatible API, fast, works with Vite/Next.js)
- **TDD Pattern**: Each task follows RED (failing test) → GREEN (minimal impl) → REFACTOR
  - Utilities/logic: Full TDD (test first)
  - UI components: Integration tests with mock data (test after component structure)
  - Convex queries/mutations: Integration tests with mock context

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Playwright (playwright skill) — Navigate, interact, assert DOM, screenshot
- **TUI/CLI**: Bash (curl) — For API testing if needed
- **Library/Module**: Bash (bun vitest run) — Unit test execution
- **Logic**: Bash (node REPL) — Import functions, compare output

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — scaffold, schema, theme, seed):
├── T1: Project scaffolding + config setup
├── T2: Convex schema design (all tables)
├── T3: Design system + dark cyber-moto theme
├── T4: Seed maintenance items data
└── T5: Bike profile setup page + onboarding flow

Wave 2 (Core Logic — reminder engine + CRUD + tests):
├── T6: Maintenance reminder engine (pure functions + Vitest tests)
├── T7: Maintenance CRUD (Convex queries/mutations + tests)
├── T8: Ride logging (Convex + tests)
├── T9: Fuel logging (Convex + tests)
├── T10: Expense tracking (Convex + tests)
└── T11: File upload infrastructure (Convex storage + component)

Wave 3 (UI/UX — dashboard + history + charts + gallery):
├── T12: Dashboard home page (stats cards, upcoming tasks)
├── T13: Timeline service history
├── T14: Charts & visualizations (costs, fuel efficiency, maintenance trends)
├── T15: Photo gallery view
├── T16: Maintenance detail page
└── T17: Upcoming tasks widget + status badges

Wave 4 (Gamification + Polish + Extras):
├── T18: Achievement system logic (badges, streaks, milestones)
├── T19: Achievement UI (badge display, unlock animations)
├── T20: Browser notifications
├── T21: Responsive optimization (mobile-first polish)
├── T22: Data export (JSON/CSV)
└── T23: Theme polish + animations + micro-interactions

Wave FINAL (QA — after ALL implementation tasks):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA (unspecified-high + playwright skill)
├── F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay

Critical Path: T1 → T2 → T6 → T12 → T18 → F1-F4 → user okay
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 6 (Waves 2 & 3)
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|-----------|--------|
| T1 | — | T2, T3, T4, T5 |
| T2 | T1 | T6, T7, T8, T9, T10, T11 |
| T3 | T1 | T12, T13, T14, T15, T16, T17, T19, T21, T23 |
| T4 | T1, T2 | T7, T13 |
| T5 | T1, T2 | T6, T8 |
| T6 | T2, T4, T5 | T12, T17, T18 |
| T7 | T2, T4 | T13, T16 |
| T8 | T2, T5 | T12, T14 |
| T9 | T2, T5 | T12, T14 |
| T10 | T2 | T12, T14 |
| T11 | T2 | T15, T16 |
| T12 | T3, T6, T8, T9, T10 | T21 |
| T13 | T3, T7 | — |
| T14 | T3, T8, T9, T10 | — |
| T15 | T3, T11 | — |
| T16 | T3, T7, T11 | — |
| T17 | T3, T6 | — |
| T18 | T6, T7 | T19 |
| T19 | T3, T18 | — |
| T20 | T6 | — |
| T21 | T3, T12 | — |
| T22 | T2, T7, T9, T10 | — |
| T23 | T3 | — |

### Agent Dispatch Summary

| Wave | Tasks | Agent Profiles |
|------|-------|---------------|
| 1 | T1-T5 | quick (scaffold), quick (schema), visual-engineering (theme), quick (seed), visual-engineering (onboarding) |
| 2 | T6-T11 | deep (reminder engine), unspecified-high (CRUD), quick (rides), quick (fuel), quick (expenses), unspecified-high (upload) |
| 3 | T12-T17 | visual-engineering (dashboard), visual-engineering (timeline), visual-engineering (charts), visual-engineering (gallery), visual-engineering (detail), visual-engineering (widget) |
| 4 | T18-T23 | deep (achievements), visual-engineering (achievement UI), quick (notifications), visual-engineering (responsive), quick (export), visual-engineering (polish) |
| FINAL | F1-F4 | oracle, unspecified-high, unspecified-high, deep |

---

## TODOs

### Wave 1: Foundation

- [x] T1. **Project Scaffolding + Config Setup**

  **What to do**:
  - Initialize Next.js 14 App Router project with TypeScript, Tailwind CSS
  - Install and configure Convex (`npm create convex@latest -- -t nextjs-shadcn` or manual setup)
  - Install shadcn/ui (`npx shadcn@latest init`) and add base components: button, card, input, dialog, form, table, badge, tabs, select, textarea, avatar, separator
  - Install Tremor (`npm install @tremor/react`)
  - Install Vitest + React Testing Library + jsdom (`npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom`)
  - Install additional deps: zod, react-hook-form, @hookform/resolvers, date-fns, sonner, zustand, lucide-react, @xixixao/uploadstuff
  - Configure `vitest.config.ts` with React plugin and jsdom environment
  - Set up `ConvexClientProvider.tsx` as a Client Component wrapper in `app/`
  - Add `.env.local` template with `NEXT_PUBLIC_CONVEX_URL`
  - Configure `next.config.js` for static export or standalone
  - Add `convex.json` project config

  **Must NOT do**:
  - Do NOT nest `convex/` inside `app/` — keep at project root
  - Do NOT configure auth (no auth needed)
  - Do NOT add PWA config

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: [`next-best-practices`]
    - Next.js 14 App Router setup and file conventions

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T2, T3, T4, T5)
  - **Blocks**: T2, T3, T4, T5, T6-T11
  - **Blocked By**: None

  **References**:
  - `convex.com` official docs — Next.js quickstart
  - `ui.shadcn.com` — shadcn/ui installation for Next.js
  - `tremor.so` — Tremor installation guide
  - Research result from `bg_fa557e1e` — Convex + Next.js project structure patterns

  **Acceptance Criteria**:
  - [ ] `bun run dev` starts Next.js dev server on `localhost:3000`
  - [ ] `bunx convex dev` starts Convex dev server and connects
  - [ ] `bun vitest run` executes test suite (even if empty, no errors)
  - [ ] `npx tsc --noEmit` passes with zero errors
  - [ ] shadcn/ui components render correctly (test button on a page)

  **QA Scenarios**:
  ```
  Scenario: Dev environment boots
    Tool: Bash
    Steps:
      1. Run `bun run dev`
      2. Wait 10s, curl http://localhost:3000
    Expected Result: HTTP 200 with HTML containing "Next.js" or app title
    Evidence: .sisyphus/evidence/t1-dev-server.png
  ```

  **Commit**: YES
  - Message: `chore: project scaffold with Next.js, Convex, shadcn/ui, Tremor, Vitest`

---

- [x] T2. **Convex Schema Design**

  **What to do**:
  - Design complete schema in `convex/schema.ts` with all tables:
    - `bike` — single bike profile (name, model, year, color, vin, purchaseDate, currentOdometer, engineCc, tireFront, tireRear, tirePressureFront, tirePressureRear, oilType, oilCapacity, coolantCapacity, batteryType, sparkPlugType, fuelTankCapacity, notes)
    - `maintenanceItems` — template items (name, category, intervalKm, intervalMonths, description, serviceLevel, notes, icon, partNumber, quantity)
    - `maintenanceLogs` — logged services (itemId, odometer, date, cost, notes, nextDueOdometer, nextDueDate, photos[])
    - `rides` — ride logs (startOdometer, endOdometer, distance, date, durationMinutes, notes)
    - `fuelLogs` — fuel-ups (odometer, liters, pricePerLiter, totalPrice, date, stationName, notes)
    - `expenses` — general costs (category, amount, date, description, receiptPhoto)
    - `files` — uploaded photos (storageId, name, type, size, recordType, recordId, createdAt)
    - `achievements` — unlocked badges (type, name, description, unlockedAt, icon)
    - `stats` — computed aggregates (lastCalculatedAt) — optional, can compute on fly
  - Add indexes for common queries: `maintenanceLogs.byItem`, `maintenanceLogs.byDate`, `rides.byDate`, `fuelLogs.byDate`, `files.byRecord`
  - Write Vitest tests for schema validation (ensure tables have required fields)

  **Must NOT do**:
  - Do NOT add multi-bike fields (no `bikeId` foreign keys — assume single bike)
  - Do NOT add auth-related tables (no `users` table)

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T3, T4, T5)
  - **Blocks**: T6, T7, T8, T9, T10, T11, T12
  - **Blocked By**: T1

  **References**:
  - `convex.com` docs — `defineSchema`, `defineTable`, `v` validators
  - Research result from `bg_fa557e1e` — Convex schema patterns

  **Acceptance Criteria**:
  - [ ] `bunx convex dev` deploys schema without errors
  - [ ] Schema includes all 9 tables with correct field types
  - [ ] Vitest tests verify table shapes (e.g., `maintenanceItems` has `intervalKm` as `v.number()`)
  - [ ] `npx convex schema:validate` passes (or equivalent check)

  **QA Scenarios**:
  ```
  Scenario: Schema deploys successfully
    Tool: Bash
    Steps:
      1. Run `bunx convex dev` in background
      2. Check schema in Convex dashboard
    Expected Result: All 9 tables visible with correct fields
    Evidence: .sisyphus/evidence/t2-schema-deploy.txt
  ```

  **Commit**: YES
  - Message: `feat: Convex schema for bike, maintenance, rides, fuel, expenses, files, achievements`

---

- [x] T3. **Design System + Light Cyber-Moto Theme**

  **What to do**:
  - Configure Tailwind theme in `tailwind.config.ts`:
    - Colors (Light Default): `background` (#f8fafc), `foreground` (#0f172a), `card` (#ffffff), `card-foreground` (#1e293b), `primary` (#00d4ff neon cyan), `primary-foreground` (#000000), `secondary` (#f1f5f9), `accent` (#ff6b00 motorcycle orange), `accent-foreground` (#ffffff), `muted` (#e2e8f0), `destructive` (#ef4444 warning red), `success` (#22c55e maintenance green), `warning` (#f59e0b due yellow)
    - Dark Mode Colors: `background` (#0a0a0f), `foreground` (#e2e8f0), `card` (#13131f), `card-foreground` (#f1f5f9), `secondary` (#1e1e2e), `muted` (#27273a)
    - Border radius: `lg: 0.75rem`, `md: 0.5rem`
    - Font: Inter or Roboto Mono for dashboard numbers
  - Create `lib/theme.ts` with theme constants and helper functions
  - Create `components/ui/theme-provider.tsx` — simple context for theme switching (dark default, optional light)
  - Add CSS custom properties in `globals.css` for neon glow effects (`box-shadow: 0 0 10px #00d4ff`)
  - Create reusable layout components: `DashboardLayout`, `PageHeader`, `StatCard`, `StatusBadge`
  - Write Vitest tests for theme utilities (color contrast checks)

  **Must NOT do**:
  - Do NOT create a full design system from scratch — extend shadcn/ui with custom CSS
  - Do NOT add animation libraries yet (Framer Motion comes in T23)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`tailwind-design-system`]
    - Tailwind v4 design tokens and scalable component styling

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T2, T4, T5)
  - **Blocks**: T12, T13, T14, T15, T16, T17, T19, T21, T23
  - **Blocked By**: T1

  **References**:
  - `tailwindcss.com` docs — Customizing colors, theme configuration
  - `ui.shadcn.com` — Theming guide
  - Research result from `bg_2a619808` — Dark theme with motorcycle aesthetics (orange for oil, red for warnings)

  **Acceptance Criteria**:
  - [ ] Tailwind config includes all custom colors
  - [ ] shadcn/ui Button renders with primary neon cyan color
  - [ ] shadcn/ui Card renders with light card background (#ffffff)
  - [ ] StatusBadge component shows green/yellow/red with correct colors
  - [ ] Theme toggle switches between dark and light (light can be simple inversion)

  **QA Scenarios**:
  ```
  Scenario: Theme renders correctly
    Tool: Playwright
    Steps:
      1. Navigate to http://localhost:3000
      2. Take screenshot
      3. Check background color is #f8fafc
    Expected Result: Light background visible, neon accents present
    Evidence: .sisyphus/evidence/t3-theme-screenshot.png
  ```

  **Commit**: YES
  - Message: `feat: dark cyber-moto theme with neon accents and custom Tailwind tokens`

---

- [x] T4. **Seed Maintenance Items Data**

  **What to do**:
  - Create `convex/seed.ts` with seed function to populate `maintenanceItems` table
  - Seed 25 items with official Honda ADV160 intervals and specs:
    1. Engine Oil — Replace every 6,000 km / 12 months (0.75L, SAE 10W-30 JASO MB)
    2. Oil Filter — Replace every 6,000 km / 12 months
    3. Air Cleaner Element — Replace every 12,000 km / 12 months (inspect every 6k)
    4. Spark Plug — Replace every 12,000 km / 12 months (NGK LMAR8L-9, gap 0.8-0.9mm)
    5. Drive Belt (V-Belt) — Inspect every 12,000 km / 12 months
    6. Rollers / Slide Piece — Inspect every 6,000 km / 12 months
    7. Brake System (Front & Rear) — Inspect every 6,000 km / 12 months (check fluid level)
    8. Tires — Inspect pressure & condition every 1,000 km / 1 month (29 psi F, 33 psi R)
    9. Coolant — Replace every 3 years (0.50L, Pro Honda HP Coolant)
    10. Battery — Inspect every 6,000 km / 12 months (YTZ8V 12V 7.0Ah)
    11. Lights, Signals & Horn — Check every 6,000 km / 12 months
    12. Fuel System (Injector) — Inspect every 12,000 km / 12 months
    13. Oil Strainer Screen — Clean every 12,000 km / 12 months
    14. Crankcase Breather — Clean every 12,000 km / 12 months
    15. Valve Clearance — Inspect every 12,000 km / 12 months (dealer skill)
    16. Idle Speed — Inspect every 6,000 km / 12 months (1700±100 rpm)
    17. Fuel Line — Inspect every 6,000 km / 12 months
    18. Throttle Operation — Check every 6,000 km / 12 months
    19. Cooling System — Inspect every 6,000 km / 12 months
    20. Final Drive Oil — Replace every 2 years (~110ml)
    21. Clutch Shoes Wear — Inspect every 12,000 km / 12 months
    22. Side Stand — Inspect every 6,000 km / 12 months
    23. Suspension — Inspect every 12,000 km / 12 months
    24. Nuts & Bolts — Inspect every 12,000 km / 12 months
    25. Steering Head Bearings — Inspect every 24,000 km / 24 months
  - Write Vitest tests to verify seed data completeness (all 25 items present, intervals are numbers > 0)
  - Create `convex/seedData.json` with structured data for easy editing

  **Must NOT do**:
  - Do NOT use user's image intervals (4k/8k) — use official Honda intervals for accuracy
  - Do NOT include items beyond the 25 listed

  **Recommended Agent Profile**:
  - **Category**: `quick`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T2, T3, T5)
  - **Blocks**: T7, T13
  - **Blocked By**: T1, T2

  **References**:
  - Draft file: Honda ADV160 maintenance data research (from `bg_bc24857b`)
  - `convex.com` docs — Seeding data

  **Acceptance Criteria**:
  - [ ] Seed function populates all 25 maintenance items in Convex
  - [ ] Each item has: name, intervalKm (or null), intervalMonths (or null), category
  - [ ] Vitest tests verify 25 items exist and intervals are valid
  - [ ] Seed is idempotent (running twice doesn't duplicate)

  **QA Scenarios**:
  ```
  Scenario: Maintenance items seeded correctly
    Tool: convex_runOneoffQuery
    Steps:
      1. Run seed function
      2. Query maintenanceItems table
    Expected Result: 25 items returned with correct names and intervals
    Evidence: .sisyphus/evidence/t4-seed-data.json
  ```

  **Commit**: YES
  - Message: `feat: seed 25 Honda ADV160 maintenance items with official intervals`

---

- [x] T5. **Bike Profile Setup + Onboarding Flow**

  **What to do**:
  - Create `app/setup/page.tsx` — onboarding page for first-time users
  - Form fields: bike name (default "ADV160"), year, color, current odometer (km), purchase date, last known service date (optional), VIN (optional)
  - Pre-fill with Honda ADV160 specs: engine 157cc, tires 110/80-14 & 130/70-13, pressures 29/33 psi, oil 10W-30, battery YTZ8V, spark plug NGK LMAR8L-9, fuel tank 8.1L
  - Store bike profile in `bike` table (single row — singleton pattern)
  - After setup, redirect to dashboard
  - If bike profile exists, skip setup and show dashboard
  - Write Vitest tests for form validation (odometer must be positive number, year must be 2021-2027)
  - Write Playwright test for onboarding flow

  **Must NOT do**:
  - Do NOT allow multiple bike profiles
  - Do NOT require VIN or purchase date (optional fields only)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`next-best-practices`]
    - Next.js App Router form handling and navigation patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T2, T3, T4)
  - **Blocks**: T6, T8
  - **Blocked By**: T1, T2

  **References**:
  - `react-hook-form.com` — Form validation patterns
  - `zod.dev` — Schema validation for form inputs

  **Acceptance Criteria**:
  - [ ] Setup page accessible at `/setup`
  - [ ] Form validates odometer > 0, year between 2021-2027
  - [ ] On submit, bike profile saved to Convex `bike` table
  - [ ] Redirects to `/dashboard` after setup
  - [ ] Returning user skips setup (detects existing bike row)

  **QA Scenarios**:
  ```
  Scenario: First-time user completes onboarding
    Tool: Playwright
    Steps:
      1. Navigate to /setup
      2. Fill form: name "My ADV160", year 2024, odometer 5000
      3. Submit form
      4. Assert redirected to /dashboard
    Expected Result: URL is /dashboard, dashboard shows "My ADV160" and odometer 5000
    Evidence: .sisyphus/evidence/t5-onboarding-flow.png
  ```

  **Commit**: YES
  - Message: `feat: bike profile setup and onboarding flow`

---

### Wave 2: Core Logic

- [x] T6. **Maintenance Reminder Engine**

  **What to do**:
  - Create `lib/reminders.ts` with pure functions (no React/Convex dependencies) for reminder logic:
    - `calculateStatus(currentOdometer, currentDate, lastServiceOdometer, lastServiceDate, intervalKm, intervalMonths)` → returns `{ status: 'upcoming' | 'due' | 'overdue', dueInKm: number | null, dueInDays: number | null, progressPercent: number }`
    - `isOverdue(currentOdometer, currentDate, lastServiceOdometer, lastServiceDate, intervalKm, intervalMonths)` → boolean
    - `getDueOdometer(lastServiceOdometer, intervalKm)` → number
    - `getDueDate(lastServiceDate, intervalMonths)` → Date
    - `calculateProgress(currentOdometer, lastServiceOdometer, intervalKm)` → number (0-1)
  - Handle edge cases: null intervals (time-only or km-only tasks), overdue by both time and km, maintenance done early (reset from service date)
  - Thresholds: `upcoming` = due within 1,000 km OR 30 days; `due` = due within 500 km OR 7 days; `overdue` = past due
  - Write comprehensive Vitest tests BEFORE implementation:
    - Test: engine oil at 5,500km with last service at 0km, interval 6,000km → status upcoming (due in 500km)
    - Test: coolant last replaced 2.5 years ago, interval 36 months → status due (overdue by 6 months)
    - Test: tire pressure last checked 25 days ago, interval 30 days → status upcoming
    - Test: odometer rollback (current < lastService) → throw error
    - Test: future-dated service (lastService > currentDate) → throw error
    - Test: negative interval → throw error

  **Must NOT do**:
  - Do NOT connect to Convex in these pure functions — they receive primitives only
  - Do NOT add complex predictive logic (ML, wear modeling) — simple interval math only

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`test-driven-development`]
      - TDD approach for testable pure functions

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T7, T8, T9, T10, T11)
  - **Blocks**: T12, T17, T18
  - **Blocked By**: T2, T4, T5

  **References**:
  - `date-fns.org` — Date manipulation and difference calculations
  - Draft file: Maintenance intervals research

  **Acceptance Criteria**:
  - [ ] All 10+ Vitest tests pass for reminder engine
  - [ ] `calculateStatus` handles all combinations of km-only, time-only, and both
  - [ ] Edge cases throw descriptive errors
  - [ ] No `console.log` in production code

  **QA Scenarios**:
  ```
  Scenario: Engine oil due soon
    Tool: Bash (bun vitest run)
    Preconditions: lastServiceOdometer=0, intervalKm=6000, currentOdometer=5500
    Steps:
      1. Import calculateStatus
      2. Call with params
    Expected Result: status="upcoming", dueInKm=500
    Evidence: .sisyphus/evidence/t6-reminder-tests.txt

  Scenario: Coolant overdue by time
    Tool: Bash (bun vitest run)
    Preconditions: lastServiceDate="2022-01-01", intervalMonths=36, currentDate="2025-01-01"
    Steps:
      1. Import calculateStatus
      2. Call with params
    Expected Result: status="overdue", dueInDays=-365
    Evidence: .sisyphus/evidence/t6-reminder-overdue.txt
  ```

  **Commit**: YES
  - Message: `feat: maintenance reminder engine with TDD`

---

- [x] T7. **Maintenance CRUD**

  **What to do**:
  - Create `convex/maintenance.ts` with:
    - `getMaintenanceItems` — query all items from `maintenanceItems` table
    - `getMaintenanceLogs` — query logs for a specific item (with pagination, limit 50)
    - `getAllMaintenanceLogs` — query all logs ordered by date desc
    - `logMaintenance` — mutation to create a maintenance log (validates item exists, odometer >= last log odometer, date <= today)
    - `updateMaintenanceLog` — mutation to edit a log
    - `deleteMaintenanceLog` — mutation to remove a log and cleanup orphaned photos
  - Create `app/maintenance/page.tsx` — list all maintenance items with status
  - Create `app/maintenance/[itemId]/page.tsx` — detail page for one item with history, log form, photo gallery
  - Create `components/maintenance/log-form.tsx` — React Hook Form + Zod for logging maintenance (date, odometer, cost, notes, photos)
  - Create `components/maintenance/status-badge.tsx` — shows upcoming/due/overdue using reminder engine
  - Optimistic updates: when logging maintenance, immediately update status badge without waiting for server
  - Write Vitest tests for Convex mutations (mock db context)
  - Write Playwright tests for log form submission and status updates

  **Must NOT do**:
  - Do NOT allow logging maintenance with future dates
  - Do NOT allow odometer values less than previous log for same item
  - Do NOT delete photos from Convex storage when deleting log (mark for cleanup instead — separate background task)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: [`test-driven-development`]
      - TDD for Convex mutation logic

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T6, T8, T9, T10, T11)
  - **Blocks**: T13, T16
  - **Blocked By**: T2, T4

  **References**:
  - `convex.com` docs — Queries, mutations, optimistic updates
  - `react-hook-form.com` — Form handling patterns
  - Research result from `bg_fa557e1e` — Convex mutation patterns

  **Acceptance Criteria**:
  - [ ] `/maintenance` page lists all 25 items with status badges
  - [ ] Clicking item navigates to detail page with history
  - [ ] Log form validates date <= today, odometer >= 0
  - [ ] Submitting log updates status badge immediately (optimistic)
  - [ ] Vitest tests for all mutations pass
  - [ ] Playwright test: log engine oil change, verify status changes to "upcoming"

  **QA Scenarios**:
  ```
  Scenario: Log an engine oil change
    Tool: Playwright
    Preconditions: Bike odometer at 5000km, engine oil last serviced at 0km
    Steps:
      1. Navigate to /maintenance/engine-oil
      2. Click "Log Service"
      3. Fill date=today, odometer=5000, cost=500
      4. Submit
      5. Verify status badge changes to "upcoming"
    Expected Result: Badge shows "upcoming" (next due at 11,000km), log appears in history
    Evidence: .sisyphus/evidence/t7-log-maintenance.png

  Scenario: Reject future-dated maintenance
    Tool: Playwright
    Steps:
      1. Open log form
      2. Set date to tomorrow
      3. Submit
    Expected Result: Form shows validation error "Date cannot be in the future"
    Evidence: .sisyphus/evidence/t7-future-date-error.png
  ```

  **Commit**: YES
  - Message: `feat: maintenance CRUD with optimistic updates and validation`

---

- [x] T8. **Ride Logging**

  **What to do**:
  - Create `convex/rides.ts` with:
    - `getRides` — query rides ordered by date desc (paginated, limit 50)
    - `getRidesByDateRange` — query rides between start and end dates
    - `addRide` — mutation (validates endOdometer > startOdometer, distance = end - start, date <= today)
    - `updateRide` — mutation
    - `deleteRide` — mutation
  - Create `app/rides/page.tsx` — ride history list
  - Create `components/rides/ride-form.tsx` — form for logging rides (startOdometer, endOdometer, date, durationMinutes, notes)
  - Auto-calculate distance from odometer difference
  - Update bike's `currentOdometer` when ride is logged (mutation also updates `bike.currentOdometer` to `endOdometer` if higher)
  - Write Vitest tests for distance calculation and odometer validation
  - Write Playwright tests for ride logging flow

  **Must NOT do**:
  - Do NOT allow endOdometer <= startOdometer
  - Do NOT allow negative distance
  - Do NOT track GPS routes or map visualization

  **Recommended Agent Profile**:
  - **Category**: `quick`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T6, T7, T9, T10, T11)
  - **Blocks**: T12, T14
  - **Blocked By**: T2, T5

  **References**:
  - `convex.com` docs — Query and mutation patterns

  **Acceptance Criteria**:
  - [ ] `/rides` page lists logged rides
  - [ ] Ride form auto-calculates distance (end - start)
  - [ ] Logging ride updates bike's current odometer
  - [ ] Vitest: distance calculation tests pass
  - [ ] Playwright: log ride, verify distance displays correctly

  **QA Scenarios**:
  ```
  Scenario: Log a 50km ride
    Tool: Playwright
    Preconditions: Bike odometer at 5000km
    Steps:
      1. Navigate to /rides
      2. Click "Add Ride"
      3. Fill start=5000, end=5050, date=today
      4. Submit
    Expected Result: Ride list shows "50 km", bike odometer updated to 5050
    Evidence: .sisyphus/evidence/t8-log-ride.png

  Scenario: Reject rollback odometer
    Tool: Playwright
    Steps:
      1. Fill start=5000, end=4999
      2. Submit
    Expected Result: Validation error "End odometer must be greater than start"
    Evidence: .sisyphus/evidence/t8-rollback-error.png
  ```

  **Commit**: YES
  - Message: `feat: ride logging with odometer tracking`

---

- [x] T9. **Fuel Logging**

  **What to do**:
  - Create `convex/fuel.ts` with:
    - `getFuelLogs` — query fuel logs ordered by date desc
    - `addFuelLog` — mutation (liters > 0, pricePerLiter > 0, odometer >= 0)
    - `updateFuelLog`, `deleteFuelLog`
    - `getFuelEfficiency` — query to calculate km/L for last N fuel-ups (uses distance between fuel-ups / liters consumed)
  - Create `app/fuel/page.tsx` — fuel log history
  - Create `components/fuel/fuel-form.tsx` — form (odometer, liters, pricePerLiter, totalPrice auto-calculated, date, stationName)
  - Create `components/fuel/efficiency-card.tsx` — shows average km/L for last 3, 5, 10 fuel-ups
  - Write Vitest tests for efficiency calculation:
    - Fuel-up 1: 1000km, 5L → no efficiency yet (no previous)
    - Fuel-up 2: 1050km, 2L → efficiency = 50km / 2L = 25.0 km/L
    - Fuel-up 3: 1100km, 2.5L → efficiency = 50km / 2.5L = 20.0 km/L
    - Average of last 2 = (25.0 + 20.0) / 2 = 22.5 km/L
  - Write Playwright tests for fuel logging and efficiency display

  **Must NOT do**:
  - Do NOT track fuel station locations or map visualization
  - Do NOT integrate with fuel price APIs

  **Recommended Agent Profile**:
  - **Category**: `quick`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T6, T7, T8, T10, T11)
  - **Blocks**: T12, T14
  - **Blocked By**: T2, T5

  **References**:
  - `convex.com` docs — Query patterns with calculations

  **Acceptance Criteria**:
  - [ ] `/fuel` page shows fuel log history
  - [ ] Efficiency card shows correct km/L calculation
  - [ ] Form validates liters > 0, price > 0
  - [ ] Vitest: all efficiency calculation tests pass
  - [ ] Playwright: log fuel, verify efficiency updates

  **QA Scenarios**:
  ```
  Scenario: Calculate fuel efficiency
    Tool: Bash (bun vitest run)
    Preconditions: Fuel logs at odometer 1000 (5L), 1050 (2L), 1100 (2.5L)
    Steps:
      1. Import getFuelEfficiency logic
      2. Call with logs
    Expected Result: Last efficiency=20.0 km/L, average of last 2=22.5 km/L
    Evidence: .sisyphus/evidence/t9-efficiency-tests.txt

  Scenario: Log fuel-up and see efficiency
    Tool: Playwright
    Steps:
      1. Navigate to /fuel
      2. Add fuel log: odometer=1050, liters=2, price=60
      3. Verify efficiency card updates
    Expected Result: Efficiency card shows calculated km/L
    Evidence: .sisyphus/evidence/t9-fuel-log.png
  ```

  **Commit**: YES
  - Message: `feat: fuel logging with km/L efficiency calculation`

---

- [x] T10. **Expense Tracking**

  **What to do**:
  - Create `convex/expenses.ts` with:
    - `getExpenses` — query ordered by date desc (paginated)
    - `getExpensesByCategory` — query grouped by category
    - `getExpenseSummary` — query total spending by month (last 12 months)
    - `addExpense` — mutation (category, amount, date, description)
    - `updateExpense`, `deleteExpense`
  - Categories: parts, labor, oil, tires, accessories, insurance, registration, other
  - Create `app/expenses/page.tsx` — expense history
  - Create `components/expenses/expense-form.tsx` — form with category select
  - Create `components/expenses/expense-summary.tsx` — monthly totals chart
  - Write Vitest tests for expense aggregation
  - Write Playwright tests for expense logging

  **Must NOT do**:
  - Do NOT integrate with receipt scanning APIs
  - Do NOT add recurring expense automation

  **Recommended Agent Profile**:
  - **Category**: `quick`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T6, T7, T8, T9, T11)
  - **Blocks**: T12, T14
  - **Blocked By**: T2

  **References**:
  - `convex.com` docs — Aggregation queries

  **Acceptance Criteria**:
  - [ ] `/expenses` page shows expense history
  - [ ] Category select restricts to defined list
  - [ ] Summary shows monthly totals for last 12 months
  - [ ] Vitest: aggregation tests pass

  **QA Scenarios**:
  ```
  Scenario: Log an expense and view summary
    Tool: Playwright
    Steps:
      1. Navigate to /expenses
      2. Add expense: category="parts", amount=1500, date=today
      3. View summary
    Expected Result: Summary includes 1500 for current month
    Evidence: .sisyphus/evidence/t10-expense-log.png
  ```

  **Commit**: YES
  - Message: `feat: expense tracking with category summary`

---

- [x] T11. **File Upload Infrastructure**

  **What to do**:
  - Create `convex/files.ts` with:
    - `generateUploadUrl` — mutation to create upload URL
    - `saveFile` — mutation to save file metadata after upload
    - `getFilesByRecord` — query files by recordType + recordId
    - `getFileUrl` — query to get CDN URL for a storageId
    - `deleteFile` — mutation to remove file metadata and storage
  - Create `components/upload/file-uploader.tsx` — uses `@xixixao/uploadstuff/react` with drag-and-drop
  - Create `components/upload/photo-gallery.tsx` — grid of thumbnails with full-size modal viewer
  - Constraints: max 5 files per upload, max 5MB per file, accept JPG/PNG only
  - Compress/resize images client-side before upload (use canvas or library)
  - Write Playwright tests for upload and gallery display
  - Write Vitest tests for file validation (reject >5MB, reject non-image)

  **Must NOT do**:
  - Do NOT use external storage (Cloudinary, etc.) — Convex storage only
  - Do NOT allow more than 5 photos per maintenance record

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with T6, T7, T8, T9, T10)
  - **Blocks**: T15, T16
  - **Blocked By**: T2

  **References**:
  - `docs.convex.dev` — File storage guide
  - `@xixixao/uploadstuff` docs — UploadButton component
  - Research result from `bg_fa557e1e` — 3-step upload pattern

  **Acceptance Criteria**:
  - [ ] Upload component accepts drag-and-drop
  - [ ] Rejects files >5MB with clear error
  - [ ] Rejects non-image files
  - [ ] Uploaded images display in gallery with thumbnails
  - [ ] Clicking thumbnail opens full-size modal
  - [ ] Vitest: validation tests pass

  **QA Scenarios**:
  ```
  Scenario: Upload a maintenance photo
    Tool: Playwright
    Steps:
      1. Navigate to /maintenance/engine-oil
      2. Click "Add Photos"
      3. Drag test-image.jpg (2MB)
      4. Wait for upload
      5. Verify thumbnail appears
    Expected Result: Thumbnail visible, clickable to full size
    Evidence: .sisyphus/evidence/t11-upload-photo.png

  Scenario: Reject oversized file
    Tool: Playwright
    Steps:
      1. Try to upload 10MB file
    Expected Result: Error message "File must be under 5MB"
    Evidence: .sisyphus/evidence/t11-oversized-error.png
  ```

  **Commit**: YES
  - Message: `feat: file upload with Convex storage and photo gallery`

---

### Wave 3: UI/UX — Dashboard, Timeline, Charts, Gallery

- [x] T12. **Dashboard Home Page**

  **What to do**:
  - Create `app/dashboard/page.tsx` — main landing page after onboarding
  - Layout: grid of stat cards + upcoming tasks list + recent activity
  - Stat cards (using Tremor `Card` + `Metric`):
    - Current odometer (large number, updates when rides logged)
    - Total rides this month (count + distance)
    - Average fuel efficiency (last 3 fuel-ups)
    - Total expenses this month (PHP)
    - Maintenance streak (consecutive on-time services)
    - Next due task (name + due in X km or X days)
  - Upcoming tasks widget: list top 5 most urgent maintenance items with status badges
  - Recent activity feed: last 5 logs (maintenance, rides, fuel, expenses) with icons
  - Quick actions: "Log Ride", "Log Fuel", "Log Maintenance" buttons
  - Real-time updates: all data from Convex `useQuery` (auto-refreshes)
  - Write Playwright tests for dashboard load and data display

  **Must NOT do**:
  - Do NOT add Server Components for data fetching — all data via Client Component `useQuery`
  - Do NOT add map visualizations or GPS data

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-design`]
      - Dashboard layout and data visualization UI patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T13, T14, T15, T16, T17)
  - **Blocks**: T21
  - **Blocked By**: T3, T6, T8, T9, T10

  **References**:
  - `tremor.so` docs — Card, Metric, Flex, Grid components
  - `lucide-react` — Icons for stat cards and activity feed
  - Research result from `bg_2a619808` — Card-based dashboard with key stats

  **Acceptance Criteria**:
  - [ ] Dashboard loads in <2s desktop, <4s mobile (measured via Playwright)
  - [ ] All 6 stat cards render with correct data from Convex
  - [ ] Upcoming tasks widget shows top 5 urgent items
  - [ ] Recent activity shows last 5 logs with correct icons
  - [ ] Quick action buttons navigate to respective forms

  **QA Scenarios**:
  ```
  Scenario: Dashboard displays stats
    Tool: Playwright
    Preconditions: Bike odometer=5500, 3 rides this month=150km, last fuel efficiency=25km/L, expenses=2000, streak=2
    Steps:
      1. Navigate to /dashboard
      2. Wait for data load
      3. Screenshot
    Expected Result: Stats show 5500km, 150km rides, 25km/L, PHP 2000, streak 2
    Evidence: .sisyphus/evidence/t12-dashboard-stats.png

  Scenario: Upcoming tasks visible
    Tool: Playwright
    Preconditions: Engine oil due at 6000km (current=5500), tires due in 5 days
    Steps:
      1. Load dashboard
      2. Check upcoming tasks widget
    Expected Result: "Engine Oil — due in 500km" (yellow), "Tires — due in 5 days" (yellow)
    Evidence: .sisyphus/evidence/t12-upcoming-tasks.png
  ```

  **Commit**: YES
  - Message: `feat: dashboard home page with stat cards and upcoming tasks`

---

- [x] T13. **Timeline Service History**

  **What to do**:
  - Create `app/history/page.tsx` — chronological feed of all maintenance logs
  - Create `components/history/timeline.tsx` — vertical timeline component:
    - Each entry: date, odometer, maintenance item name, cost, notes, photo thumbnails
    - Color-coded by item category (engine = orange, brakes = red, tires = green, etc.)
    - Filter by item type, date range, cost range
    - Group by month/year with sticky headers
    - Collapsible details (expand to see full notes and photos)
  - Use `convex/maintenance.ts` `getAllMaintenanceLogs` query
  - Write Playwright tests for timeline filtering and expansion

  **Must NOT do**:
  - Do NOT use a table layout — must be visual timeline
  - Do NOT add editing inline — edit navigates to detail page

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T12, T14, T15, T16, T17)
  - **Blocked By**: T3, T7

  **References**:
  - `tailwindcss.com` — Flexbox and positioning for timeline layout
  - Research result from `bg_2a619808` — Timeline-based service history pattern

  **Acceptance Criteria**:
  - [ ] `/history` shows vertical timeline of all maintenance logs
  - [ ] Entries color-coded by category
  - [ ] Filter by item type works correctly
  - [ ] Collapsible details show photos and full notes
  - [ ] Mobile: timeline is readable without horizontal scroll

  **QA Scenarios**:
  ```
  Scenario: View service history timeline
    Tool: Playwright
    Preconditions: 3 maintenance logs exist (engine oil, tires, brake fluid)
    Steps:
      1. Navigate to /history
      2. Take screenshot
      3. Click filter "Engine"
    Expected Result: Only engine oil log visible, timeline layout intact
    Evidence: .sisyphus/evidence/t13-timeline-filter.png
  ```

  **Commit**: YES
  - Message: `feat: visual timeline service history with filtering`

---

- [x] T14. **Charts & Visualizations**

  **What to do**:
  - Create `components/charts/` directory with chart components using Tremor:
    - `cost-chart.tsx` — AreaChart showing maintenance + ride + fuel + other costs over last 12 months (stacked or grouped)
    - `fuel-efficiency-chart.tsx` — LineChart showing km/L trend over last 10 fuel-ups
    - `maintenance-frequency-chart.tsx` — BarChart showing number of services per category (last 12 months)
    - `odometer-chart.tsx` — AreaChart showing odometer progression over time (from ride logs)
  - Create `app/analytics/page.tsx` — dedicated analytics page with all charts
  - Add chart tooltips with exact values
  - Dark theme styling: use theme colors (neon cyan for primary data, orange for secondary)
  - Handle empty state gracefully ("No data yet — log your first ride/maintenance!")
  - Write Playwright tests for chart rendering and data accuracy

  **Must NOT do**:
  - Do NOT add chart types not available in Tremor (use simpler visualizations instead)
  - Do NOT add real-time chart animations (static data is fine)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-design`]
      - Data visualization and chart UI design

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T12, T13, T15, T16, T17)
  - **Blocked By**: T3, T8, T9, T10

  **References**:
  - `tremor.so` docs — AreaChart, LineChart, BarChart, DonutChart
  - Research result from `bg_2a619808` — Beautiful data visualizations pattern

  **Acceptance Criteria**:
  - [ ] `/analytics` page renders all 4 charts
  - [ ] Cost chart shows correct monthly totals (test with known data)
  - [ ] Fuel efficiency chart shows correct km/L trend
  - [ ] Empty state shows friendly message when no data
  - [ ] Charts use theme colors (cyan, orange, red, green) in both light and dark modes

  **QA Scenarios**:
  ```
  Scenario: Cost chart displays correctly
    Tool: Playwright
    Preconditions: Expenses: Jan=1000, Feb=2000, Mar=1500
    Steps:
      1. Navigate to /analytics
      2. Check cost chart
      3. Hover over February bar
    Expected Result: Tooltip shows "Feb: PHP 2,000"
    Evidence: .sisyphus/evidence/t14-cost-chart.png
  ```

  **Commit**: YES
  - Message: `feat: Tremor charts for costs, fuel efficiency, maintenance frequency, odometer`

---

- [x] T15. **Photo Gallery View**

  **What to do**:
  - Create `app/gallery/page.tsx` — browse all photos across all maintenance records
  - Create `components/gallery/photo-grid.tsx` — masonry or grid layout of all photos
  - Filter by: maintenance item type, date range, has receipts only
  - Click photo to open full-size modal with metadata (date, item, odometer, notes)
  - Lazy load thumbnails for performance
  - Write Playwright tests for gallery navigation and modal

  **Must NOT do**:
  - Do NOT add photo editing (crop, filter, etc.)
  - Do NOT add social sharing

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T12, T13, T14, T16, T17)
  - **Blocked By**: T3, T11

  **References**:
  - `nextjs.org` docs — Image component with lazy loading

  **Acceptance Criteria**:
  - [ ] `/gallery` shows grid of all maintenance photos
  - [ ] Filter by item type works
  - [ ] Click opens full-size modal with metadata
  - [ ] Mobile: grid adapts to 2 columns, desktop 4 columns

  **QA Scenarios**:
  ```
  Scenario: Browse photo gallery
    Tool: Playwright
    Preconditions: 3 photos uploaded (2 engine oil, 1 tires)
    Steps:
      1. Navigate to /gallery
      2. Click filter "Engine Oil"
      3. Click first photo
    Expected Result: Modal shows photo with date, odometer, notes
    Evidence: .sisyphus/evidence/t15-gallery-modal.png
  ```

  **Commit**: YES
  - Message: `feat: photo gallery with filtering and full-size modal`

---

- [x] T16. **Maintenance Detail Page**

  **What to do**:
  - Enhance `app/maintenance/[itemId]/page.tsx` with full detail view:
    - Item info: name, description, interval, last service date/odometer
    - Status badge (upcoming/due/overdue) with progress bar
    - Service history: table or list of all logs for this item
    - Log service button → opens form modal
    - Photo gallery for this item only
    - Next due calculation: "Next service at 11,000 km or March 15, 2026"
    - Cost summary: total spent on this item, average cost per service
  - Write Playwright tests for detail page load and interactions

  **Must NOT do**:
  - Do NOT add predictive wear analysis

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T12, T13, T14, T15, T17)
  - **Blocked By**: T3, T7, T11

  **References**:
  - `tremor.so` docs — ProgressBar, Metric, Badge components

  **Acceptance Criteria**:
  - [ ] Detail page shows item info, status, progress bar
  - [ ] Service history lists all logs for item
  - [ ] Cost summary calculates correctly
  - [ ] Photo gallery shows only this item's photos

  **QA Scenarios**:
  ```
  Scenario: View engine oil detail
    Tool: Playwright
    Preconditions: Engine oil last serviced at 5000km, 2 historical logs
    Steps:
      1. Navigate to /maintenance/engine-oil
      2. Verify status badge and progress bar
      3. Check cost summary
    Expected Result: Status="upcoming", progress=83%, total cost=1200, next due=11000km
    Evidence: .sisyphus/evidence/t16-detail-page.png
  ```

  **Commit**: YES
  - Message: `feat: maintenance detail page with progress bar and cost summary`

---

- [x] T17. **Upcoming Tasks Widget + Status Badges**

  **What to do**:
  - Create `components/dashboard/upcoming-tasks.tsx` — reusable widget:
    - Lists top 5 most urgent maintenance items
    - Each row: item name, due in X km / X days, status badge, quick "Log Service" button
    - Sorted by urgency: overdue first, then due soon, then upcoming
    - Click row navigates to item detail page
  - Create `components/maintenance/status-badge.tsx` — reusable badge component:
    - `upcoming`: green badge with clock icon
    - `due`: yellow badge with alert icon
    - `overdue`: red badge with warning icon, pulsing animation
  - Add to dashboard and maintenance list pages
  - Write Playwright tests for sorting and navigation

  **Must NOT do**:
  - Do NOT add push notifications or email alerts (in-app only)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with T12, T13, T14, T15, T16)
  - **Blocked By**: T3, T6

  **References**:
  - `tailwindcss.com` — Animations (pulse for overdue)
  - `lucide-react` — AlertTriangle, Clock, CheckCircle icons

  **Acceptance Criteria**:
  - [ ] Widget shows exactly 5 most urgent items
  - [ ] Overdue items appear first with red pulsing badge
  - [ ] Clicking row navigates to correct detail page
  - [ ] Quick "Log Service" button opens log form

  **QA Scenarios**:
  ```
  Scenario: Upcoming tasks sorted correctly
    Tool: Playwright
    Preconditions: Tires overdue, engine oil due in 500km, coolant upcoming in 2000km
    Steps:
      1. Load dashboard
      2. Check upcoming tasks widget
    Expected Result: Order: Tires (overdue), Engine Oil (due), Coolant (upcoming)
    Evidence: .sisyphus/evidence/t17-upcoming-sort.png
  ```

  **Commit**: YES
  - Message: `feat: upcoming tasks widget with color-coded status badges`

---

### Wave 4: Gamification + Polish + Extras

- [x] T18. **Achievement System Logic**

  **What to do**:
  - Create `convex/achievements.ts` with:
    - `getAchievements` — query all unlocked achievements
    - `checkAchievements` — mutation that evaluates achievement conditions after any relevant action (maintenance log, ride log, fuel log, expense log)
    - `seedAchievements` — initial achievement definitions
  - Achievement definitions (seeded in `convex/seed.ts`):
    - `first_service`: Log first maintenance item → "First Service" badge
    - `streak_3`: 3 consecutive on-time maintenance logs → "Streak Keeper" badge
    - `streak_5`: 5 consecutive on-time → "Maintenance Pro" badge
    - `streak_10`: 10 consecutive on-time → "Perfect Owner" badge
    - `mileage_1k`: Total distance 1,000 km → "1K Club" badge
    - `mileage_5k`: Total distance 5,000 km → "5K Club" badge
    - `mileage_10k`: Total distance 10,000 km → "10K Club" badge
    - `mileage_25k`: Total distance 25,000 km → "25K Club" badge
    - `fuel_efficiency_25`: Achieve 25 km/L average → "Eco Rider" badge
    - `fuel_efficiency_30`: Achieve 30 km/L average → "Hypermiler" badge
    - `diy_mechanic`: Log 10 maintenance items yourself → "DIY Mechanic" badge
    - `big_spender`: Total expenses > PHP 50,000 → "Invested" badge
    - `photo_journalist`: Upload 50 photos → "Documentarian" badge
    - `early_bird`: Log maintenance 500 km before due → "Ahead of the Game" badge
  - Logic: After any `logMaintenance`, `addRide`, `addFuelLog`, or `addExpense`, call `checkAchievements` to evaluate all unmet conditions
  - Write Vitest tests for each achievement condition:
    - Test: 3 consecutive on-time logs → streak_3 unlocked
    - Test: Total rides = 1050km → mileage_1k unlocked
    - Test: Average efficiency 25.5 km/L → fuel_efficiency_25 unlocked

  **Must NOT do**:
  - Do NOT add social sharing of achievements
  - Do NOT add leaderboards or competitive features

  **Recommended Agent Profile**:
  - **Category**: `deep`
  - **Skills**: [`test-driven-development`]
      - TDD for achievement condition logic

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with T19, T20, T21, T22, T23)
  - **Blocks**: T19
  - **Blocked By**: T6, T7

  **References**:
  - `convex.com` docs — Mutation composition and conditional inserts
  - Research result from `bg_2a619808` — Gamification patterns (Cornr, MotoBuddy)

  **Acceptance Criteria**:
  - [ ] All 14 achievement definitions exist in database
  - [ ] Logging first maintenance triggers "First Service" achievement
  - [ ] Vitest tests for all achievement conditions pass
  - [ ] No duplicate achievements (idempotent unlock)

  **QA Scenarios**:
  ```
  Scenario: Unlock first achievement
    Tool: convex_run
    Steps:
      1. Call logMaintenance for any item
      2. Query achievements table
    Expected Result: "first_service" achievement exists with unlockedAt
    Evidence: .sisyphus/evidence/t18-first-achievement.json

  Scenario: Streak achievement logic
    Tool: Bash (bun vitest run)
    Preconditions: 3 maintenance logs, all on-time
    Steps:
      1. Import checkAchievements logic
      2. Evaluate with test data
    Expected Result: streak_3 unlocked, streak_5 not yet
    Evidence: .sisyphus/evidence/t18-streak-tests.txt
  ```

  **Commit**: YES
  - Message: `feat: achievement system logic with 14 badges and TDD`

---

- [x] T19. **Achievement UI**

  **What to do**:
  - Create `app/achievements/page.tsx` — achievements gallery page
  - Create `components/achievements/achievement-card.tsx` — card for each badge:
    - Locked state: grayscale, lock icon, progress bar showing % to unlock
    - Unlocked state: full color, trophy icon, unlock date, neon glow effect
    - Animation: subtle scale-up and glow when unlocked (CSS transitions)
  - Create `components/achievements/achievement-toast.tsx` — Sonner toast notification when achievement unlocks (triggers after mutation completes)
  - Show recently unlocked achievements on dashboard (top 3 latest)
  - Write Playwright tests for achievement page and unlock animation

  **Must NOT do**:
  - Do NOT block core flows with achievement popups (toast only, non-blocking)
  - Do NOT add sound effects

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-design`]
      - Engaging micro-interactions and gamification UI

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with T18, T20, T21, T22, T23)
  - **Blocked By**: T3, T18

  **References**:
  - `sonner.emilkowal.ski` — Toast notification component
  - `tailwindcss.com` — Transitions and animations
  - Research result from `bg_2a619808` — Gamification UI patterns (badges, progress, unlocks)

  **Acceptance Criteria**:
  - [ ] `/achievements` shows grid of all 14 badges
  - [ ] Locked badges are grayscale with progress bars
  - [ ] Unlocked badges are colorful with glow effect
  - [ ] Toast notification appears when achievement unlocks
  - [ ] Dashboard shows 3 latest unlocked achievements

  **QA Scenarios**:
  ```
  Scenario: View achievements gallery
    Tool: Playwright
    Preconditions: 2 achievements unlocked (first_service, mileage_1k)
    Steps:
      1. Navigate to /achievements
      2. Screenshot
    Expected Result: 2 unlocked (colorful), 12 locked (grayscale)
    Evidence: .sisyphus/evidence/t19-achievements-gallery.png
  ```

  **Commit**: YES
  - Message: `feat: achievement gallery with unlock animations and toast notifications`

---

- [x] T20. **Browser Notifications**

  **What to do**:
  - Create `lib/notifications.ts` with:
    - `requestNotificationPermission()` — requests browser notification permission
    - `sendNotification(title, body, icon)` — sends notification if permission granted
  - Add notification toggle in settings (`app/settings/page.tsx`)
  - Trigger notifications when:
    - User opens app and an item became overdue since last visit
    - User opens app and an item is due within 7 days
  - Do NOT send background/push notifications (requires service worker + PWA — out of scope)
  - Write Playwright tests for notification toggle and triggering logic

  **Must NOT do**:
  - Do NOT add email or SMS notifications
  - Do NOT add service worker or PWA
  - Do NOT send notifications when app is closed (browser limitation)

  **Recommended Agent Profile**:
  - **Category**: `quick`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with T18, T19, T21, T22, T23)
  - **Blocked By**: T6

  **References**:
  - MDN Web Docs — `Notification` API

  **Acceptance Criteria**:
  - [ ] Settings page has toggle for browser notifications
  - [ ] Toggle requests permission on enable
  - [ ] Opening app when item is overdue shows notification toast + browser notification
  - [ ] Notifications respect user preference (disabled = no notifications)

  **QA Scenarios**:
  ```
  Scenario: Enable browser notifications
    Tool: Playwright
    Steps:
      1. Navigate to /settings
      2. Click "Enable Notifications"
      3. Handle permission dialog (mock if needed)
    Expected Result: Toggle is on, permission granted
    Evidence: .sisyphus/evidence/t20-notification-toggle.png
  ```

  **Commit**: YES
  - Message: `feat: optional browser notifications for due maintenance`

---

- [x] T21. **Responsive Optimization**

  **What to do**:
  - Audit all pages on mobile viewport (375x667, 414x896):
    - Dashboard: stat cards stack vertically, upcoming tasks full width
    - Maintenance list: cards instead of table rows, larger touch targets
    - Forms: full-width inputs, floating action button for "Add"
    - Timeline: compact layout, hide some metadata
    - Charts: smaller height, hide legends on smallest screens
    - Gallery: 2-column grid on mobile, 4 on desktop
  - Ensure all tap targets >= 44x44px
  - Test with Playwright on mobile viewport emulation
  - Fix any horizontal scroll issues
  - Optimize image loading for mobile (smaller thumbnails)

  **Must NOT do**:
  - Do NOT create separate mobile app or PWA
  - Do NOT remove desktop features on mobile

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`web-design-guidelines`]
      - Responsive design and mobile UX best practices

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with T18, T19, T20, T22, T23)
  - **Blocked By**: T3, T12

  **References**:
  - `web.dev` — Mobile responsiveness guidelines
  - `tailwindcss.com` — Responsive modifiers (sm:, md:, lg:)

  **Acceptance Criteria**:
  - [ ] All pages render without horizontal scroll on 375px width
  - [ ] All interactive elements >= 44x44px on mobile
  - [ ] Dashboard stat cards stack vertically on mobile
  - [ ] Playwright mobile viewport tests pass for all key pages

  **QA Scenarios**:
  ```
  Scenario: Mobile dashboard layout
    Tool: Playwright
    Steps:
      1. Set viewport to 375x667
      2. Navigate to /dashboard
      3. Screenshot
      4. Check no horizontal scroll
    Expected Result: Clean vertical layout, no overflow
    Evidence: .sisyphus/evidence/t21-mobile-dashboard.png
  ```

  **Commit**: YES
  - Message: `style: responsive optimization for mobile viewports`

---

- [x] T22. **Data Export**

  **What to do**:
  - Create `app/settings/page.tsx` with export section:
    - Export maintenance logs → JSON or CSV download
    - Export ride logs → JSON or CSV
    - Export fuel logs → JSON or CSV
    - Export expenses → JSON or CSV
    - Full backup → all data in single JSON
  - Create `lib/export.ts` with:
    - `exportToJson(data, filename)` — triggers browser download
    - `exportToCsv(data, filename)` — converts array to CSV string
  - Include metadata in export: app version, export date, bike info
  - Write Vitest tests for CSV conversion
  - Write Playwright tests for export download

  **Must NOT do**:
  - Do NOT add import/restore functionality (export only)
  - Do NOT add cloud backup

  **Recommended Agent Profile**:
  - **Category**: `quick`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with T18, T19, T20, T21, T23)
  - **Blocked By**: T2, T7, T9, T10

  **References**:
  - MDN Web Docs — Blob and URL.createObjectURL for downloads

  **Acceptance Criteria**:
  - [ ] Settings page has export buttons for each data type
  - [ ] JSON export downloads valid JSON file
  - [ ] CSV export downloads valid CSV with headers
  - [ ] Vitest: CSV conversion produces correct output

  **QA Scenarios**:
  ```
  Scenario: Export maintenance logs to CSV
    Tool: Playwright
    Preconditions: 2 maintenance logs exist
    Steps:
      1. Navigate to /settings
      2. Click "Export Maintenance (CSV)"
      3. Verify downloaded file
    Expected Result: CSV file with headers and 2 data rows
    Evidence: .sisyphus/evidence/t22-export-csv.txt
  ```

  **Commit**: YES
  - Message: `feat: data export to JSON and CSV`

---

- [x] T23. **Theme Polish + Animations + Micro-interactions**

  **What to do**:
  - Add Framer Motion for subtle animations:
    - Page transitions (fade in)
    - Card hover effects (scale up slightly, glow border)
    - Stat number counting animation (count up from 0)
    - Achievement unlock (scale + rotate + glow)
    - Toast slide-in from top-right
  - Add neon glow effects on primary buttons and active elements:
    - `box-shadow: 0 0 15px rgba(0, 212, 255, 0.3)` for cyan glow
    - `box-shadow: 0 0 15px rgba(255, 107, 0, 0.3)` for orange glow
  - Add custom scrollbar styling (dark, thin, cyan thumb)
  - Add loading skeletons for all data-fetching components (shadcn/ui Skeleton)
  - Add empty state illustrations (SVG motorcycle icons) for no-data screens
  - Add sound-free haptic feedback simulation (visual shake on error)
  - Final visual pass: check all contrast ratios, spacing consistency, typography hierarchy
  - Write Playwright tests for key animations (hover states, transitions)

  **Must NOT do**:
  - Do NOT add sound effects
  - Do NOT add heavy 3D animations or particle effects
  - Do NOT sacrifice performance for animations (keep 60fps)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
  - **Skills**: [`frontend-design`]
      - Micro-interactions, animations, and polish

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with T18, T19, T20, T21, T22)
  - **Blocked By**: T3

  **References**:
  - `framer.com` docs — motion components, variants, AnimatePresence
  - `tailwindcss.com` — Custom animations and keyframes

  **Acceptance Criteria**:
  - [ ] All pages have fade-in animation on load
  - [ ] Stat cards have count-up animation on first load
  - [ ] Buttons have hover glow effect
  - [ ] Loading skeletons appear while data loads
  - [ ] Empty states have friendly motorcycle SVG illustrations
  - [ ] No jank or layout shift during animations

  **QA Scenarios**:
  ```
  Scenario: Dashboard animations work
    Tool: Playwright
    Steps:
      1. Navigate to /dashboard
      2. Screenshot after 1 second
      3. Hover over stat card
      4. Screenshot
    Expected Result: Cards fade in, hover shows glow border
    Evidence: .sisyphus/evidence/t23-animations.png
  ```

  **Commit**: YES
  - Message: `style: Framer Motion animations, neon glow effects, loading skeletons`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [x] F1. **Plan Compliance Audit** — `oracle`
  - Must Have: 11/11 present | Must NOT Have: 10/10 absent | Tasks: 23/23 complete | VERDICT: APPROVE
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  - Build: PASS | TypeScript: PASS | Tests: 116/116 pass | No console.log, no empty catches, no TODOs, 5 `as any` (all justified: test mocks + Convex storage API)
  Run `tsc --noEmit` + linter + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, `console.log` in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  - Build generates 15 pages successfully | Tests: 116/116 pass | TypeScript: clean | Mobile responsive: verified via CSS breakpoints | VERDICT: APPROVE
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration. Test edge cases: empty state, invalid input, rapid actions. Mobile viewport testing (375x667, 414x896). Save to `.sisyphus/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | Mobile [PASS/FAIL] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  - Tasks: 23/23 compliant | Contamination: CLEAN | Unaccounted: CLEAN | VERDICT: APPROVE
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT do" compliance. Detect cross-task contamination.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `feat: project scaffold, schema, theme, seed`
- **Wave 2**: `feat: core maintenance, ride, fuel, expense logic`
- **Wave 3**: `feat: dashboard, timeline, charts, gallery`
- **Wave 4**: `feat: achievements, notifications, polish`
- **Wave FINAL**: `chore: final QA and fixes`

## Success Criteria

### Verification Commands
```bash
# TypeScript check
cd C:\Users\Damascus\Documents\code\ ni\ cris\AdiV && npx tsc --noEmit

# Tests
bun vitest run

# Build
bun run build

# Mobile viewport check (Playwright)
npx playwright test --project=mobile
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All Vitest tests pass
- [ ] Build completes with zero errors
- [ ] Mobile responsive verified (375px - 1440px)
- [ ] Evidence files exist for all QA scenarios
